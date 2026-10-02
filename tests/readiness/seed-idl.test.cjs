'use strict';
// The validator suite reads target/idl/*.json. scripts/seed-idl.cjs seeds it
// from aof_backend/src/idl and must point each IDL at the program id that
// `anchor test` deploys (the target/deploy keypair), otherwise the suite calls
// ids that do not exist on the local validator.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const { seedIdl, base58, keypairAddress } = require(path.join(root, 'scripts', 'seed-idl.cjs'));

// SPL Token program id: a published key/bytes pair (allowlisted in
// .gitleaks.toml: public key bytes, not a secret).
const PROGRAM_HEX = '06ddf6e1d765a193d9cbe146ceeb79ac1cb485ed5f5b37913a8cf5857eff00a9';
const PROGRAM_B58 = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

test('base58 matches published program ids', () => {
  assert.equal(base58(Buffer.from(PROGRAM_HEX, 'hex')), PROGRAM_B58);
  assert.equal(base58(Buffer.alloc(32)), '11111111111111111111111111111111');
});

function workspace() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-idl-'));
  fs.mkdirSync(path.join(dir, 'aof_backend', 'src', 'idl'), { recursive: true });
  const write = (rel, value) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), JSON.stringify(value));
  };
  return { dir, write, read: (rel) => JSON.parse(fs.readFileSync(path.join(dir, rel), 'utf8')) };
}

test('seedIdl patches the address to the deployed keypair and keeps it without a build', () => {
  const ws = workspace();
  try {
    ws.write('aof_backend/src/idl/aof_core.json', { address: 'okiLaCvFyHqFRFf359emmunPKD77uUmLQ2iJWskZdnx', metadata: { name: 'aof_core', address: 'okiLaCvFyHqFRFf359emmunPKD77uUmLQ2iJWskZdnx' }, instructions: [] });
    ws.write('aof_backend/src/idl/aof_quests.json', { address: 'QuestsCommittedId1111111111111111111111111', instructions: [] });
    const keypair = [...Buffer.alloc(32, 7), ...Buffer.from(PROGRAM_HEX, 'hex')];
    ws.write('target/deploy/aof_core-keypair.json', keypair);
    assert.equal(keypairAddress(path.join(ws.dir, 'target/deploy/aof_core-keypair.json')), PROGRAM_B58);

    const logs = [];
    assert.equal(seedIdl({ root: ws.dir, log: (m) => logs.push(m) }), 2);
    const core = ws.read('target/idl/aof_core.json');
    assert.equal(core.address, PROGRAM_B58, 'top-level address follows the keypair');
    assert.equal(core.metadata.address, PROGRAM_B58, 'legacy metadata.address follows too');
    assert.deepEqual(core.instructions, []);
    assert.equal(ws.read('target/idl/aof_quests.json').address, 'QuestsCommittedId1111111111111111111111111',
      'no keypair (no build): the committed id is kept');
    assert.ok(logs.some((l) => /patched aof_core\.json/.test(l)));

    // Idempotent: a second run (the test script re-seeds) keeps the patch.
    seedIdl({ root: ws.dir, log: () => {} });
    assert.equal(ws.read('target/idl/aof_core.json').address, PROGRAM_B58);
  } finally {
    fs.rmSync(ws.dir, { recursive: true, force: true });
  }
});

test('seedIdl rejects a malformed keypair instead of seeding a wrong id', () => {
  const ws = workspace();
  try {
    ws.write('aof_backend/src/idl/aof_core.json', { address: 'x', instructions: [] });
    ws.write('target/deploy/aof_core-keypair.json', [1, 2, 3]);
    assert.throws(() => seedIdl({ root: ws.dir, log: () => {} }), /64-byte keypair/);
  } finally {
    fs.rmSync(ws.dir, { recursive: true, force: true });
  }
});

test('every seeding entry point of the Anchor.toml test script uses seed-idl.cjs', () => {
  const anchorToml = fs.readFileSync(path.join(root, 'Anchor.toml'), 'utf8');
  for (const script of ['ensure-env.mjs', 'ensure-env.js', 'ensure-idl.mjs', 'ensure-idl.js']) {
    assert.ok(anchorToml.includes(`scripts/${script}`), `${script} is in the fallback chain`);
    const src = fs.readFileSync(path.join(root, 'scripts', script), 'utf8');
    assert.match(src, /seed-idl\.cjs/, `${script} must seed through seed-idl.cjs`);
    assert.doesNotMatch(src, /copyFileSync/, `${script} must not copy IDLs verbatim (drops the id patch)`);
  }
});
