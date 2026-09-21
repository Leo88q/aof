/** Normalizer semantics: mapping, fan-out, hashing, ignore list, schema validity. */
import assert from "node:assert/strict";
import { normalizeChainEvent, normalizeChainTx, hashPlayer, UNSUPPORTED, SUPPORTED_NATIVE, EVENT_TYPES } from "../src/event-normalizer";
import { validateEvents } from "../src/event-decoder";
import { EVENTS, TXS, W, M, SALT } from "./_fixtures";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const by = (t: string) => EVENTS.find((e) => e.eventType === t)!;
const alice = hashPlayer(W.alice, SALT), bob = hashPlayer(W.bob, SALT);

// ListingSold fans out to purchase + settlement + transfer with correct roles.
{
  const out = normalizeChainEvent(by("ListingSold"), SALT);
  assert.deepEqual(out.map((e) => e.type), ["PurchaseCompleted", "PaymentSettled", "AssetTransferred"]);
  assert.equal(out[0].playerId, bob); assert.equal(out[0].counterpartyId, alice); assert.equal(out[0].amount, "250000000"); assert.equal(out[0].currency, "SOL_LAMPORTS");
  assert.equal(out[1].playerId, alice); assert.equal(out[2].asset, M.tool1);
  assert.deepEqual(out.map((e) => e.eventId), out.map((_, i) => `${by("ListingSold").signature}:0:${i}`));
}
// ResourceIssued: reward + mint + treasury fee leg; fee=0 suppresses the treasury leg.
{
  const out = normalizeChainEvent(by("ResourceIssued"), SALT, { treasury: W.treasury });
  assert.deepEqual(out.map((e) => e.type), ["RewardClaimed", "TokenMinted", "TreasuryDeposited"]);
  assert.equal(out[0].playerId, bob); assert.equal(out[2].amount, "400000000"); assert.equal(out[2].playerId, null);
  const noFee = normalizeChainEvent({ ...by("ResourceIssued"), data: { ...(by("ResourceIssued").data as any), fee: "0" } }, SALT);
  assert.deepEqual(noFee.map((e) => e.type), ["RewardClaimed", "TokenMinted"]);
}
// Cap halt is surfaced as ConfigUpdated with halted=true.
{
  const [cfg] = normalizeChainEvent(by("IssuanceCapChanged"), SALT);
  assert.equal(cfg.type, "ConfigUpdated"); assert.equal(cfg.category, "security"); assert.equal(cfg.attributes.halted, true); assert.equal(cfg.playerId, null);
}
// Pause switch → PausedToggled + EmergencyPause (only when paused=true); mint swap lists changed slots.
{
  const p = normalizeChainEvent(by("PausedToggled"), SALT);
  assert.deepEqual(p.map((e) => e.type), ["PausedToggled", "EmergencyPause"]);
  assert.equal(p[0].attributes.paused, true); assert.equal(p[0].playerId, null);
  const un = normalizeChainEvent({ ...by("PausedToggled"), data: { ...(by("PausedToggled").data as any), paused: false } }, SALT);
  assert.deepEqual(un.map((e) => e.type), ["PausedToggled"]);
  const [m] = normalizeChainEvent(by("ResourceMintsUpdated"), SALT);
  assert.deepEqual(m.attributes.changed, ["potato"]); assert.equal(m.category, "security");
}
// Crafting burns the input and creates the output.
{
  const out = normalizeChainEvent(by("ToolCrafted"), SALT);
  assert.deepEqual(out.map((e) => [e.type, e.asset]), [["CraftCompleted", M.tool2], ["AssetCreated", M.tool2], ["TokenBurned", M.tool1]]);
}
// Ignored events produce nothing; unknown events produce nothing (never guess).
assert.equal(normalizeChainEvent(by("AuctionCreated"), SALT).length, 0);
assert.equal(normalizeChainEvent({ ...by("Staked"), eventType: "SomethingNew" }, SALT).length, 0);
// Raw wallets never appear anywhere in the output.
{
  const all = EVENTS.flatMap((e) => normalizeChainEvent(e, SALT, { treasury: W.treasury }));
  const blob = JSON.stringify(all);
  for (const w of Object.values(W)) assert.ok(!blob.includes(w), `raw wallet leaked: ${w}`);
  // 12 mapped fixtures (AuctionCreated ignored) → 2+1+3+3+3+1+2+2+2+3+1+1 +2 (pause) +1 (mints) = 27 normalized events
  assert.equal(all.length, 27, `fan-out count changed: ${all.map((e) => e.type).join(",")}`);
  assert.deepEqual(validateEvents(all), [], "every normalized event validates against events/schema.json");
}
// Tx-level reliability events.
{
  const ok = normalizeChainTx(TXS[0], SALT), bad = normalizeChainTx(TXS[1], SALT);
  assert.equal(ok[0].type, "TransactionFinalized"); assert.equal(bad[0].type, "TransactionFailed");
  assert.deepEqual(bad[0].attributes.error, { InstructionError: [0, { Custom: 6099 }] });
  assert.deepEqual(validateEvents([...ok, ...bad]), []);
}
// Hash is salt-dependent (cross-game join requires the shared salt).
assert.notEqual(hashPlayer(W.alice, "a"), hashPlayer(W.alice, "b"));
assert.match(hashPlayer(W.alice, SALT), /^[0-9a-f]{64}$/);
// event-types.json is in sync with the normalizer's support tables and the spec's 50 types.
{
  const catalog = JSON.parse(readFileSync(join(__dirname, "..", "events", "event-types.json"), "utf8"));
  assert.equal(catalog.types.length, 50); assert.equal(EVENT_TYPES.length, 50);
  for (const t of catalog.types) {
    const expected = t.name in SUPPORTED_NATIVE ? "native" : UNSUPPORTED.includes(t.name) ? "unsupported" : "derived";
    assert.equal(t.support, expected, `${t.name} support drifted; regenerate events/event-types.json`);
  }
  // Every AOF IDL event is either mapped or explicitly ignored in the normalizer.
  const src = readFileSync(join(__dirname, "..", "src", "event-normalizer.ts"), "utf8");
  for (const f of ["aof_core", "aof_market", "aof_quests"]) {
    const idl = JSON.parse(readFileSync(join(__dirname, "..", "..", "aof_backend", "src", "idl", `${f}.json`), "utf8"));
    for (const ev of idl.events) assert.ok(src.includes(`"${ev.name}"`), `IDL event ${ev.name} (${f}) is neither mapped nor listed as ignored`);
  }
}
console.log("watchtower-events: mapping, fan-out, hashing, ignore list, schema, catalog sync passed");
