import BN from "bn.js";
import { Router } from "express";
import { EventParser } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { db } from "../lib/db";
import { connection, program } from "../provider";
import { configPda, seasonPda, seasonPassPda, seasonXpClaimCursorPda } from "../lib/pda";
import { SEASON_PASS_ACCOUNT_SIZE, SEASON_XP_CLAIM_CURSOR_ACCOUNT_SIZE } from "../lib/accountSizes";
import { coSignQuoted, pk } from "../lib/tx";
import { AUTHORITY_PUBKEY } from "../config";
import {
  assertSeasonXpEntitlementShape,
  assertSeasonXpOwner,
  assertSeasonXpPending,
  assertSeasonXpTarget,
  seasonXpGenesisDigest,
} from "../lib/seasonXpEntitlement";
import { markSeasonXpEntitlementConsumed, markSeasonXpEntitlementExpired } from "../lib/seasonXpEntitlementStore";
import { transactionHasPlayerPayerAndAuthoritySignature } from "../lib/seasonXpClaimConfirmation";

const r = Router();
const ENTITLEMENT_ID = /^[0-9a-f]{64}$/;

type Entitlement = {
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
  claimSignature: string | null;
};

function authenticatedPlayer(req: any): string {
  const wallet = req.authenticatedWallet;
  if (typeof wallet !== "string" || req.body?.player !== wallet) throw new Error("XP_CLAIM_WALLET_MISMATCH");
  return wallet;
}

async function runtimeBinding() {
  const [clusterGenesisHash, currentSlot] = await Promise.all([
    connection.getGenesisHash(),
    connection.getSlot("confirmed"),
  ]);
  return { clusterGenesisHash, programId: program.programId.toBase58(), currentSlot };
}

async function findEntitlement(id: string): Promise<Entitlement | null> {
  if (!ENTITLEMENT_ID.test(id)) return null;
  return db.seasonXpEntitlement.findUnique({ where: { id } }) as Promise<Entitlement | null>;
}

/** Player-facing inbox: only the authenticated wallet's pending grants. */
// The server's exact MAPPED_MUTATIONS entries authenticate these POST paths
// before routing; keeping this router free of a duplicate proof middleware is
// necessary because wallet proofs are single-use.
r.post("/claims", async (req, res) => {
  try {
    const player = authenticatedPlayer(req);
    const seasonId = req.body.seasonId;
    if (seasonId !== undefined && (!Number.isSafeInteger(seasonId) || seasonId < 0 || seasonId > 0xffff_ffff)) {
      return res.status(400).json({ error: "INVALID_SEASON_ID" });
    }
    const { clusterGenesisHash, programId, currentSlot } = await runtimeBinding();
    const where: any = { player, clusterGenesisHash, programId, status: "pending" };
    if (seasonId !== undefined) where.seasonId = seasonId;
    const rows = await db.seasonXpEntitlement.findMany({
      where,
      orderBy: [{ seasonId: "asc" }, { nonce: "asc" }],
      take: 100,
    }) as Entitlement[];
    const active: Entitlement[] = [];
    const lowestPendingBySeason = new Map<number, number>();
    for (const row of rows) {
      assertSeasonXpEntitlementShape(row);
      if (BigInt(currentSlot) > BigInt(row.expirySlot)) {
        await markSeasonXpEntitlementExpired(row.id);
        continue;
      }
      const [cursorAddress] = seasonXpClaimCursorPda(new PublicKey(player), row.seasonId);
      const cursor = await (program.account as any).seasonXpClaimCursor.fetchNullable(cursorAddress);
      if (cursor && Number(cursor.nextNonce) > row.nonce) {
        // The on-chain cursor is the source of truth if the client submitted
        // successfully but lost the follow-up confirmation request.
        await markSeasonXpEntitlementConsumed(row.id, null);
        continue;
      }
      active.push(row);
      if (!lowestPendingBySeason.has(row.seasonId)) lowestPendingBySeason.set(row.seasonId, row.nonce);
    }
    return res.json({
      claims: active.map((row) => ({
        id: row.id,
        seasonId: row.seasonId,
        player: row.player,
        amount: row.amount,
        campaignId: row.campaignId,
        nonce: row.nonce,
        expirySlot: row.expirySlot,
        status: row.status,
        canClaim: lowestPendingBySeason.get(row.seasonId) === row.nonce,
      })),
    });
  } catch (error: any) {
    const message = String(error?.message ?? error);
    return res.status(message === "XP_CLAIM_WALLET_MISMATCH" ? 403 : 400).json({ error: message });
  }
});

