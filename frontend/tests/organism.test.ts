import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { ORGANS, TOOL_DOCKS, registryIssues } from '../src/organism/registry';
import { deriveOrganism, normalizeRarity, toNumber, type OrganismInput } from '../src/organism/model';
import { RESOURCES } from '../src/lib/visualAssets';
import { resourceKey } from '../src/lib/economyBalances';

const NOW = 1_800_000_000;

const emptyInput = (): OrganismInput => ({ balances: null, tiles: null, tools: null, energy: null });

test('registry places each of the 27 canonical resources exactly once', () => {
  assert.equal(RESOURCES.length, 27);
  assert.deepEqual(registryIssues(), []);
  const placed = ORGANS.flatMap((o) => o.resources);
  assert.equal(placed.length, 27);
  assert.equal(new Set(placed).size, 27);
});

test('five tool docks map to resources that exist and match collect_mining routing', () => {
  assert.equal(TOOL_DOCKS.length, 5);
  const routing = Object.fromEntries(TOOL_DOCKS.map((d) => [d.toolType, d.resource]));
  assert.deepEqual(routing, {
    plasma_cutter: 'circuit',
    silicon_extractor: 'silicon',
    data_harvester: 'dataset',
    quantum_transmitter: 'dataset',
    neural_seeder: 'neuron',
  });
});

test('unknown inputs stay null, never zero', () => {
  const state = deriveOrganism(emptyInput(), NOW);
  assert.equal(state.heart.known, false);
  assert.equal(state.heart.amount, null);
  assert.equal(state.soulCore.known, false);
  assert.equal(state.soulCore.amount, null);
  assert.ok(state.cells.every((c) => c.state === 'unknown'));
  assert.ok(state.docks.every((d) => d.owned === null));
  assert.ok(state.organs.flatMap((o) => o.resources).every((r) => r.amount === null && r.intensity === 0));
});

test('energy heart: share is clamped and needs a positive cap', () => {
  const s = deriveOrganism({ ...emptyInput(), energy: { amount: 50, cap: 200 } }, NOW);
  assert.equal(s.heart.share, 0.25);
  const over = deriveOrganism({ ...emptyInput(), energy: { amount: 300, cap: 200 } }, NOW);
  assert.equal(over.heart.share, 1);
  const noCap = deriveOrganism({ ...emptyInput(), energy: { amount: 5, cap: 0 } }, NOW);
  assert.equal(noCap.heart.share, null);
  assert.equal(noCap.heart.cap, null);
});

test('lab cells: ten canonical cells, states from ready/active flags, progress clamped below 1 until ready', () => {
  const tiles = [
    { index: 0, active: true, ready: false, progress: 42 },
    { index: 1, active: true, ready: true, progress: 100 },
    { index: 2, active: false, ready: false, progress: 0 },
    { index: 3, active: true, ready: false, progress: 99 },
  ];
  const s = deriveOrganism({ ...emptyInput(), tiles }, NOW);
  assert.equal(s.cells.length, 10);
  assert.equal(s.cells[0].state, 'growing');
  assert.ok(Math.abs(s.cells[0].progress - 0.42) < 1e-9);
  assert.equal(s.cells[1].state, 'ready');
  assert.equal(s.cells[1].progress, 1);
  assert.equal(s.cells[2].state, 'empty');
  assert.equal(s.cells[3].progress, 0.99);
  // Cells the API did not return are unknown, not empty.
  assert.equal(s.cells[9].state, 'unknown');
});

test('tools: counts by kind, working only while mining end is in the future, best rarity wins', () => {
  const tools = [
    { toolType: 'neural_seeder', rarity: 'common', isMining: true, miningEnd: NOW + 60 },
    { toolType: 'neural_seeder', rarity: { legendary: {} }, isMining: true, miningEnd: NOW - 1 },
    { toolType: 'plasma_cutter', rarity: 2, isMining: false },
    { tool_type: 'data_harvester', rarity: 'epic', is_mining: true, mining_end: String(NOW + 10) },
  ];
  const s = deriveOrganism({ ...emptyInput(), tools }, NOW);
  const dock = (t: string) => s.docks.find((d) => d.toolType === t)!;
  assert.equal(dock('neural_seeder').owned, 2);
  assert.equal(dock('neural_seeder').working, 1);
  assert.equal(dock('neural_seeder').bestRarity, 'legendary');
  assert.equal(dock('plasma_cutter').bestRarity, 'rare');
  assert.equal(dock('plasma_cutter').working, 0);
  assert.equal(dock('data_harvester').working, 1);
  assert.equal(dock('silicon_extractor').owned, 0);
});

test('organ intensity is log-scaled against the largest known balance', () => {
  const balances: Record<string, number> = {};
  for (const r of RESOURCES) balances[resourceKey(r.id)] = 0;
  balances[resourceKey('mind')] = 999;
  balances[resourceKey('circuit')] = 9;
  balances[resourceKey('soulCore')] = 1;
  const s = deriveOrganism({ ...emptyInput(), balances }, NOW);
  const find = (id: string) => s.organs.flatMap((o) => o.resources).find((r) => r.id === id)!;
  assert.equal(find('mind').intensity, 1);
  assert.equal(find('circuit').amount, 9);
  assert.ok(find('circuit').intensity > 0 && find('circuit').intensity < 1);
  assert.equal(find('neuron').intensity, 0);
  assert.equal(s.soulCore.known, true);
  assert.equal(s.soulCore.amount, 1);
});

test('rarity and number helpers accept the shapes the API can return', () => {
  assert.equal(normalizeRarity(4), 'legendary');
  assert.equal(normalizeRarity('Rare'), 'rare');
  assert.equal(normalizeRarity({ epic: {} }), 'epic');
  assert.equal(normalizeRarity(9), null);
  assert.equal(normalizeRarity(null), null);
  assert.equal(toNumber('12'), 12);
  assert.equal(toNumber({ toString: () => '7' }), 7);
  assert.equal(toNumber('abc'), null);
});

test('growth is interpolated on chain time from startedAt/readyAt and never reaches 1 locally', () => {
  const started = NOW - 600;
  const ready = NOW + 600;
  const mid = deriveOrganism({ ...emptyInput(), tiles: [{ index: 0, active: true, ready: false, startedAt: started, readyAt: ready, progress: 0 }] }, NOW);
  assert.equal(mid.cells[0].state, 'growing');
  assert.ok(Math.abs(mid.cells[0].progress - 0.5) < 1e-9);

  const past = deriveOrganism({ ...emptyInput(), tiles: [{ index: 0, active: true, ready: false, startedAt: started, readyAt: NOW - 1, progress: 99 }] }, NOW);
  assert.equal(past.cells[0].state, 'growing');
  assert.equal(past.cells[0].progress, 0.99);

  const apiOnly = deriveOrganism({ ...emptyInput(), tiles: [{ index: 0, active: true, ready: false, progress: 30 }] }, NOW);
  assert.ok(Math.abs(apiOnly.cells[0].progress - 0.3) < 1e-9);
});
