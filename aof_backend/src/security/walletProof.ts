import { createHash, createPublicKey, verify } from "crypto";
import { PublicKey } from "@solana/web3.js";
import { Request, Response, NextFunction } from "express";
import { checkIdempotency, completeIdempotency } from "./idempotency";
import { requireIdempotency } from "../middleware/security";
import { db } from "../lib/db";
import { walletProofDigest } from "./walletProofCore";

const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
export const WALLET_PROOF_DOMAIN = process.env.WALLET_PROOF_DOMAIN || "AOF_API";
const WALLET_PROOF_DOMAIN_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
const WALLET_PROOF_MAX_AGE_MS = 5 * 60 * 1000;
const NONCE_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
const PROOF_RECORD_RETENTION_MS = 24 * 60 * 60 * 1000;
let lastProofCleanupAt = 0;

/**
 * Verify a short-lived wallet proof.
 *
 * New API proofs use this exact message format:
 *   AOF_API:wallet:operation:bodySha256:unixMilliseconds:nonce
 *
 * The domain, wallet, operation, timestamp and nonce are all signed. The
 * middleware additionally consumes the complete message in the durable
 * idempotency table, so accepting the same signed proof twice is impossible
 * across concurrent requests and backend instances.
 *
 * AOF_INBOX_CLAIM is retained as a legacy verifier for already-issued inbox
 * messages. Its claim endpoint has its own idempotency guard; new endpoints
 * must use AOF_API proofs.
 */
export function verifyWalletProof(
  wallet: string,
  message: string,
  signatureBase64: string,
  expectedPrefix: string,
  expectedSubject?: string,
  maxAgeMs = WALLET_PROOF_MAX_AGE_MS,
  expectedDigest?: string,
): boolean {
  try {
    const publicKey = new PublicKey(wallet);
    const parts = message.split(":");
    const isApiProof = expectedPrefix === WALLET_PROOF_DOMAIN;
    // An invalid deployment domain must fail closed. Otherwise the verifier
    // would accidentally fall back to the legacy four-part format and lose
    // the body digest on every mapped API mutation.
    if (isApiProof && !WALLET_PROOF_DOMAIN_PATTERN.test(WALLET_PROOF_DOMAIN)) return false;
    const expectedParts = isApiProof ? 6 : 4;
    if (
      parts.length !== expectedParts ||
      parts[0] !== expectedPrefix ||
      parts[1] !== wallet ||
      (expectedSubject !== undefined && parts[2] !== expectedSubject)
    ) return false;

    if (isApiProof) {
      if (!/^[a-f0-9]{64}$/.test(parts[3])) return false;
      if (expectedDigest !== undefined && parts[3] !== expectedDigest) return false;
    }
    const timestamp = Number(isApiProof ? parts[4] : parts[3]);
    if (!Number.isSafeInteger(timestamp) || Math.abs(Date.now() - timestamp) > maxAgeMs) return false;
    if (isApiProof && !NONCE_PATTERN.test(parts[5])) return false;

    const signature = Buffer.from(signatureBase64, "base64");
    if (signature.length !== 64) return false;
    const key = createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, publicKey.toBytes()]),
      format: "der",
      type: "spki",
    });
    return verify(null, Buffer.from(message, "utf8"), key, signature);
  } catch {
    return false;
  }
}

async function dbCleanupConsumedProofs(): Promise<void> {
  try {
    await db.idempotencyRecord.deleteMany({
      where: {
        operationKey: { startsWith: "wallet-proof:" },
        createdAt: { lt: new Date(Date.now() - PROOF_RECORD_RETENTION_MS) },
      },
    });
  } catch {
    // Cleanup is best-effort; verification remains fail-closed on storage
    // errors in the request path above.
  }
}

type WalletSelector = string | ((req: Request) => unknown);

/**
 * Require and consume a one-time wallet signature for an off-chain mutation.
 * The wallet is selected by the server-defined request field, while the
 * operation subject is fixed by the route and cannot be chosen by the caller.
 */
