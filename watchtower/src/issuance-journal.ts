/** Replayable read-only double-entry projection of finalized ResourceIssued.
 * Durable source = indexer's ChainTx/ChainEvent/ChainMintDelta, not this report.
 * This is issuance flow accounting, NOT wallet balances or a full game ledger.
 */
import { createHash } from "node:crypto";
import { PublicKey } from "@solana/web3.js";
import { hashPlayer } from "./event-normalizer";

export type IssuanceEvent = {
  signature: string; eventIndex: number; programId: string; eventType: string;
  success: boolean; data: string | Record<string, unknown>;
};
export type JournalTx = {
  signature: string; slot: bigint | string; success: boolean;
  events: IssuanceEvent[]; mintDeltas: { mint: string; delta: string }[];
};
type Posting = { account: string; amount: string };
type Journal = { sourceId: string; signature: string; slot: string; mint: string; gross: string; fee: string; postings: Posting[] };
type Reconciliation = { signature: string; mint: string; expected: string | null; observed: string | null; status: string };
const MAX_U64 = (1n << 64n) - 1n;

// No JS Number -> BigInt conversion: unsafe numbers may already have rounded.
function uint(value: unknown): bigint {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]{0,19})$/.test(value)) throw new Error("invalid_integer");
  const n = BigInt(value);
  if (n > MAX_U64) throw new Error("integer_overflow");
  return n;
}
function signed(value: string): bigint {
  return value.startsWith("-") ? -uint(value.slice(1)) : uint(value);
}
function address(value: unknown): string {
  if (typeof value !== "string") throw new Error("invalid_address");
  try { if (new PublicKey(value).toBase58() === value) return value; } catch { /* fixed reason, no input leak */ }
  throw new Error("invalid_address");
}
function payload(event: IssuanceEvent): Record<string, unknown> {
  const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("invalid_payload");
  return data;
}
function stable(value: any): string {
  if (typeof value === "bigint") return JSON.stringify(value.toString());
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(",")}}`;
  return JSON.stringify(value);
}
function canonical(tx: JournalTx): string {
  return stable({ signature: tx.signature, slot: String(tx.slot), success: tx.success,
    events: tx.events.map(e => ({ signature: e.signature, eventIndex: e.eventIndex, programId: e.programId,
      eventType: e.eventType, success: e.success, data: payload(e) })).sort((a, b) => a.eventIndex - b.eventIndex),
    mintDeltas: [...tx.mintDeltas].sort((a, b) => a.mint.localeCompare(b.mint)),
  });
}

export function issuanceJournal(txs: JournalTx[], opts: { coreProgramId: string; salt: string; truncated?: boolean }) {
  const rejected: { signature: string; reason: string }[] = [];
  const journals: Journal[] = [];
  const reconciliation: Reconciliation[] = [];
  const unsupported = new Map<string, number>();
  const seen = new Map<string, { hash: string; tx: JournalTx }>();
  const conflicts = new Set<string>();
  let duplicates = 0;
  let failedTransactions = 0;
  // A conflicting replay invalidates BOTH versions, regardless of input order.
  for (const tx of txs) {
    try {
      const hash = createHash("sha256").update(canonical(tx)).digest("hex");
      const previous = seen.get(tx.signature);
      if (previous && previous.hash !== hash) conflicts.add(tx.signature);
      else if (previous) duplicates++;
      else seen.set(tx.signature, { hash, tx });
    } catch { conflicts.add(tx.signature); }
  }
  for (const signature of [...conflicts].sort()) rejected.push({ signature, reason: "invalid_or_conflicting_source" });
  const reasons = ["ResourceIssued only; craft, transfers, burns, auctions and lottery are not mapped",
    "Treasury fee account is a role, not an attested historical wallet address",
    "SPL net deltas are transaction observations, not independent mint-supply account snapshots"];
  if (!opts.salt) reasons.push("Shared player hash salt missing: identity projection disabled");
  if (opts.truncated) reasons.push("Bounded transaction sample; earlier history is not included");

  for (const { tx } of [...seen.values()].sort((a, b) => a.tx.signature.localeCompare(b.tx.signature))) {
    if (conflicts.has(tx.signature)) continue;
    if (!tx.success) { failedTransactions++; continue; }
    if (!opts.salt) continue;
    try {
      const slot = uint(String(tx.slot)).toString();
      const candidates: Journal[] = [];
      const eventKeys = new Set<number>();
      const observed = new Map<string, bigint>();
      for (const delta of tx.mintDeltas) {
        const mint = address(delta.mint);
        if (observed.has(mint)) throw new Error("duplicate_mint_observation");
        observed.set(mint, signed(delta.delta));
      }
      for (const event of tx.events) {
        if (!Number.isSafeInteger(event.eventIndex) || event.eventIndex < 0 || eventKeys.has(event.eventIndex)) throw new Error("invalid_event_index");
        eventKeys.add(event.eventIndex);
        if (event.signature !== tx.signature || !event.success) throw new Error("event_transaction_mismatch");
        if (event.eventType !== "ResourceIssued") {
          unsupported.set(event.eventType, (unsupported.get(event.eventType) ?? 0) + 1);
          continue;
        }
        if (event.programId !== opts.coreProgramId) throw new Error("untrusted_issuer");
        const d = payload(event);
        const mint = address(d.mint), recipient = address(d.recipient);
        const gross = uint(d.gross), fee = uint(d.fee);
        if (gross === 0n || fee > gross) throw new Error("invalid_fee_split");
        const minted = uint(d.mintedInEpoch), cap = uint(d.capPerEpoch);
        if (gross > minted || minted > cap || uint(d.epochStartSlot) > uint(d.slot) || uint(d.slot) !== BigInt(slot)) throw new Error("invalid_issuance_budget");
        candidates.push({ sourceId: `${event.programId}:${tx.signature}:${event.eventIndex}`, signature: tx.signature, slot, mint,
          gross: gross.toString(), fee: fee.toString(), postings: [
            { account: "source:issuance", amount: (-gross).toString() },
            { account: `player:${hashPlayer(recipient, opts.salt)}`, amount: (gross - fee).toString() },
            { account: "treasury:unattributed", amount: fee.toString() },
          ] });
      }
      const expected = new Map<string, bigint>();
      for (const j of candidates) expected.set(j.mint, (expected.get(j.mint) ?? 0n) + BigInt(j.gross));
      for (const mint of [...new Set([...observed.keys(), ...expected.keys()])].sort()) {
        const want = expected.get(mint), got = observed.get(mint);
        const status = want === undefined ? "unmapped" : got === undefined ? "missing_observation" : want === got ? "matched" : "mismatch";
        reconciliation.push({ signature: tx.signature, mint, expected: want?.toString() ?? null, observed: got?.toString() ?? null, status });
        // Quarantine mismatched source groups, never force them to balance by
        // inventing an adjustment entry. Other mints are independent units.
        if (status === "matched") journals.push(...candidates.filter(j => j.mint === mint));
      }
    } catch (e) {
      const allowed = ["invalid_integer", "integer_overflow", "invalid_address", "invalid_payload", "duplicate_mint_observation",
        "invalid_event_index", "event_transaction_mismatch", "untrusted_issuer", "invalid_fee_split", "invalid_issuance_budget"];
      rejected.push({ signature: tx.signature, reason: allowed.includes((e as Error).message) ? (e as Error).message : "invalid_source" });
    }
  }
  // Movement totals, deliberately NOT called on-chain/current wallet balances.
  const movement = new Map<string, { mint: string; account: string; amount: bigint }>();
  for (const j of journals) for (const p of j.postings) {
    const key = `${j.mint}:${p.account}`;
    const row = movement.get(key) ?? { mint: j.mint, account: p.account, amount: 0n };
    row.amount += BigInt(p.amount); movement.set(key, row);
  }
  return {
    version: "aof-issuance-journal-v1", writes: false, dataQuality: journals.length ? "partial" : "unavailable", reasons,
    scope: "finalized-indexer ResourceIssued flow projection, not an authoritative complete ledger",
    walletBalances: null, openingBalances: null,
    transactions: seen.size, duplicateTransactions: duplicates, failedTransactions,
    journals: journals.sort((a, b) => a.sourceId.localeCompare(b.sourceId)),
    reconciliation, rejected,
    unmappedEvents: Object.fromEntries([...unsupported].sort(([a], [b]) => a.localeCompare(b))),
    movements: [...movement].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => ({ ...v, amount: v.amount.toString() })),
  };
}
