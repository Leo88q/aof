import assert from "node:assert/strict";
import { issuanceJournal, type JournalTx } from "../src/issuance-journal";
import { resourceIssuanceJournal, type ReadModelDeps } from "../src/read-model";
import { EVENTS, SALT, W } from "./_fixtures";

const event = EVENTS.find(e => e.eventType === "ResourceIssued")!;
const d = event.data as Record<string, unknown>;
const base: JournalTx = { signature: event.signature, slot: BigInt(event.slot), success: true,
  events: [{ ...event }], mintDeltas: [{ mint: d.mint as string, delta: d.gross as string }] };
const opts = { coreProgramId: event.programId, salt: SALT };
const clone = (): JournalTx => ({ ...base, events: base.events.map(e => ({ ...e, data: { ...d } })), mintDeltas: base.mintDeltas.map(m => ({ ...m })) });
const project = (tx = base) => issuanceJournal([tx], opts);

const report = project();
assert.equal(report.dataQuality, "partial");
assert.equal(report.journals.length, 1);
assert.equal(report.reconciliation[0].status, "matched");
assert.equal(report.walletBalances, null);
assert.equal(report.openingBalances, null);
assert.equal(report.writes, false);
assert.equal(report.journals[0].postings.reduce((n, p) => n + BigInt(p.amount), 0n), 0n);
assert.ok(!JSON.stringify(report).includes(W.bob), "raw wallet leaked");
const replay = issuanceJournal([base, clone(), base], opts);
assert.deepEqual(replay.journals, report.journals);
assert.deepEqual(replay.movements, report.movements);
assert.equal(replay.duplicateTransactions, 2);
// JSON property order is not event identity.
const reordered = clone(); reordered.events[0].data = Object.fromEntries(Object.entries(d).reverse());
assert.deepEqual(issuanceJournal([base, reordered], opts).journals, report.journals);
const storageMetadata = clone(); (storageMetadata.events[0] as any).id = "new-row-id-after-rebuild";
assert.deepEqual(issuanceJournal([base, storageMetadata], opts).journals, report.journals);
// Event order must not alter a reconstructed journal.
// Conflicting source may not be accepted by first-write-wins, in either order.
const conflict = clone(); (conflict.events[0].data as any).fee = "1";
for (const rows of [[base, conflict], [conflict, base]]) {
  const r = issuanceJournal(rows, opts);
  assert.equal(r.journals.length, 0); assert.equal(r.rejected[0].reason, "invalid_or_conflicting_source");
}
const failed = clone(); failed.success = false;
assert.equal(project(failed).journals.length, 0);
assert.equal(project(failed).failedTransactions, 1);
assert.equal(issuanceJournal([base], { ...opts, salt: "" }).dataQuality, "unavailable");
for (const [field, value] of [
  ["gross", -1], ["gross", "-1"], ["gross", "1.5"], ["gross", "01"], ["gross", "1e9"],
  ["gross", Number.MAX_SAFE_INTEGER + 1], ["gross", "18446744073709551616"], ["fee", "5000000001"],
  ["fee", null], ["mintedInEpoch", "1"], ["capPerEpoch", "0"], ["epochStartSlot", "18446744073709551615"],
  ["slot", "1"], ["recipient", "not-a-wallet"],
] as const) {
  const tx = clone(); (tx.events[0].data as any)[field] = value;
  const r = project(tx); assert.equal(r.journals.length, 0, field); assert.equal(r.rejected.length, 1, field);
}
for (const mutate of [
  (tx: JournalTx) => { tx.events[0].programId = W.alice; },
  (tx: JournalTx) => { tx.events[0].signature = "other"; },
  (tx: JournalTx) => { tx.events[0].success = false; },
  (tx: JournalTx) => { tx.events[0].eventIndex = -1; },
  (tx: JournalTx) => { tx.events.push(tx.events[0]); },
  (tx: JournalTx) => { tx.mintDeltas.push(tx.mintDeltas[0]); },
]) {
  const tx = clone(); mutate(tx);
  assert.equal(project(tx).journals.length, 0);
  assert.equal(project(tx).rejected.length, 1);
}
const missing = clone(); missing.mintDeltas = [];
assert.equal(project(missing).reconciliation[0].status, "missing_observation");
assert.equal(project(missing).journals.length, 0);
const mismatch = clone(); mismatch.mintDeltas[0].delta = "1";
assert.equal(project(mismatch).reconciliation[0].status, "mismatch");
assert.equal(project(mismatch).journals.length, 0);
// Multiple same-mint events must reconcile jointly, not each to the tx total.
const multi = clone(); multi.events.push({ ...multi.events[0], eventIndex: 1 });
multi.mintDeltas[0].delta = (2n * BigInt(d.gross as string)).toString();
assert.equal(project(multi).journals.length, 2);
assert.equal(project(multi).reconciliation.length, 1);
assert.deepEqual(project({ ...multi, events: [...multi.events].reverse() }).journals, project(multi).journals);
const unrelated = clone(); unrelated.events[0].eventType = "UnknownEconomicEvent";
assert.equal(project(unrelated).journals.length, 0);
assert.equal(project(unrelated).reconciliation[0].status, "unmapped");
assert.equal(project(unrelated).unmappedEvents.UnknownEconomicEvent, 1);

// Deterministic full-u64 property loop: exact gross=net+fee, even above 2^53.
let seed = 0xc072026n;
const max = (1n << 64n) - 1n;
const next = () => { seed ^= seed << 13n; seed ^= seed >> 7n; seed ^= seed << 17n; seed &= max; return seed; };
for (let i = 0; i < 10_000; i++) {
  const gross = i === 0 ? max : next() || 1n;
  const fee = next() % (gross + 1n);
  const tx = clone();
  Object.assign(tx.events[0].data as any, { gross: gross.toString(), fee: fee.toString(), mintedInEpoch: gross.toString(), capPerEpoch: max.toString() });
  tx.mintDeltas[0].delta = gross.toString();
  const r = project(tx);
  assert.equal(r.journals.length, 1);
  const postings = r.journals[0].postings.map(p => BigInt(p.amount));
  assert.equal(postings.reduce((n, p) => n + p, 0n), 0n);
  assert.equal(postings[1] + postings[2], gross);
  assert.ok(postings[1] >= 0n && postings[2] >= 0n);
}

async function boundedReadModel() {
  let query: any;
  const deps = { salt: SALT, db: { chainTx: { findMany: async (q: any) => { query = q; return Array.from({ length: 201 }, () => base); } } } } as unknown as ReadModelDeps;
  const result = await resourceIssuanceJournal(deps, new Date(0));
  assert.equal(query.take, 201);
  assert.deepEqual(query.include, { events: { orderBy: { eventIndex: "asc" } }, mintDeltas: true });
  assert.equal(result.transactionLimit, 200);
  assert.equal(result.truncated, true);
  assert.equal(result.duplicateTransactions, 199);
  console.log("watchtower-journal: 10000 integer properties; replay/conflict/rollback/quarantine/privacy and bounded DB query passed");
}
boundedReadModel().catch(e => { console.error(e); process.exitCode = 1; });
