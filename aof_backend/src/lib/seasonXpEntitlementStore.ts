import { randomBytes } from "crypto";
import { db } from "./db";
import {
  NewSeasonXpEntitlement,
  expirySlotFrom,
  seasonXpCampaignDigest,
  seasonXpSequenceKey,
  MAX_PENDING_SEASON_XP_ENTITLEMENTS,
} from "./seasonXpEntitlement";

export async function createSeasonXpEntitlement(args: {
  input: NewSeasonXpEntitlement;
  clusterGenesisHash: string;
  programId: string;
  currentSlot: number;
}) {
  const { input, clusterGenesisHash, programId, currentSlot } = args;
  const sequenceKey = seasonXpSequenceKey({
    clusterGenesisHash,
    programId,
    seasonId: input.seasonId,
    player: input.player,
  });
  const expirySlot = expirySlotFrom(currentSlot, input.ttlSlots);
  const id = randomBytes(32).toString("hex");
  const campaignDigest = seasonXpCampaignDigest(input.campaignId);

  return db.$transaction(async (tx) => {
    // The sequence and entitlement insert share one DB transaction. Concurrent
    // admin requests serialize the counter increment; a unique campaign error
    // rolls the increment back rather than consuming a nonce.
    const sequence = await tx.seasonXpNonceSequence.upsert({
      where: { key: sequenceKey },
      create: { key: sequenceKey, nextNonce: 1 },
      update: { nextNonce: { increment: 1 } },
    });
    const nonce = sequence.nextNonce - 1;
    // The on-chain cursor stores nonce + 1 in u32, so u32::MAX itself is
    // intentionally not a claimable entitlement nonce.
    if (!Number.isSafeInteger(nonce) || nonce < 0 || nonce >= 0xffff_ffff) {
      throw new Error("XP_ENTITLEMENT_NONCE_EXHAUSTED");
    }
    const pendingWhere = {
      clusterGenesisHash,
      programId,
      seasonId: input.seasonId,
      player: input.player,
      status: "pending",
    };
    const pendingRows = await tx.seasonXpEntitlement.findMany({ where: pendingWhere, select: { id: true, expirySlot: true } });
    for (const row of pendingRows) {
      if (BigInt(currentSlot) > BigInt(row.expirySlot)) {
        await tx.seasonXpEntitlement.updateMany({ where: { id: row.id, status: "pending" }, data: { status: "expired" } });
      }
    }
    const pendingCount = await tx.seasonXpEntitlement.count({ where: pendingWhere });
    if (pendingCount >= MAX_PENDING_SEASON_XP_ENTITLEMENTS) {
      throw new Error("XP_ENTITLEMENT_PENDING_LIMIT");
    }
    return tx.seasonXpEntitlement.create({
      data: {
        id,
        clusterGenesisHash,
        programId,
        seasonId: input.seasonId,
        player: input.player,
        amount: input.amount,
        campaignId: input.campaignId,
        campaignDigest,
        nonce,
        expirySlot,
        status: "pending",
      },
    });
  });
}

export async function markSeasonXpEntitlementConsumed(id: string, signature: string | null) {
  const updated = await db.seasonXpEntitlement.updateMany({
    where: { id, status: "pending" },
    data: { status: "consumed", claimSignature: signature, consumedAt: new Date() },
  });
  if (updated.count === 1) return "consumed" as const;
  const existing = await db.seasonXpEntitlement.findUnique({ where: { id } });
  if (existing?.status === "consumed" && existing.claimSignature === signature) return "consumed" as const;
  if (existing?.status === "consumed") return "consumed" as const;
  return existing?.status ?? "missing";
}

export async function markSeasonXpEntitlementExpired(id: string) {
  await db.seasonXpEntitlement.updateMany({
    where: { id, status: "pending" },
    data: { status: "expired" },
  });
}
