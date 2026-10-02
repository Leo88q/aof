import { createHash } from "crypto";

export const MAX_SEASON_XP_ENTITLEMENT_AMOUNT = 100_000;
export const MAX_SEASON_XP_ENTITLEMENT_TTL_SLOTS = 150_000;
export const DEFAULT_SEASON_XP_ENTITLEMENT_TTL_SLOTS = 40_000;
export const MAX_PENDING_SEASON_XP_ENTITLEMENTS = 20;
const U32_MAX = 0xffff_ffff;
const U64_MAX = (1n << 64n) - 1n;
const CAMPAIGN_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const HEX_32 = /^[0-9a-f]{64}$/;

export interface NewSeasonXpEntitlement {
  player: string;
  seasonId: number;
  amount: number;
  campaignId: string;
  ttlSlots: number;
}

export interface SeasonXpEntitlementBinding {
  id: string;
  clusterGenesisHash: string;
  programId: string;
  seasonId: number;
  player: string;
  amount: number;
  campaignId: string;
  campaignDigest: string;
  nonce: number;
  expirySlot: string;
  status: string;
}

export function parseNewSeasonXpEntitlement(value: unknown): NewSeasonXpEntitlement {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_XP_ENTITLEMENT");
  const body = value as Record<string, unknown>;
  if (typeof body.player !== "string" || body.player.length < 32 || body.player.length > 44) {
    throw new Error("INVALID_XP_ENTITLEMENT_PLAYER");
  }
  if (typeof body.seasonId !== "number" || !Number.isSafeInteger(body.seasonId) ||
      body.seasonId < 0 || body.seasonId > U32_MAX) throw new Error("INVALID_XP_ENTITLEMENT_SEASON");
  if (typeof body.amount !== "number" || !Number.isSafeInteger(body.amount) ||
      body.amount < 1 || body.amount > MAX_SEASON_XP_ENTITLEMENT_AMOUNT) {
    throw new Error("INVALID_XP_ENTITLEMENT_AMOUNT");
  }
  if (typeof body.campaignId !== "string" || !CAMPAIGN_ID.test(body.campaignId)) {
    throw new Error("INVALID_XP_ENTITLEMENT_CAMPAIGN");
  }
  const ttlSlots = body.ttlSlots === undefined ? DEFAULT_SEASON_XP_ENTITLEMENT_TTL_SLOTS : body.ttlSlots;
  if (typeof ttlSlots !== "number" || !Number.isSafeInteger(ttlSlots) ||
      ttlSlots < 1 || ttlSlots > MAX_SEASON_XP_ENTITLEMENT_TTL_SLOTS) {
    throw new Error("INVALID_XP_ENTITLEMENT_TTL");
  }
  return {
    player: body.player,
    seasonId: body.seasonId,
    amount: body.amount,
    campaignId: body.campaignId,
    ttlSlots,
  };
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function seasonXpCampaignDigest(campaignId: string): string {
  if (!CAMPAIGN_ID.test(campaignId)) throw new Error("INVALID_XP_ENTITLEMENT_CAMPAIGN");
  return sha256Hex(`AOF_SEASON_XP_CAMPAIGN_V1\0${campaignId}`);
}

/** This digest is carried in the exact authority-signed instruction message. */
export function seasonXpGenesisDigest(genesisHash: string): string {
  if (typeof genesisHash !== "string" || genesisHash.length < 32 || genesisHash.length > 64) {
    throw new Error("INVALID_XP_ENTITLEMENT_GENESIS");
  }
  return sha256Hex(`AOF_SEASON_XP_GENESIS_V1\0${genesisHash}`);
}

export function seasonXpSequenceKey(binding: {
  clusterGenesisHash: string;
  programId: string;
  seasonId: number;
  player: string;
}): string {
  return sha256Hex([
    "AOF_SEASON_XP_SEQUENCE_V1",
    binding.clusterGenesisHash,
    binding.programId,
    String(binding.seasonId),
    binding.player,
  ].join("\0"));
}

export function expirySlotFrom(currentSlot: number | bigint, ttlSlots: number): string {
  const current = typeof currentSlot === "bigint" ? currentSlot : BigInt(currentSlot);
  if (current < 0n || current > U64_MAX || !Number.isSafeInteger(ttlSlots) ||
      ttlSlots < 1 || ttlSlots > MAX_SEASON_XP_ENTITLEMENT_TTL_SLOTS) {
    throw new Error("INVALID_XP_ENTITLEMENT_EXPIRY");
  }
  const expiry = current + BigInt(ttlSlots);
  if (expiry > U64_MAX) throw new Error("INVALID_XP_ENTITLEMENT_EXPIRY");
  return expiry.toString(10);
}

export function assertSeasonXpTarget(
  entitlement: Pick<SeasonXpEntitlementBinding, "clusterGenesisHash" | "programId">,
  currentGenesisHash: string,
  currentProgramId: string,
): void {
  if (entitlement.clusterGenesisHash !== currentGenesisHash) throw new Error("XP_CLAIM_WRONG_CLUSTER");
  if (entitlement.programId !== currentProgramId) throw new Error("XP_CLAIM_WRONG_PROGRAM");
}

export function assertSeasonXpOwner(entitlementPlayer: string, authenticatedWallet: string): void {
  if (entitlementPlayer !== authenticatedWallet) throw new Error("XP_CLAIM_NOT_YOURS");
}

export function assertSeasonXpPending(
  entitlement: Pick<SeasonXpEntitlementBinding, "status" | "expirySlot">,
  currentSlot: number | bigint,
): void {
  if (entitlement.status !== "pending") throw new Error("XP_CLAIM_NOT_PENDING");
  const current = typeof currentSlot === "bigint" ? currentSlot : BigInt(currentSlot);
  const expiry = BigInt(entitlement.expirySlot);
  if (current > expiry) throw new Error("XP_CLAIM_EXPIRED");
}

export function assertSeasonXpEntitlementShape(
  entitlement: Pick<SeasonXpEntitlementBinding,
    "id" | "amount" | "seasonId" | "campaignId" | "campaignDigest" | "nonce" | "expirySlot">,
): void {
  if (!HEX_32.test(entitlement.id) || !CAMPAIGN_ID.test(entitlement.campaignId) ||
      !HEX_32.test(entitlement.campaignDigest) ||
      entitlement.campaignDigest !== seasonXpCampaignDigest(entitlement.campaignId) ||
      !Number.isSafeInteger(entitlement.amount) || entitlement.amount < 1 ||
      entitlement.amount > MAX_SEASON_XP_ENTITLEMENT_AMOUNT ||
      !Number.isInteger(entitlement.seasonId) || entitlement.seasonId < 0 || entitlement.seasonId > U32_MAX ||
      !Number.isInteger(entitlement.nonce) || entitlement.nonce < 0 || entitlement.nonce >= U32_MAX ||
      !/^(0|[1-9][0-9]{0,19})$/.test(entitlement.expirySlot) || BigInt(entitlement.expirySlot) > U64_MAX) {
    throw new Error("INVALID_XP_ENTITLEMENT_RECORD");
  }
}
