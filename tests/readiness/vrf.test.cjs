'use strict';
// Randomness is four future slot hashes settled by this program.
// A player refund is allowed only when a required hash was skipped and that
// absence is still visible. An aged-out hash pays the treasury, not the player.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const CORE = 'aof-core/src/vrf.rs';

test('slot-hash offsets and retention are pinned', () => {
  const src = read(CORE);
  assert.match(src, /pub const SEED_OFFSETS: \[u64; 4\] = \[32, 64, 96, 128\];/);
  assert.match(src, /pub const SLOT_HASH_RETENTION: u64 = 512;/);
  assert.match(src, /pub enum Unsettled/);
  assert.match(src, /PlayerRefund/);
  assert.match(src, /TreasuryForfeit/);
  assert.doesNotMatch(src, /switchboard/i);
  assert.equal(fs.existsSync(path.join(root, 'programs/aof-quests/src/vrf.rs')), false);
  assert.equal(fs.existsSync(path.join(root, 'docs/VRF_SWITCHBOARD.md')), false);
});

test('expire classifies the outcome before releasing the lock', () => {
  for (const file of [
    'aof-core/src/instructions/pack_open_expire.rs',
    'aof-core/src/instructions/exploration.rs',
    'aof-core/src/instructions/forge.rs',
    'aof-core/src/instructions/reroll_random.rs',
    'aof-core/src/instructions/lottery.rs',
  ]) {
    const src = read(file);
    assert.match(src, /vrf::unsettled\(/, file);
    assert.doesNotMatch(src, /release_for_refund/, file);
  }
});

test('backend no longer treats switchboard as a live mode', () => {
  const src = read('aof_backend/src/lib/vrf.ts');
  assert.match(src, /AOF_RANDOMNESS=switchboard is not a randomness source/);
  assert.doesNotMatch(src, /return \"switchboard\"/);
});
