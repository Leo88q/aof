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
// Initialization is distinct from a purchase; this event is telemetry only.
{
  const [initialized] = normalizeChainEvent({
    ...by("Staked"),
    eventType: "SeasonPassInitialized",
    wallet: W.alice,
    data: { owner: W.alice, season_id: "7" },
  }, SALT);
  assert.equal(initialized.type, "ConfigUpdated");
  assert.equal(initialized.playerId, alice);
  assert.equal(initialized.attributes.setting, "season_pass_initialized");
  assert.equal(initialized.attributes.seasonId, "7");
  assert.deepEqual(validateEvents([initialized]), []);
  assert.ok(!JSON.stringify(initialized).includes(W.alice));
}
// sync_tool_owner updates the ToolData cache, not the SPL transfer itself.
// It is security telemetry and must never be mislabeled as an asset transfer.
{
  const [synced] = normalizeChainEvent({
    ...by("Staked"),
    eventType: "ToolOwnershipSynced",
    wallet: W.bob,
    mint: M.tool1,
    data: {
      mint: M.tool1,
      previous_owner: W.alice,
      previous_operator: W.alice,
      new_owner: W.bob,
      slot: "400000020",
    },
  }, SALT);
  assert.equal(synced.type, "ConfigUpdated");
  assert.equal(synced.category, "security");
  assert.equal(synced.playerId, bob);
  assert.equal(synced.asset, M.tool1);
  assert.deepEqual(synced.attributes, {
    setting: "tool_ownership_cache_sync",
    previousOwner: alice,
    previousOperator: alice,
    slot: "400000020",
  });
  assert.deepEqual(validateEvents([synced]), []);
  assert.ok(!JSON.stringify(synced).includes(W.alice));
  assert.ok(!JSON.stringify(synced).includes(W.bob));
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
// Historical issuance baselines are visible as configuration telemetry without
// converting the lifetime total into a mint/reward event or a player action.
{
  const [baseline] = normalizeChainEvent({
    ...by("IssuanceCapChanged"),
    eventType: "IssuanceLifetimeBaselineSet",
    mint: M.mind,
    data: {
      kind: 26,
      mint: M.mind,
      previous: "18446744073709551617",
      baseline: "18446744073709551618",
      slot: "400000007",
    },
  }, SALT);
  assert.equal(baseline.type, "ConfigUpdated");
  assert.equal(baseline.category, "security");
  assert.equal(baseline.playerId, null);
  assert.equal(baseline.asset, M.mind);
  assert.deepEqual(baseline.attributes, {
    setting: "issuance_lifetime_baseline",
    kind: "26",
    previous: "18446744073709551617",
    baseline: "18446744073709551618",
    slot: "400000007",
  });
  assert.deepEqual(validateEvents([baseline]), []);
}
// Premium reward claims are attributed to the player, but no amount/mint is
// fabricated because neither is present in the on-chain event payload.
{
  const [reward] = normalizeChainEvent({
    ...by("IssuanceCapChanged"),
    eventType: "SeasonPremiumRewardClaimed",
    wallet: W.alice,
    data: { owner: W.alice, season_id: "9", level: 6 },
  }, SALT);
  assert.equal(reward.type, "RewardGranted");
  assert.equal(reward.category, "economy");
  assert.equal(reward.playerId, alice);
  assert.equal(reward.amount, null);
  assert.equal(reward.asset, null);
  assert.deepEqual(reward.attributes, { source: "season_premium", seasonId: "9", level: "6" });
  assert.deepEqual(validateEvents([reward]), []);
  assert.ok(!JSON.stringify(reward).includes(W.alice));
}
// Pause switch → PausedToggled + EmergencyPause (only when paused=true); mint swap lists changed slots.
{
  const p = normalizeChainEvent(by("PausedToggled"), SALT);
  assert.deepEqual(p.map((e) => e.type), ["PausedToggled", "EmergencyPause"]);
  assert.equal(p[0].attributes.paused, true); assert.equal(p[0].playerId, null);
  const un = normalizeChainEvent({ ...by("PausedToggled"), data: { ...(by("PausedToggled").data as any), paused: false } }, SALT);
  assert.deepEqual(un.map((e) => e.type), ["PausedToggled"]);
  const [m] = normalizeChainEvent(by("ResourceMintsUpdated"), SALT);
  assert.deepEqual(m.attributes.changed, ["mind"]); assert.equal(m.category, "security");
}
// Crafting burns the input and creates the output.
{
  const out = normalizeChainEvent(by("ToolCrafted"), SALT);
  assert.deepEqual(out.map((e) => [e.type, e.asset]), [["CraftCompleted", M.tool2], ["AssetCreated", M.tool2], ["TokenBurned", M.tool1]]);
}
// Ignored events produce nothing; unknown events produce nothing (never guess).
assert.equal(normalizeChainEvent(by("AuctionCreated"), SALT).length, 0);
assert.equal(normalizeChainEvent({ ...by("Staked"), eventType: "SomethingNew" }, SALT).length, 0);
// V2 external MIND is never merged with MIND/resource events. Preserve the
// actual SPL mint and atomic units, and never invent a jackpot liability amount
// absent from the on-chain event.
{
  const base = { ...by("Staked"), eventType: "MindSpinCommitted", wallet: W.alice, mint: null,
    data: { user: W.alice, mint: M.tool2, commit: M.tool1, price_atoms: "5000000000", seed_slot: "123" } };
  const [created] = normalizeChainEvent(base, SALT);
  assert.equal(created.type, "LiabilityCreated");
  assert.equal(created.playerId, alice);
  assert.equal(created.asset, M.tool2);
  assert.notEqual(created.asset, M.mind); // historical fixture mint is MIND, not an external MIND alias
  assert.equal(created.currency, "MIND_ATOMS");
  assert.equal(created.amount, null);
  assert.equal(created.attributes.priceAtoms, "5000000000");
  assert.equal(created.attributes.liability, "mind_spin_v2");
  const [settled] = normalizeChainEvent({ ...base, eventType: "MindSpinRevealed",
    data: { ...base.data, prize_atoms: "50000000000" } }, SALT);
  assert.equal(settled.type, "LiabilitySettled");
  assert.equal(settled.amount, "50000000000");
  assert.equal(settled.attributes.outcome, "settled");
  const [refunded] = normalizeChainEvent({ ...base, eventType: "MindSpinRefunded",
    data: { ...base.data, amount_atoms: "5000000000" } }, SALT);
  assert.equal(refunded.amount, "5000000000");
  assert.equal(refunded.attributes.outcome, "refund");
  assert.deepEqual(validateEvents([created, settled, refunded]), []);
  assert.ok(!JSON.stringify([created, settled, refunded]).includes(W.alice));
}
// [§3.4] Перерождение: сброс сезона + сжигание излишка. Сброс виден как смена
// состояния сессии, излишек — как сжигание; при нулевом излишке ноги сжигания
// нет (никогда не показываем «сожгли 0» как событие экономики).
{
  const base = { ...by("Staked"), eventType: "RebirthReset", wallet: W.alice, mint: null,
    data: { user: W.alice, season_id: "3", xp_before: "4000", has_tent_before: true, burned_accounts: "2", burned_atoms: "1500" } };
  const out = normalizeChainEvent(base, SALT);
  assert.deepEqual(out.map((e) => e.type), ["ConfigUpdated", "TokenBurned"]);
  assert.equal(out[0].playerId, alice);
  assert.equal(out[0].attributes.setting, "rebirth_reset");
  assert.equal(out[0].attributes.seasonId, "3");
  assert.equal(out[1].amount, "1500");
  assert.equal(out[1].currency, "RESOURCE_ATOMS");
  const empty = normalizeChainEvent({ ...base, data: { ...base.data, burned_accounts: "0", burned_atoms: "0" } }, SALT);
  assert.deepEqual(empty.map((e) => e.type), ["ConfigUpdated"]);
  assert.deepEqual(validateEvents(out), []);
  assert.ok(!JSON.stringify(out).includes(W.alice));
  const [performed] = normalizeChainEvent({ ...base, eventType: "RebirthPerformed", data: { user: W.alice, generation: "2", rebirth_count: "1", permanent_bonus_bps: "250" } }, SALT);
  assert.equal(performed.type, "ConfigUpdated");
  assert.equal(performed.attributes.setting, "rebirth_performed");
  assert.equal(performed.attributes.permanentBonusBps, "250");
  assert.equal(performed.category, "security");
}
// Raw wallets never appear anywhere in the output.
{
  const all = EVENTS.flatMap((e) => normalizeChainEvent(e, SALT, { treasury: W.treasury }));
  const blob = JSON.stringify(all);
  for (const w of Object.values(W)) assert.ok(!blob.includes(w), `raw wallet leaked: ${w}`);
  // WalletConnected was removed: referral binding is not a client connection.
  assert.equal(all.length, 26, `fan-out count changed: ${all.map((e) => e.type).join(",")}`);
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
  assert.equal(catalog.types.length, 58); assert.equal(EVENT_TYPES.length, 58);
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

// Failed transaction logs describe rolled-back effects, never settled economics.
assert.deepEqual(normalizeChainEvent({ ...by("ListingSold"), success: false }, SALT), []);
const referral = normalizeChainEvent(by("ReferralBound"), SALT);
assert.deepEqual(referral.map(e => e.type), ["LiabilityCreated"]);
assert.equal(referral[0].eventId, `${by("ReferralBound").signature}:0:1`);

// Required farming contract: a mapped fixture or an explicit unavailable reason.
{
  const catalog = JSON.parse(readFileSync(join(__dirname, "../events/event-types.json"), "utf8"));
  const required = ["PlayerJoined", "WalletConnected", "PlotCreated", "PlotPlanted", "CropHarvested",
    "ResourceMinted", "ResourceBurned", "CraftCompleted", "MarketOrderPlaced", "MarketOrderCancelled",
    "RewardGranted", "TransactionFailed", "SecurityEvent"];
  const samples = [...EVENTS.flatMap(e => normalizeChainEvent(e, SALT)), ...TXS.flatMap(t => normalizeChainTx(t, SALT))];
  for (const name of required) {
    const entry = catalog.types.find((t: any) => t.name === name);
    assert.ok(entry, `missing required event ${name}`);
    if (entry.support === "unsupported") {
      assert.equal(entry.dataQuality, "unavailable"); assert.ok(entry.reason);
    } else {
      assert.ok(samples.some(e => e.type === name), `no mapped fixture for ${name}`);
    }
  }
}
