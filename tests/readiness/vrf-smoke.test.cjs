'use strict';
// [F-06] The devnet smoke test recomputes outcomes from the published oracle
// value. Its helpers must agree with the program (vector pinned in
// aof-core security_checklist_tests::vrf_roll_matches_the_published_javascript_vector)
// and with the IDL layout of VrfSettled.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..', '..');
const load = () => import(pathToFileURL(path.join(root, 'scripts/vrf/devnet-smoke.mjs')).href);

test('F-06 smoke helpers reproduce the Rust roll vector', async () => {
  const smoke = await load();
  const commit = Buffer.alloc(32, 9);
  const value = Buffer.alloc(32, 7);
  assert.deepEqual(smoke.packRarity(commit, value, [6000, 3200, 700, 100, 0]), { bps: 1893, rarity: 'common' });
  // weighted_pick boundaries match randomness.rs
  assert.equal(smoke.weightedPick(0, [6000, 3200, 700, 100, 0]), 0);
  assert.equal(smoke.weightedPick(5999, [6000, 3200, 700, 100, 0]), 0);
  assert.equal(smoke.weightedPick(6000, [6000, 3200, 700, 100, 0]), 1);
  assert.equal(smoke.weightedPick(9999, [6000, 3200, 700, 100, 0]), 3);
});

test('F-06 smoke decoder follows the IDL layout of VrfSettled', async () => {
  const smoke = await load();
  const idl = JSON.parse(fs.readFileSync(path.join(root, 'aof_backend/src/idl/aof_core.json'), 'utf8'));
  const type = idl.types.find((t) => t.name === 'VrfSettled');
  assert.deepEqual(type.type.fields.map((f) => f.name), ['mechanic', 'commit', 'randomness', 'seed_slot', 'value', 'cranker']);
  const disc = crypto.createHash('sha256').update('event:VrfSettled').digest().subarray(0, 8);
  assert.deepEqual([...disc], idl.events.find((e) => e.name === 'VrfSettled').discriminator);

  const seedSlot = Buffer.alloc(8);
  seedSlot.writeBigUInt64LE(123456789n);
  const data = Buffer.concat([disc, Buffer.from([1]), Buffer.alloc(32, 2), Buffer.alloc(32, 3), seedSlot, Buffer.alloc(32, 4), Buffer.alloc(32, 5)]);
  const ev = smoke.decodeVrfSettled(['Program log: Instruction: PackOpenReveal', `Program data: ${data.toString('base64')}`]);
  assert.equal(ev.mechanic, 1);
  assert.ok(ev.commit.equals(Buffer.alloc(32, 2)));
  assert.ok(ev.randomness.equals(Buffer.alloc(32, 3)));
  assert.equal(ev.seedSlot, 123456789n);
  assert.ok(ev.value.equals(Buffer.alloc(32, 4)));
  assert.ok(ev.cranker.equals(Buffer.alloc(32, 5)));
  assert.equal(smoke.decodeVrfSettled([`Program data: ${data.subarray(0, 100).toString('base64')}`]), null);
});

test('F-06 smoke wallet proofs use the API wire format', async () => {
  const smoke = await load();
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const seed = privateKey.export({ format: 'der', type: 'pkcs8' }).subarray(16);
  const body = { user: 'Wallet1111111111111111111111111111111111111', packType: 'small' };
  const proof = smoke.walletProof({ domain: 'AOF_API', wallet: body.user, seed, now: 1_700_000_000_000 }, 'packs_commit', '/packs/commit', body);
  const parts = proof.message.split(':');
  assert.equal(parts.length, 6);
  assert.deepEqual(parts.slice(0, 3), ['AOF_API', body.user, 'packs_commit']);
  // canonical JSON: keys sorted recursively (walletProofCore.canonicalJson)
  const canonical = '{"body":{"packType":"small","user":"Wallet1111111111111111111111111111111111111"},"method":"POST","target":"/packs/commit"}';
  assert.equal(parts[3], crypto.createHash('sha256').update(canonical).digest('hex'));
  assert.equal(parts[4], '1700000000000');
  assert.match(parts[5], /^[A-Za-z0-9_-]{16,128}$/);
  assert.ok(crypto.verify(null, Buffer.from(proof.message), publicKey, Buffer.from(proof.signature, 'base64')));
});
