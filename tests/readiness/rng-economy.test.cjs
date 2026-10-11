'use strict';
// [F-06] Economic invariants of the slot-hash mechanics, computed from the
// Rust constants by scripts/economy/rng-ev.mjs (the same functions that
// generate docs/ECONOMY_RNG_EV.md). Drum is deleted and is not in the report.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..', '..');
const load = () => import(pathToFileURL(path.join(root, 'scripts/economy/rng-ev.mjs')).href);

test('F-06 pack and reroll odds are complete tables without a Legendary roll', async () => {
  const ev = await load();
  const c = ev.readConstants();
  for (const odds of [...c.packs.map((p) => p.odds), c.rerollOdds]) {
    assert.equal(odds.length, 5);
    assert.equal(ev.sum(odds), 10_000, 'weights must sum to 10000 bps');
    assert.equal(odds[4], 0, 'Legendary is craft/fuse only, never a single roll');
    assert.ok(odds.every((w) => Number.isInteger(w) && w >= 0));
  }
  const stats = c.packs.map((p) => ev.packStats(c, p));
  for (let i = 1; i < stats.length; i++) {
    assert.ok(stats[i].price > stats[i - 1].price, 'packs are ordered by price');
    assert.ok(stats[i].expectedRarity > stats[i - 1].expectedRarity, `${stats[i].id}: paying more must improve the expected rarity`);
  }
  assert.equal(c.packToolTypes, 3);
});

test('F-06 exploration is a net resource sink at every tier', async () => {
  const ev = await load();
  const c = ev.readConstants();
  const tiers = ev.explorationTiers(c);
  assert.equal(tiers.length, 10);
  for (const t of tiers) {
    assert.ok(t.successBps >= 0 && t.successBps <= 10_000);
    assert.ok(t.min <= t.max && t.min > 0);
    assert.ok(t.expectedReward < t.costUnits, `tier ${t.tier}: a trip must burn more than it can return`);
  }
});

test('F-06 forge odds are well formed and get harder with the level', async () => {
  const ev = await load();
  const c = ev.readConstants();
  const f = c.forge;
  assert.equal(f.success.length, f.maxLevel);
  for (let lv = 0; lv < f.maxLevel; lv++) {
    assert.ok(f.success[lv] + f.partial[lv] <= 10_000, `level ${lv}: probabilities exceed 100%`);
    if (lv > 0) {
      assert.ok(f.success[lv] <= f.success[lv - 1], 'success chance must not grow with the level');
      assert.ok(f.fee[lv] >= f.fee[lv - 1], 'the fee must not fall with the level');
    }
  }
  const plain = ev.forgeExpectations(c, false);
  const prot = ev.forgeExpectations(c, true);
  assert.ok(Number.isFinite(plain.attempts) && plain.attempts >= f.maxLevel);
  assert.ok(prot.attempts <= plain.attempts, 'the protector cannot make reaching the top slower');
});

test('F-06 lottery returns at most what it takes, and drum stays deleted', async () => {
  const ev = await load();
  const c = ev.readConstants();
  assert.equal(c.lottery.poolBps + c.lottery.devBps, 10_000);
  assert.ok(c.lottery.price > 0 && c.lottery.maxTickets >= 1);
  assert.ok(c.lottery.timeoutSeconds > c.lottery.salesSeconds, 'refunds open only after anyone could have drawn');
  for (const rel of [
    'programs/aof-quests/src/instructions/drum',
    'frontend/src/lib/drumTable.ts',
    'aof_backend/src/routes/drum.ts',
  ]) {
    assert.equal(fs.existsSync(path.join(root, rel)), false, `${rel} returned`);
  }
  assert.equal(c.drum, undefined);
});

test('F-06 the reveal window fits inside SlotHashes and rent figures are the runtime ones', async () => {
  const ev = await load();
  const c = ev.readConstants();
  assert.equal(c.vrfRefundAfterSlots, 432, 'retained constant; live refund is hash presence, not this boundary');
  assert.ok(c.vrfRefundAfterSlots < 512);
  assert.equal(ev.rentExempt(82), 1_461_600, 'mint rent');
  assert.equal(ev.rentExempt(165), 2_039_280, 'token account rent');
  assert.equal(ev.TOOL_DATA_SPACE, 161, 'matches TOOL_DATA_SPACE (pinned by the Rust serialized_len test)');
});

test('F-06 docs/ECONOMY_RNG_EV.md is generated from the current constants', async () => {
  const ev = await load();
  const current = fs.readFileSync(path.join(root, 'docs/ECONOMY_RNG_EV.md'), 'utf8');
  assert.equal(current, ev.render(), 'run node scripts/economy/rng-ev.mjs');
});
