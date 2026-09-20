/**
 * Pure logic for the on-chain event indexer: no RPC, no Prisma.
 *
 *  - decode Anchor events from tx logs for a set of programs,
 *  - pick the canonical wallet / mint / amount out of each event payload,
 *  - derive net SPL supply change per mint from pre/post token balances.
 *
 * services/chain-indexer/index.ts wires this to Connection + db.
 */
import { BorshCoder, EventParser, Idl } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { createHash } from "crypto";

export type IndexedProgram = { programId: string; name: string; idl: Idl };

export type DecodedEvent = {
  eventIndex: number;
  programId: string;
  eventType: string;
  wallet: string | null;
  walletHash: string | null;
  mint: string | null;
  amount: string | null;
  data: Record<string, unknown>;
};

export type MintDelta = { mint: string; delta: bigint };

// Field preference order for the "primary actor" of an event. The first
// present key wins; anything else stays in `data`.
const WALLET_FIELDS = ["user", "owner", "buyer", "seller", "bidder", "maker", "winner", "to", "from", "referrer", "referred", "creator", "fulfiller", "renter", "authority"];
const MINT_FIELDS = ["mint", "toolMint", "resourceMint", "mintedMint", "newMint", "burnedMint", "mascotMint", "rewardMascot"];
const AMOUNT_FIELDS = ["amount", "priceLamports", "price", "amountLamports", "refundedLamports", "premiumLamports", "poolLamports", "limitPrice", "medals", "woodReward", "stoneReward"];

export function hashWallet(wallet: string, salt = process.env.WALLET_HASH_SALT || ""): string {
  return createHash("sha256").update(`${salt}|${wallet}`).digest("hex");
}

/** BN / PublicKey / nested enums -> JSON-safe primitives. */
export function normalize(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") return value;
  if (value instanceof PublicKey) return value.toBase58();
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return Buffer.from(value).toString("hex");
  if (Array.isArray(value)) return value.map(normalize);
  const v: any = value;
  if (typeof v.toString === "function" && v.constructor?.name === "BN") return v.toString(10);
  if (typeof v.toBase58 === "function") return v.toBase58();
  const out: Record<string, unknown> = {};
  for (const [k, inner] of Object.entries(v)) out[k] = normalize(inner);
  return out;
}

// Anchor decodes field names as they appear in the IDL (snake_case for these
// programs); normalize to camelCase once so lookups and stored JSON are uniform.
export function camelKeys(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) out[k.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase())] = v;
  return out;
}

function firstString(data: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = data[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return null;
}

function firstAmount(data: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = data[k];
    if (typeof v === "string" && /^-?\d+$/.test(v)) return v;
    if (typeof v === "number" && Number.isFinite(v)) return String(Math.trunc(v));
  }
  return null;
}

export class EventDecoder {
  private parsers: { programId: string; parser: EventParser }[] = [];

  constructor(programs: IndexedProgram[]) {
    for (const p of programs) {
      this.parsers.push({ programId: p.programId, parser: new EventParser(new PublicKey(p.programId), new BorshCoder(p.idl)) });
    }
  }

  /**
   * Decode every event emitted by any indexed program in a single tx. The
   * event index is the position across the whole log stream, so it is stable
   * for a given signature and works as the dedup key.
   */
  decode(logs: string[] | null | undefined): DecodedEvent[] {
    if (!logs || logs.length === 0) return [];
    const out: DecodedEvent[] = [];
    // Each parser walks the full log stream and only yields its own program's
    // events; ordering across programs is restored by sorting on a running
    // per-parser counter offset — simpler: collect all, then assign indexes
    // in encounter order per parser, prefixed by program order. Stable enough
    // for dedup because both signature and index are deterministic.
    let base = 0;
    for (const { programId, parser } of this.parsers) {
      let i = 0;
      for (const ev of parser.parseLogs(logs, false)) {
        const data = camelKeys((normalize(ev.data) ?? {}) as Record<string, unknown>);
        const wallet = firstString(data, WALLET_FIELDS);
        out.push({
          eventIndex: base + i,
          programId,
          eventType: ev.name,
          wallet,
          walletHash: wallet ? hashWallet(wallet) : null,
          mint: firstString(data, MINT_FIELDS),
          amount: firstAmount(data, AMOUNT_FIELDS),
          data,
        });
        i += 1;
      }
      base += 1000; // per-program index namespace; a single tx never emits 1000 events
    }
    return out;
  }
}

type TokenBalance = { mint: string; uiTokenAmount: { amount: string } };

/**
 * Net supply change per mint in one tx. Transfers between accounts sum to
 * zero; a positive residual is mint_to, negative is burn. Only mints in
 * `tracked` (if provided) are returned.
 */
export function mintDeltas(
  pre: TokenBalance[] | null | undefined,
  post: TokenBalance[] | null | undefined,
  tracked?: Set<string>,
): MintDelta[] {
  const sum = new Map<string, bigint>();
  for (const b of post ?? []) sum.set(b.mint, (sum.get(b.mint) ?? 0n) + BigInt(b.uiTokenAmount.amount));
  for (const b of pre ?? []) sum.set(b.mint, (sum.get(b.mint) ?? 0n) - BigInt(b.uiTokenAmount.amount));
  const out: MintDelta[] = [];
  for (const [mint, delta] of sum) {
    if (delta === 0n) continue;
    if (tracked && !tracked.has(mint)) continue;
    out.push({ mint, delta });
  }
  return out;
}

/**
 * Program IDs touched by a tx (top-level + inner instructions), restricted to
 * the indexed set. Used to record which programs a tx is relevant to.
 */
export function touchedPrograms(accountKeys: string[], instructionProgramIdxs: number[], indexed: Set<string>): string[] {
  const seen = new Set<string>();
  for (const idx of instructionProgramIdxs) {
    const key = accountKeys[idx];
    if (key && indexed.has(key)) seen.add(key);
  }
  return [...seen];
}
