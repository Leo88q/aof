/**
 * Chain indexer: on-chain event ledger for aof_core, aof_market, aof_quests.
 *
 * Two loops per program, both driven by getSignaturesForAddress(programId):
 *   forward  — new signatures since IndexerCursor.newestSignature (every
 *              FORWARD_INTERVAL_MS), processed oldest→newest so a crash leaves
 *              the cursor on the last fully written tx.
 *   backfill — pages older than IndexerCursor.oldestSignature until the RPC
 *              returns a short page (history exhausted) → backfillComplete.
 *
 * Only `finalized` transactions are read: no reorg handling is needed and a
 * signature is indexed at most once (ChainTx PK, ChainEvent unique
 * (signature,eventIndex), ChainMintDelta unique (signature,mint)).
 *
 * Writes per tx are one Prisma transaction, so the ledger never contains a
 * tx row without its events. Re-running over an already indexed range is a
 * no-op.
 *
 * Run:  node dist-workers/services/chain-indexer/index.js
 * Env:  RPC_URL (required), FORWARD_INTERVAL_MS (default 15s),
 *       BACKFILL_ENABLED (default true), BACKFILL_PAGE (default 200),
 *       INDEXER_HEALTH_PORT (default 8082, 0 = disabled), WALLET_HASH_SALT
 */
import { Connection, PublicKey, VersionedTransactionResponse } from "@solana/web3.js";
import { PrismaClient } from "@prisma/client";
import { createServer } from "http";
import coreIdl from "../../src/idl/aof_core.json";
import marketIdl from "../../src/idl/aof_market.json";
import questsIdl from "../../src/idl/aof_quests.json";
import { EventDecoder, IndexedProgram, mintDeltas, touchedPrograms } from "../../src/lib/chainIndexerCore";

const RPC_URL = process.env.RPC_URL;
if (!RPC_URL) throw new Error("[chain-indexer] RPC_URL is required");
if (process.env.NODE_ENV === "production" && /devnet|localhost|127\.0\.0\.1/i.test(RPC_URL)) {
  throw new Error("[chain-indexer] Production requires a non-devnet RPC_URL");
}

const FORWARD_INTERVAL_MS = Number(process.env.FORWARD_INTERVAL_MS) > 0 ? Number(process.env.FORWARD_INTERVAL_MS) : 15_000;
const BACKFILL_ENABLED = (process.env.BACKFILL_ENABLED ?? "true") !== "false";
const BACKFILL_PAGE = Math.min(1000, Number(process.env.BACKFILL_PAGE) > 0 ? Number(process.env.BACKFILL_PAGE) : 200);
const HEALTH_PORT = Number(process.env.INDEXER_HEALTH_PORT ?? 8082);
const TX_BATCH = 25;               // getTransaction fan-out per round
const MAX_FORWARD_PAGES = 20;      // 20k signatures per forward pass; the rest next tick

const PROGRAMS: IndexedProgram[] = [
  { programId: (coreIdl as any).address, name: "aof_core", idl: coreIdl as any },
  { programId: (marketIdl as any).address, name: "aof_market", idl: marketIdl as any },
  { programId: (questsIdl as any).address, name: "aof_quests", idl: questsIdl as any },
];
const INDEXED = new Set(PROGRAMS.map((p) => p.programId));

const connection = new Connection(RPC_URL, "finalized");
const db = new PrismaClient();
const decoder = new EventDecoder(PROGRAMS);

const state = {
  startedAt: Date.now(),
  lastForwardAt: 0,
  lastError: null as string | null,
  forwardRunning: false,
  backfillRunning: false,
};