export function requireWalletProof(subject: string, selector: WalletSelector = "user") {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const selected = typeof selector === "function" ? selector(req) : req.body?.[selector];
    const wallet = typeof selected === "string" ? selected : "";
    const proof = req.body?.walletProof;
    if (
      !wallet ||
      !proof ||
      typeof proof.message !== "string" ||
      typeof proof.signature !== "string" ||
      proof.message.length > 512 ||
      !verifyWalletProof(
        wallet,
        proof.message,
        proof.signature,
        WALLET_PROOF_DOMAIN,
        subject,
        WALLET_PROOF_MAX_AGE_MS,
        walletProofDigest(req.body),
      )
    ) {
      res.status(401).json({ error: "Wallet signature required" });
      return;
    }

    const proofKey = `wallet-proof:${createHash("sha256").update(proof.message, "utf8").digest("hex")}`;
    try {
      const consumed = await checkIdempotency(proofKey);
      if (!consumed.allowed) {
        res.status(409).json({ error: "Wallet proof already used" });
        return;
      }
      // Consume before entering the handler. A proof is intentionally
      // single-use even if the business operation later fails; the client
      // must sign a fresh request instead of replaying an old authorization.
      await completeIdempotency(proofKey);
      // Proof records are retained well beyond the five-minute validity
      // window, then pruned opportunistically to keep the idempotency table
      // bounded without making verification depend on an in-memory cache.
      if (Date.now() - lastProofCleanupAt > 60 * 60 * 1000) {
        lastProofCleanupAt = Date.now();
        void dbCleanupConsumedProofs();
      }
    } catch {
      res.status(503).json({ error: "Wallet proof storage unavailable" });
      return;
    }

    (req as any).authenticatedWallet = wallet;
    // Wallet proofs authenticate the actor; the HTTP idempotency key protects
    // the business request when the client retries with a fresh proof. Route
    // handlers may also list requireIdempotency; that middleware detects the
    // already-prepared request and simply continues.
    await requireIdempotency(req, res, next);
  };
}

/**
 * Central guard for business mutation routes that return unsigned on-chain
 * transactions or mutate backend state. Keeping the route map here prevents a
 * newly mounted router from accidentally becoming an unauthenticated write
 * surface. Routes with admin authentication and the small set of legacy
 * route-specific guards are intentionally excluded.
 */
type MappedProof = { path: string; subject: string; selector: string };

