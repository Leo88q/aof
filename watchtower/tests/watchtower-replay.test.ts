/** Replay/backfill guarantees: determinism, stable ids, cursor round-trip, dedup under re-processing. */
import assert from "node:assert/strict";
import { normalizeChainEvent, normalizeChainTx } from "../src/event-normalizer";
import { encodeCursor, decodeCursor } from "../src/read-model";
import { EVENTS, TXS, SALT, W } from "./_fixtures";

// 1. Same input → byte-identical output across runs and shuffles.
const run = (rows: typeof EVENTS) => rows.flatMap((e) => normalizeChainEvent(e, SALT, { treasury: W.treasury }));
const a = run(EVENTS), b = run([...EVENTS].reverse()).sort((x, y) => x.eventId.localeCompare(y.eventId));
assert.equal(JSON.stringify(a.slice().sort((x, y) => x.eventId.localeCompare(y.eventId))), JSON.stringify(b));
// 2. eventIds unique; replaying the same batch twice dedupes to the same set.
const ids = a.map((e) => e.eventId);
assert.equal(new Set(ids).size, ids.length, "eventIds must be unique within a batch");
const replayed = new Map<string, unknown>();
for (const e of [...a, ...run(EVENTS), ...TXS.flatMap((t) => normalizeChainTx(t, SALT))]) replayed.set(e.eventId, e);
assert.equal(replayed.size, ids.length + TXS.length, "replay is idempotent by eventId");
// 3. Two different events in one tx keep distinct ids via eventIndex.
const sameTx = normalizeChainEvent({ ...EVENTS[0], eventIndex: 1 }, SALT);
assert.notEqual(sameTx[0].eventId, run([EVENTS[0]])[0].eventId);
// 4. Cursor round-trips and rejects garbage.
const c = { slot: 400_000_003n, signature: EVENTS[2].signature, eventIndex: 0 };
assert.deepEqual(decodeCursor(encodeCursor(c)), c);
assert.equal(decodeCursor(undefined), null);
assert.throws(() => decodeCursor(Buffer.from("not:a").toString("base64url")));
assert.throws(() => decodeCursor(Buffer.from("x:y:z").toString("base64url")));
// 5. Ordering key is (slot, signature, eventIndex) with tx-level events first (-1).
const txEv = normalizeChainTx(TXS[0], SALT)[0];
assert.equal(txEv.source.eventIndex, -1);
console.log("watchtower-replay: determinism, id stability, idempotent replay, cursor round-trip passed");