function log(msg: string, extra?: unknown) {
  console.log(`[chain-indexer] ${msg}`, extra === undefined ? "" : JSON.stringify(extra));
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

async function alreadyIndexed(signatures: string[]): Promise<Set<string>> {
  if (signatures.length === 0) return new Set();
  const rows = await db.chainTx.findMany({ where: { signature: { in: signatures } }, select: { signature: true } });
  return new Set(rows.map((r) => r.signature));
}

async function persistTx(signature: string, tx: VersionedTransactionResponse): Promise<number> {
  const meta = tx.meta;
  const success = !meta?.err;
  const keys = tx.transaction.message.getAccountKeys({ accountKeysFromLookups: meta?.loadedAddresses ?? undefined });
  const accountKeys = keys.keySegments().flat().map((k) => k.toBase58());
  const feePayer = accountKeys[0] ?? "";
  const ixProgramIdxs: number[] = tx.transaction.message.compiledInstructions.map((ix) => ix.programIdIndex);
  for (const inner of meta?.innerInstructions ?? []) for (const ix of inner.instructions) ixProgramIdxs.push(ix.programIdIndex);
  const programIds = touchedPrograms(accountKeys, ixProgramIdxs, INDEXED);
  const blockTime = tx.blockTime ? new Date(tx.blockTime * 1000) : null;
  const slot = BigInt(tx.slot);

  // Events are only in logs of successful txs (Anchor emits after the
  // instruction body); failed txs still get a ChainTx row for failure-rate
  // metrics.
  const events = success ? decoder.decode(meta?.logMessages) : [];
  const deltas = success ? mintDeltas(meta?.preTokenBalances as any, meta?.postTokenBalances as any) : [];

  await db.$transaction(async (trx) => {
    await trx.chainTx.upsert({
      where: { signature },
      update: {},
      create: {
        signature, slot, blockTime, success, feePayer,
        programIds: JSON.stringify(programIds),
        errorJson: meta?.err ? JSON.stringify(meta.err) : null,
      },
    });
    for (const ev of events) {
      await trx.chainEvent.upsert({
        where: { signature_eventIndex: { signature, eventIndex: ev.eventIndex } },
        update: {},
        create: {
          signature, eventIndex: ev.eventIndex, slot, blockTime,
          programId: ev.programId, eventType: ev.eventType,
          wallet: ev.wallet, walletHash: ev.walletHash, mint: ev.mint, amount: ev.amount,
          success, data: JSON.stringify(ev.data),
        },
      });
    }
    for (const d of deltas) {
      await trx.chainMintDelta.upsert({
        where: { signature_mint: { signature, mint: d.mint } },
        update: {},
        create: { signature, mint: d.mint, delta: d.delta.toString(), blockTime, slot },
      });
    }
  });
  return events.length;
}

/** Fetch + persist a list of signatures (any order). Returns count written. */
async function indexSignatures(signatures: string[]): Promise<number> {
  const seen = await alreadyIndexed(signatures);
  const todo = signatures.filter((s) => !seen.has(s));
  let written = 0;
  for (let i = 0; i < todo.length; i += TX_BATCH) {
    const batch = todo.slice(i, i + TX_BATCH);
    const txs = await connection.getTransactions(batch, { maxSupportedTransactionVersion: 0, commitment: "finalized" });
    for (let j = 0; j < batch.length; j++) {
      const tx = txs[j];
      if (!tx) {
        // Not finalized yet or pruned by the RPC. Forward sync will see it
        // again (cursor is not advanced past a gap); backfill treats it as gone.
        log("tx unavailable, skipping for now", { signature: batch[j] });
        continue;
      }
      await persistTx(batch[j], tx);
      written += 1;
    }
  }
  return written;
}

// ---------------------------------------------------------------------------
// Forward sync
// ---------------------------------------------------------------------------

async function forwardSync(p: IndexedProgram): Promise<void> {
  const cursor = await db.indexerCursor.findUnique({ where: { programId: p.programId } });
  const until = cursor?.newestSignature ?? undefined;
  const address = new PublicKey(p.programId);

  // Newest → oldest pages until we hit `until`.
  const collected: { signature: string; slot: number }[] = [];
  let before: string | undefined;
  for (let page = 0; page < MAX_FORWARD_PAGES; page++) {
    const infos = await connection.getSignaturesForAddress(address, { until, before, limit: 1000 }, "finalized");
    if (infos.length === 0) break;
    for (const s of infos) collected.push({ signature: s.signature, slot: s.slot });
    if (infos.length < 1000) break;
    before = infos[infos.length - 1].signature;
  }
  if (collected.length === 0) return;

  // Oldest first so the cursor only ever points at a fully written prefix.
  collected.reverse();
  let written = 0;
  for (let i = 0; i < collected.length; i += 200) {
    const chunk = collected.slice(i, i + 200);
    written += await indexSignatures(chunk.map((c) => c.signature));
    const last = chunk[chunk.length - 1];
    await db.indexerCursor.upsert({
      where: { programId: p.programId },
      update: { newestSignature: last.signature, newestSlot: BigInt(last.slot), txIndexed: { increment: written }, lastError: null,
        // First run: the oldest signature we saw is also where backfill starts.
        ...(cursor?.oldestSignature ? {} : { oldestSignature: collected[0].signature }) },
      create: { programId: p.programId, newestSignature: last.signature, newestSlot: BigInt(last.slot), oldestSignature: collected[0].signature, txIndexed: written },
    });
    written = 0;
  }
  log(`forward ${p.name}: +${collected.length} signatures`);
}

// ---------------------------------------------------------------------------
// Backfill
// ---------------------------------------------------------------------------

async function backfillStep(p: IndexedProgram): Promise<boolean> {
  const cursor = await db.indexerCursor.findUnique({ where: { programId: p.programId } });
  if (!cursor?.oldestSignature || cursor.backfillComplete) return false;
  const infos = await connection.getSignaturesForAddress(new PublicKey(p.programId), { before: cursor.oldestSignature, limit: BACKFILL_PAGE }, "finalized");
  if (infos.length > 0) {
    const written = await indexSignatures(infos.map((s) => s.signature));
    await db.indexerCursor.update({
      where: { programId: p.programId },
      data: { oldestSignature: infos[infos.length - 1].signature, txIndexed: { increment: written } },
    });
  }
  const done = infos.length < BACKFILL_PAGE;
  if (done) {
    await db.indexerCursor.update({ where: { programId: p.programId }, data: { backfillComplete: true } });
    log(`backfill ${p.name}: complete`);
  } else {
    log(`backfill ${p.name}: -${infos.length} signatures`);
  }
  return !done;
}

// ---------------------------------------------------------------------------
// Loops
// ---------------------------------------------------------------------------

async function forwardLoop(): Promise<void> {
  if (state.forwardRunning) return;
  state.forwardRunning = true;
  try {
    for (const p of PROGRAMS) {
      try { await forwardSync(p); }
      catch (e: any) {
        state.lastError = `${p.name}: ${e?.message || e}`;
        await db.indexerCursor.upsert({ where: { programId: p.programId }, update: { lastError: state.lastError }, create: { programId: p.programId, lastError: state.lastError } }).catch(() => {});
        log(`forward ${p.name} failed`, state.lastError);
      }
    }
    state.lastForwardAt = Date.now();
  } finally {
    state.forwardRunning = false;
  }
}

async function backfillLoop(): Promise<void> {
  if (!BACKFILL_ENABLED) return;
  state.backfillRunning = true;
  try {
    // Round-robin until every program reports exhaustion; then stop.
    let anyLeft = true;
    while (anyLeft) {
      anyLeft = false;
      for (const p of PROGRAMS) {
        try { if (await backfillStep(p)) anyLeft = true; }
        catch (e: any) { state.lastError = `${p.name} backfill: ${e?.message || e}`; log(state.lastError); await new Promise((r) => setTimeout(r, 5000)); anyLeft = true; }
      }
      await new Promise((r) => setTimeout(r, 500)); // be polite to the RPC
    }
  } finally {
    state.backfillRunning = false;
  }
}

function startHealthServer(): void {
  if (!HEALTH_PORT) return;
  createServer(async (_req, res) => {
    const cursors = await db.indexerCursor.findMany().catch(() => []);
    const stale = state.lastForwardAt > 0 && Date.now() - state.lastForwardAt > FORWARD_INTERVAL_MS * 4;
    const body = {
      ok: !stale, stale, uptimeSec: Math.round((Date.now() - state.startedAt) / 1000),
      lastForwardAt: state.lastForwardAt ? new Date(state.lastForwardAt).toISOString() : null,
      backfillRunning: state.backfillRunning, lastError: state.lastError,
      cursors: cursors.map((c) => ({ ...c, newestSlot: c.newestSlot?.toString() ?? null })),
    };
    res.writeHead(stale ? 503 : 200, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  }).listen(HEALTH_PORT, "0.0.0.0", () => log(`health on :${HEALTH_PORT}`));
}

async function main(): Promise<void> {
  const expected = process.env.EXPECTED_GENESIS_HASH;
  if (expected && (await connection.getGenesisHash()) !== expected) {
    throw new Error("[chain-indexer] RPC genesis hash does not match EXPECTED_GENESIS_HASH");
  }
  log("start", { programs: PROGRAMS.map((p) => `${p.name}=${p.programId}`), forwardIntervalMs: FORWARD_INTERVAL_MS, backfill: BACKFILL_ENABLED });
  startHealthServer();
  await forwardLoop();
  setInterval(() => void forwardLoop(), FORWARD_INTERVAL_MS);
  void backfillLoop();
}

main().catch((e) => { console.error("[chain-indexer] fatal:", e); process.exit(1); });
