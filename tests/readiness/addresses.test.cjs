const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const registry = require('../../watchtower/addresses.json');
const manifest = require('../../watchtower/integration-manifest.json');
const { verify } = require('../../scripts/verify-address-registry.cjs');
const genesis = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';
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

// Дефект 2026-09-30: во всех пяти местах хеш генезиса девнета был записан с
// лишним символом (45 знаков). Base58 от 32 байт не может быть длиннее 44
// знаков, поэтому `getGenesisHash()` никогда не совпадал с константой, и
// читающий preflight — обязательный шаг перед включением добычи — навсегда
// оставался BLOCKED с `wrong_cluster_genesis`, не доходя до проверки программ
// и минтов. Владелец видел «ничего нельзя включить», не видя причины.
const GENESIS_FILES = [
  'aof_backend/scripts/miningDevnetPreflight.ts',
  'aof_backend/scripts/potatoDevnetInspect.ts',
  'scripts/verify-address-registry.cjs',
];
const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function base58Decode(text) {
  let value = 0n;
  for (const char of text) {
    const index = BASE58.indexOf(char);
    if (index < 0) throw new Error(`not base58: ${char}`);
    value = value * 58n + BigInt(index);
  }
  const bytes = [];
  while (value > 0n) { bytes.unshift(Number(value % 256n)); value /= 256n; }
  for (const char of text) { if (char !== '1') break; bytes.unshift(0); }
  return Buffer.from(bytes);
}
test('хеш генезиса девнета — настоящий 32-байтовый base58, а не опечатка', () => {
  const found = [];
  for (const rel of GENESIS_FILES) {
    const source = fs.readFileSync(path.join(root, rel), 'utf8');
    for (const match of source.matchAll(/['"]([1-9A-HJ-NP-Za-km-z]{40,50})['"]/g)) {
      if (/^(EtWTRABZ|GENESIS|DEVNET)/i.test(match[1]) || match[1].startsWith('EtWTRABZ')) found.push([rel, match[1]]);
    }
  }
  assert.ok(found.length >= GENESIS_FILES.length, 'не найдены константы хеша генезиса');
  const hashes = new Set(found.map(([, hash]) => hash));
  assert.equal(hashes.size, 1, `хеш генезиса расходится между файлами: ${[...hashes].join(', ')}`);
  const hash = [...hashes][0];
  assert.ok(hash.length <= 44, `хеш длиннее 44 знаков — это опечатка, а не base58 от 32 байт: ${hash}`);
  assert.equal(base58Decode(hash).length, 32, `хеш не декодируется в 32 байта: ${hash}`);
  // И он совпадает с тем, что отдаёт сам девнет (зафиксировано читающим
  // preflight 2026-09-30 на api.devnet.solana.com).
  assert.equal(hash, genesis);
});
