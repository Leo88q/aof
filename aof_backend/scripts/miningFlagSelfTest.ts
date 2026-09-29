import { strict as assert } from 'assert';

// Exercise the real configState cache without importing a live provider or
// touching an RPC. No wallet/keypair material is needed for these cases.
let fetchConfig: () => Promise<unknown> = async () => ({ miningEnabled: false });
let fetches = 0;
const providerPath = require.resolve('../src/provider');
const pdaPath = require.resolve('../src/lib/pda');
for (const [path, exports] of [
  [providerPath, { program: { account: { config: { fetch: () => { ++fetches; return fetchConfig(); } } } } }],
  [pdaPath, { configPda: () => ['test-config'] }],
] as const) {
  require.cache[path] = { id: path, filename: path, loaded: true, exports } as NodeModule;
}
const { miningEnabledOnChain, invalidateMiningFlag } = require('../src/lib/configState') as typeof import('../src/lib/configState');

async function run() {
  assert.equal(await miningEnabledOnChain(), false);
  fetchConfig = async () => ({ miningEnabled: true });
  invalidateMiningFlag();
  assert.equal(await miningEnabledOnChain(), true);
  assert.equal(await miningEnabledOnChain(), true);
  assert.equal(fetches, 2, 'valid value is cached for hot requests');

  fetchConfig = async () => ({ miningEnabled: 'true' });
  invalidateMiningFlag();
  assert.equal(await miningEnabledOnChain(), false, 'truthy strings are not on-chain booleans');
  fetchConfig = async () => { throw new Error('RPC unavailable'); };
  invalidateMiningFlag();
  assert.equal(await miningEnabledOnChain(), false, 'RPC errors fail closed');
  fetchConfig = async () => null;
  invalidateMiningFlag();
  assert.equal(await miningEnabledOnChain(), false, 'missing Config fails closed');

  let complete!: (value: unknown) => void;
  fetchConfig = () => new Promise(resolve => { complete = resolve; });
  invalidateMiningFlag();
  const before = fetches;
  const first = miningEnabledOnChain();
  const second = miningEnabledOnChain();
  assert.equal(fetches, before + 1, 'concurrent requests share one RPC call');
  invalidateMiningFlag();
  complete({ miningEnabled: true });
  assert.deepEqual(await Promise.all([first, second]), [false, false],
    'pre-pause response cannot re-enable mining after an admin toggle');
  fetchConfig = async () => ({ miningEnabled: false });
  assert.equal(await miningEnabledOnChain(), false);
  assert.equal(fetches, before + 2);
  console.log('Mining on-chain flag: strict bool, RPC error, cache, single-flight and invalidation passed');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
