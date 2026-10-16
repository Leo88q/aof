// Organism phase 2 (SoulCore gate + lab wear): static cross-layer contract.
// The sandbox has no Rust toolchain, so this pins the source-level contract
// that check-idl-drift and the backend decoder rely on.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.join(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('SoulAccess account layout matches the backend decoder', () => {
  const state = read('aof-core/src/state.rs');
  const m = state.match(/pub struct SoulAccess \{([^}]+)\}/);
  assert.ok(m, 'SoulAccess struct exists');
  const fields = [...m[1].matchAll(/pub (\w+):/g)].map((x) => x[1]);
  assert.deepEqual(fields, ['owner', 'unlocked_at', 'seals_at_unlock', 'bump']);
  const decoder = read('aof_backend/src/lib/soulAccess.ts');
  assert.match(decoder, /SOUL_ACCESS_ACCOUNT_SIZE = 53/);
  assert.match(decoder, /readBigInt64LE\(40\)/);
  assert.match(decoder, /readUInt32LE\(48\)/);
});

test('unlock_soul_access is gated on a completed seal and moves no resources', () => {
  const handler = read('aof-core/src/instructions/soul_access.rs');
  assert.match(handler, /finale\.seals >= 1/);
  assert.match(handler, /SoulAccessLocked/);
  assert.doesNotMatch(handler, /token::|mint_to|burn/);
  const lib = read('aof-core/src/lib.rs');
  assert.match(lib, /pub fn unlock_soul_access\(ctx: Context<UnlockSoulAccess>\)/);
  assert.match(lib, /SOUL_ACCESS_SEED, user\.key\(\)\.as_ref\(\)/);
});

test('IDL carries unlock_soul_access with the Anchor discriminator', () => {
  const idl = JSON.parse(read('aof_backend/src/idl/aof_core.json'));
  const ix = idl.instructions.find((i) => i.name === 'unlock_soul_access');
  assert.ok(ix, 'instruction in IDL');
  const expected = [...crypto.createHash('sha256').update('global:unlock_soul_access').digest().subarray(0, 8)];
  assert.deepEqual(ix.discriminator, expected);
  assert.deepEqual(ix.accounts.map((a) => a.name), ['config', 'user', 'finale', 'soul_access', 'system_program']);
  assert.ok(idl.accounts.some((a) => a.name === 'SoulAccess'));
  assert.ok(idl.errors.some((e) => e.name === 'SoulAccessLocked'));
});

test('lab wear with repair is the existing on-chain pair, not a second system', () => {
  const harvest = read('aof-core/src/instructions/harvest_synapse.rs');
  assert.match(harvest, /checked_sub\(1\)\.ok_or\(AofError::InsufficientDurability\)/);
  assert.match(harvest, /canonical_tool_type\(&tool\.tool_type\) == Some\("neural_seeder"\)/);
  const repair = read('aof-core/src/instructions/repair.rs');
  assert.match(repair, /repair_silicon_cost_per_unit/);
  assert.match(repair, /repair_circuit_cost_per_unit/);
});

test('backend and client expose the gate end to end', () => {
  assert.match(read('aof_backend/src/routes/query.ts'), /\/soul-access\/:owner/);
  assert.match(read('aof_backend/src/routes/chain.ts'), /\/finale\/unlock-soul-access/);
  assert.match(read('aof_backend/src/security/walletProof.ts'), /chain_finale_unlock_soul_access/);
  assert.match(read('frontend/src/lib/api.ts'), /unlockSoulAccess/);
  assert.match(read('frontend/src/lib/api.ts'), /soulAccess: \(owner: string\)/);
});
