const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const registry = require('../../watchtower/addresses.json');
const manifest = require('../../watchtower/integration-manifest.json');
const { verify } = require('../../scripts/verify-address-registry.cjs');
const genesis = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG7';
test('registry agrees with Rust, IDL and exporter; placeholders never subscribed', () => {
  assert.equal(registry.programs.length, 6);
  for (const p of registry.programs) {
    assert.equal(require(path.join(root, p.idl)).address, p.address);
    assert.ok(fs.readFileSync(path.join(root, p.source), 'utf8').includes(`declare_id!("${p.address}")`));
    assert.equal(p.status, 'reference-unverified');
    assert.equal(p.rpcVerifiedAt, null);
  }
  for (const address of manifest.programIds) assert.ok(registry.programs.some(p => p.address === address));
  for (const p of registry.placeholders) assert.equal(p.address, null);
  assert.equal(manifest.dataQuality, 'unavailable');
});
test('RPC outage never certifies a deployment or leaks provider credentials', async () => {
  const result = await verify(registry, async () => { throw new Error('https://provider.invalid?api-key=DO-NOT-LOG'); });
  assert.equal(result.status, 'unavailable');
  assert.equal(result.deploymentMatchesSource, false);
  assert.ok(!JSON.stringify(result).includes('DO-NOT-LOG'));
});
test('wrong cluster, missing and non-executable accounts fail closed', async () => {
  assert.equal((await verify(registry, async () => 'wrong')).error, 'wrong_cluster');
  const result = await verify(registry, async method => method === 'getGenesisHash' ? genesis : { value: registry.programs.map((_, i) => i ? null : { executable: false }) });
  assert.equal(result.status, 'incomplete');
  assert.equal(result.programs[0].status, 'invalid_program');
  assert.equal(result.programs[1].status, 'missing');
});
test('observing an executable does NOT certify bytecode or custody', async () => {
  const result = await verify(registry, async method => method === 'getGenesisHash' ? genesis : { context: { slot: 1 }, value: registry.programs.map(() => ({ executable: true, owner: 'BPFLoaderUpgradeab1e11111111111111111111111' })) });
  assert.equal(result.status, 'references-observed');
  assert.equal(result.custodyVerified, false);
  assert.ok(result.programs.every(p => !p.bytecodeVerified && !p.upgradeAuthorityVerified));
});