const MAPPED_MUTATIONS: MappedProof[] = [
  { path: "/alerts/create", subject: "alerts_create", selector: "user" },
  { path: "/alerts/", subject: "alerts_delete", selector: "user" },
  { path: "/antifraud/device/register", subject: "antifraud_device_register", selector: "user" },
  { path: "/chain/farm/plant", subject: "chain_farm_plant", selector: "user" },
  { path: "/chain/farm/harvest", subject: "chain_farm_harvest", selector: "user" },
  { path: "/chain/mill/start", subject: "chain_mill_start", selector: "user" },
  { path: "/chain/mill/collect", subject: "chain_mill_collect", selector: "user" },
  { path: "/chain/oven/start", subject: "chain_oven_start", selector: "user" },
  { path: "/chain/oven/collect", subject: "chain_oven_collect", selector: "user" },
  { path: "/chain/weather/crank", subject: "chain_weather_crank", selector: "cranker" },
  { path: "/chain/well/collect", subject: "chain_well_collect", selector: "user" },
  { path: "/chain/recipe/craft", subject: "chain_recipe_craft", selector: "user" },
  { path: "/craft-order/create", subject: "craft_order_create", selector: "creator" },
  { path: "/craft-order/fulfill", subject: "craft_order_fulfill", selector: "fulfiller" },
  { path: "/craft-order/cancel", subject: "craft_order_cancel", selector: "creator" },
  { path: "/energy/spend", subject: "energy_spend", selector: "user" },
  { path: "/farm/building/place", subject: "farm_building_place", selector: "user" },
  { path: "/guild/create", subject: "guild_create", selector: "leaderId" },
  { path: "/guild/join", subject: "guild_join", selector: "user" },
  { path: "/guild/set-role", subject: "guild_set_role", selector: "user" },
  { path: "/guild-wars/capture", subject: "guild_wars_capture", selector: "actor" },
  { path: "/lottery/ticket/buy", subject: "lottery_ticket_buy", selector: "buyer" },
  { path: "/lottery/claim", subject: "lottery_claim", selector: "winner" },
  { path: "/marketplace/list", subject: "marketplace_list", selector: "seller" },
  { path: "/marketplace/buy", subject: "marketplace_buy", selector: "buyer" },
  { path: "/marketplace/cancel", subject: "marketplace_cancel", selector: "seller" },
  { path: "/auction/create", subject: "auction_create", selector: "seller" },
  { path: "/auction/bid", subject: "auction_bid", selector: "bidder" },
  { path: "/auction/settle", subject: "auction_settle", selector: "caller" },
  { path: "/hot-market/skip", subject: "hot_market_skip", selector: "player" },
  { path: "/offer/create", subject: "offer_create", selector: "buyer" },
  { path: "/offer/accept", subject: "offer_accept", selector: "seller" },
  { path: "/offer/cancel", subject: "offer_cancel", selector: "buyer" },
  { path: "/rental/list", subject: "rental_list", selector: "owner" },
  { path: "/rental/start", subject: "rental_start", selector: "renter" },
  { path: "/rental/end", subject: "rental_end", selector: "caller" },
  { path: "/rental/revoke", subject: "rental_revoke", selector: "owner" },
  { path: "/orderbook/buy/place", subject: "orderbook_buy_place", selector: "maker" },
  { path: "/orderbook/sell/place", subject: "orderbook_sell_place", selector: "maker" },
  { path: "/orderbook/buy/cancel", subject: "orderbook_buy_cancel", selector: "maker" },
  { path: "/orderbook/sell/cancel", subject: "orderbook_sell_cancel", selector: "maker" },
  { path: "/orderbook/match", subject: "orderbook_match", selector: "caller" },
  { path: "/packs/commit", subject: "packs_commit", selector: "user" },
  { path: "/packs/reveal", subject: "packs_reveal", selector: "user" },
  { path: "/quests/quest/claim", subject: "quests_claim", selector: "user" },
  { path: "/quests/achievement/unlock", subject: "quests_achievement", selector: "user" },
  { path: "/referral/bind", subject: "referral_bind", selector: "referred" },
  { path: "/referral/upgrade", subject: "referral_upgrade", selector: "user" },
  { path: "/reroll/fuse", subject: "reroll_fuse", selector: "user" },
  { path: "/reroll/random/commit", subject: "reroll_commit", selector: "user" },
  { path: "/reroll/random/reveal", subject: "reroll_reveal", selector: "user" },
  { path: "/resources/burn", subject: "resources_burn", selector: "owner" },
  { path: "/resources/exchange-energy", subject: "resources_exchange_energy", selector: "user" },
  { path: "/season/pass/purchase", subject: "season_pass_purchase", selector: "user" },
  { path: "/tools/craft", subject: "tools_craft", selector: "user" },
  { path: "/tools/repair", subject: "tools_repair", selector: "user" },
  { path: "/tools/stake", subject: "tools_stake", selector: "user" },
  { path: "/tools/unstake", subject: "tools_unstake", selector: "user" },
  { path: "/tools/start-mining", subject: "tools_start_mining", selector: "user" },
  { path: "/tools/collect-mining", subject: "tools_collect_mining", selector: "user" },
  { path: "/tools/burn", subject: "tools_burn", selector: "user" },
  { path: "/trader-rules/create", subject: "trader_rules_create", selector: "user" },
  { path: "/trader-rules/toggle", subject: "trader_rules_toggle", selector: "user" },
  { path: "/trader-rules/", subject: "trader_rules_delete", selector: "user" },
  { path: "/gastank/deposit", subject: "gastank_deposit", selector: "user" },
  { path: "/gastank/withdraw", subject: "gastank_withdraw", selector: "user" },
  { path: "/liquidity/deposit", subject: "liquidity_deposit", selector: "user" },
  { path: "/liquidity/withdraw", subject: "liquidity_withdraw", selector: "user" },
  { path: "/forge/commit", subject: "forge_commit", selector: "user" },
  { path: "/forge/reveal", subject: "forge_reveal", selector: "user" },
  { path: "/forge/bow/commit", subject: "forge_bow_commit", selector: "user" },
  { path: "/forge/bow/reveal", subject: "forge_bow_reveal", selector: "user" },
  { path: "/drum/commit", subject: "drum_commit", selector: "user" },
  { path: "/drum/reveal", subject: "drum_reveal", selector: "user" },
  { path: "/exploration/start/commit", subject: "exploration_commit", selector: "user" },
  { path: "/exploration/reveal", subject: "exploration_reveal", selector: "user" },
  { path: "/exploration/upgrade-tier", subject: "exploration_upgrade_tier", selector: "user" },
];

/** Apply the mapped guard only to routes not already protected by a local guard. */
export function requireMappedWalletProof() {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.method !== "POST" && req.method !== "PUT" && req.method !== "PATCH" && req.method !== "DELETE") {
      next();
      return;
    }
    const mapping = MAPPED_MUTATIONS.find((candidate) => {
      if (candidate.path.endsWith("/")) return req.path.startsWith(candidate.path);
      return req.path === candidate.path;
    });
    if (!mapping) {
      next();
      return;
    }
    requireWalletProof(mapping.subject, mapping.selector)(req, res, next).catch(() => {
      if (!res.headersSent) res.status(503).json({ error: "Wallet proof verification failed" });
    });
  };
}