/** Build an authority-co-signed transaction; the player remains fee payer. */
r.post("/claims/:id/transaction", async (req, res) => {
  try {
    const player = authenticatedPlayer(req);
    const entitlement = await findEntitlement(req.params.id);
    if (!entitlement) return res.status(404).json({ error: "XP_ENTITLEMENT_NOT_FOUND" });
    assertSeasonXpOwner(entitlement.player, player);
    assertSeasonXpEntitlementShape(entitlement);

    const { clusterGenesisHash, programId, currentSlot } = await runtimeBinding();
    assertSeasonXpTarget(entitlement, clusterGenesisHash, programId);
    try {
      assertSeasonXpPending(entitlement, currentSlot);
    } catch (error: any) {
      if (error?.message === "XP_CLAIM_EXPIRED") await markSeasonXpEntitlementExpired(entitlement.id);
      throw error;
    }

    // Do not let a later award leapfrog an earlier unexpired entitlement. Gaps
    // are allowed on-chain only after an earlier signed entitlement expires.
    const earlier = await db.seasonXpEntitlement.findMany({
      where: {
        clusterGenesisHash,
        programId,
        player,
        seasonId: entitlement.seasonId,
        status: "pending",
        nonce: { lt: entitlement.nonce },
      },
      orderBy: { nonce: "asc" },
      take: 100,
    }) as Entitlement[];
    for (const row of earlier) {
      if (BigInt(currentSlot) > BigInt(row.expirySlot)) await markSeasonXpEntitlementExpired(row.id);
      else return res.status(409).json({ error: "XP_CLAIM_EARLIER_ENTITLEMENT_PENDING" });
    }

    const playerKey = pk(player);
    const [config] = configPda();
    const [season] = seasonPda(entitlement.seasonId);
    const [seasonPass] = seasonPassPda(playerKey, entitlement.seasonId);
    const [claimCursor] = seasonXpClaimCursorPda(playerKey, entitlement.seasonId);
    const onChainSeason = await (program.account as any).season.fetchNullable(season);
    if (!onChainSeason || Number(onChainSeason.seasonId) !== entitlement.seasonId) {
      return res.status(409).json({ error: "XP_CLAIM_SEASON_MISMATCH" });
    }

    const configData = await (program.account as any).config.fetch(config);
    const authority = configData.operator as PublicKey;
    if (!authority?.equals?.(AUTHORITY_PUBKEY)) {
      return res.status(503).json({ error: "XP_CLAIM_AUTHORITY_CONFIGURATION_MISMATCH" });
    }
    if (authority.equals(playerKey)) return res.status(409).json({ error: "XP_CLAIM_AUTHORITY_PLAYER_COLLISION" });

    const existingPass = await (program.account as any).seasonPass.fetchNullable(seasonPass);
    if (existingPass && (!existingPass.owner.equals(playerKey) || Number(existingPass.seasonId) !== entitlement.seasonId)) {
      return res.status(409).json({ error: "XP_CLAIM_PASS_MISMATCH" });
    }
    const existingCursor = await (program.account as any).seasonXpClaimCursor.fetchNullable(claimCursor);
    if (existingCursor && (!existingCursor.owner.equals(playerKey) || Number(existingCursor.seasonId) !== entitlement.seasonId)) {
      return res.status(409).json({ error: "XP_CLAIM_CURSOR_MISMATCH" });
    }
    if (existingCursor && Number(existingCursor.nextNonce) > entitlement.nonce) {
      await markSeasonXpEntitlementConsumed(entitlement.id, null);
      return res.status(409).json({ error: "XP_CLAIM_ALREADY_SETTLED" });
    }

    const campaignDigest = Buffer.from(entitlement.campaignDigest, "hex");
    const entitlementId = Buffer.from(entitlement.id, "hex");
    const genesisHashDigest = Buffer.from(seasonXpGenesisDigest(clusterGenesisHash), "hex");
    const instruction = await (program.methods as any)
      .grantSeasonXp(
        entitlement.amount,
        entitlement.seasonId,
        entitlement.nonce,
        new BN(entitlement.expirySlot),
        Array.from(campaignDigest),
        Array.from(entitlementId),
        Array.from(genesisHashDigest),
      )
      .accounts({
        config,
        authority,
        user: playerKey,
        season,
        seasonPass,
        claimCursor,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    const prepared = await coSignQuoted([instruction], playerKey, [
      { name: "season_pass", address: seasonPass, size: SEASON_PASS_ACCOUNT_SIZE, strategy: "init_if_needed" },
      { name: "season_xp_claim_cursor", address: claimCursor, size: SEASON_XP_CLAIM_CURSOR_ACCOUNT_SIZE, strategy: "init_if_needed" },
    ]);
    return res.json({
      ...prepared,
      entitlement: {
        id: entitlement.id,
        clusterGenesisHash,
        programId,
        authority: authority.toBase58(),
        player,
        seasonId: entitlement.seasonId,
        amount: entitlement.amount,
        campaignId: entitlement.campaignId,
        campaignDigest: entitlement.campaignDigest,
        nonce: entitlement.nonce,
        expirySlot: entitlement.expirySlot,
        genesisHashDigest: genesisHashDigest.toString("hex"),
      },
    });
  } catch (error: any) {
    const message = String(error?.message ?? error);
    const status = message === "XP_CLAIM_NOT_YOURS" || message === "XP_CLAIM_WALLET_MISMATCH" ? 403
      : message === "XP_CLAIM_NOT_PENDING" || message === "XP_CLAIM_EXPIRED" ||
        message === "XP_CLAIM_WRONG_CLUSTER" || message === "XP_CLAIM_WRONG_PROGRAM" ? 409
      : error?.status || 400;
    return res.status(status).json({ error: message });
  }
});

function byteHex(value: unknown): string {
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return Buffer.from(value).toString("hex");
  if (Array.isArray(value) && value.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) return Buffer.from(value).toString("hex");
  return "";
}

function eventField(data: any, snake: string, camel: string): any {
  return data?.[camel] ?? data?.[snake];
}

function eventMatches(event: any, row: Entitlement, genesisDigest: string): boolean {
  const data = event?.data ?? {};
  const owner = eventField(data, "owner", "owner");
  const seasonId = eventField(data, "season_id", "seasonId");
  const amount = eventField(data, "amount", "amount");
  const nonce = eventField(data, "nonce", "nonce");
  const entitlementId = eventField(data, "entitlement_id", "entitlementId");
  const campaignDigest = eventField(data, "campaign_digest", "campaignDigest");
  const signedGenesisDigest = eventField(data, "genesis_hash_digest", "genesisHashDigest");
  const expirySlot = eventField(data, "expiry_slot", "expirySlot");
  const ownerKey = owner instanceof PublicKey ? owner.toBase58() : owner?.toBase58?.() ?? String(owner ?? "");
  return ownerKey === row.player && Number(seasonId) === row.seasonId && Number(amount) === row.amount &&
    Number(nonce) === row.nonce && String(expirySlot) === row.expirySlot &&
    byteHex(entitlementId) === row.id && byteHex(campaignDigest) === row.campaignDigest &&
    byteHex(signedGenesisDigest) === genesisDigest;
}

/** Mark consumed only after the exact on-chain event is confirmed. */
r.post("/claims/:id/confirm", async (req, res) => {
  try {
    const player = authenticatedPlayer(req);
    const entitlement = await findEntitlement(req.params.id);
    if (!entitlement) return res.status(404).json({ error: "XP_ENTITLEMENT_NOT_FOUND" });
    assertSeasonXpOwner(entitlement.player, player);
    assertSeasonXpEntitlementShape(entitlement);
    const { clusterGenesisHash, programId } = await runtimeBinding();
    assertSeasonXpTarget(entitlement, clusterGenesisHash, programId);

    if (entitlement.status === "consumed") return res.json({ status: "consumed" });
    if (entitlement.status !== "pending") return res.status(409).json({ error: "XP_CLAIM_NOT_PENDING" });
    const signature = req.body.signature;
    if (typeof signature !== "string" || signature.length < 64 || signature.length > 100) {
      return res.status(400).json({ error: "INVALID_XP_CLAIM_SIGNATURE" });
    }
    const transaction = await connection.getTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    if (!transaction) return res.status(202).json({ status: "pending" });
    if (!transactionHasPlayerPayerAndAuthoritySignature(transaction, pk(player), AUTHORITY_PUBKEY, program.programId)) {
      return res.status(409).json({ error: "XP_CLAIM_PLAYER_FEE_PAYER_REQUIRED" });
    }
    if (transaction.meta?.err) return res.status(409).json({ error: "XP_CLAIM_TRANSACTION_FAILED" });
    const logs = transaction.meta?.logMessages ?? [];
    const parser = new EventParser(program.programId, program.coder);
    const events = [...parser.parseLogs(logs)];
    const genesisDigest = seasonXpGenesisDigest(clusterGenesisHash);
    const matching = events.some((event: any) =>
      String(event.name).toLowerCase() === "seasonxpgranted" && eventMatches(event, entitlement, genesisDigest));
    if (!matching) return res.status(409).json({ error: "XP_CLAIM_EVENT_MISMATCH" });

    const state = await markSeasonXpEntitlementConsumed(entitlement.id, signature);
    if (state !== "consumed") return res.status(409).json({ error: "XP_CLAIM_STATE_CONFLICT" });
    return res.json({ status: "consumed", signature });
  } catch (error: any) {
    const message = String(error?.message ?? error);
    const status = message === "XP_CLAIM_NOT_YOURS" || message === "XP_CLAIM_WALLET_MISMATCH" ? 403
      : message === "XP_CLAIM_WRONG_CLUSTER" || message === "XP_CLAIM_WRONG_PROGRAM" ? 409
      : error?.status || 400;
    return res.status(status).json({ error: message });
  }
});

export default r;
