import { strict as assert } from 'assert';
import { spawn } from 'child_process';
import { createServer } from 'http';
import { once } from 'events';
import { BorshAccountsCoder } from '@coral-xyz/anchor';
import BN from 'bn.js';
import { PublicKey } from '@solana/web3.js';
import idl from '../src/idl/aof_core.json';
import { normalizeMiningPreflightAccounts } from '../src/lib/miningPreflightAccounts';
import {
  assessLifetimeCap,
  UNLIMITED_LIFETIME_CAP,
} from '../src/lib/miningLifetimeCapPolicy';

// Local JSON-RPC fixture proves a non-devnet endpoint is rejected before
// fetching any program account. This never signs or transmits a transaction.
const server = createServer(async (req, res) => {
  let input = '';
  for await (const chunk of req) input += String(chunk);
  const request = JSON.parse(input);
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: 'not-the-devnet-genesis' }));
});

function assertLifetimeCapPolicy() {
  const unlimitedWithoutAck = assessLifetimeCap(UNLIMITED_LIFETIME_CAP, 0n, false);
  assert.equal(unlimitedWithoutAck.ok, false);
  assert.equal(
    unlimitedWithoutAck.ok ? undefined : unlimitedWithoutAck.blocker,
    'unlimited_lifetime_cap_requires_explicit_devnet_ack',
  );

  const unlimitedAccepted = assessLifetimeCap(UNLIMITED_LIFETIME_CAP, 0n, true);
  assert.equal(unlimitedAccepted.ok, true);
  assert.equal(
    unlimitedAccepted.ok ? unlimitedAccepted.mode : undefined,
    'unlimited-devnet-accepted',
  );
  assert.equal(
    unlimitedAccepted.ok ? unlimitedAccepted.remainingLifetimeAtoms : undefined,
    'unlimited',
  );

  const finiteWithHeadroom = assessLifetimeCap(1_000n, 250n, false);
  assert.equal(finiteWithHeadroom.ok, true);
  assert.equal(
    finiteWithHeadroom.ok ? finiteWithHeadroom.remainingLifetimeAtoms : undefined,
    '750',
  );

  const finiteAtCap = assessLifetimeCap(1_000n, 1_000n, true);
  assert.equal(finiteAtCap.ok, false);
  assert.equal(
    finiteAtCap.ok ? undefined : finiteAtCap.blocker,
    'finite_lifetime_cap_has_no_headroom',
  );
}

async function assertSnakeCaseNormalization() {
  const coder = new BorshAccountsCoder(idl as any);
  const zero = PublicKey.default;
  const circuitMint = new PublicKey(Buffer.alloc(32, 1));
  const siliconMint = new PublicKey(Buffer.alloc(32, 2));
  const datasetMint = new PublicKey(Buffer.alloc(32, 3));
  const neuronMint = new PublicKey(Buffer.alloc(32, 4));
  const rawConfig = {
    authority: zero, treasury: zero, data_mint: zero, circuit_mint: circuitMint,
    silicon_mint: siliconMint, neuron_mint: zero, power_mint: zero, mind_mint: zero,
    craft_fee: new BN(0), unstake_fee: new BN(0), paused: false, bump: 0,
    mining_enabled: false, pending_authority: zero, authority_updated_at: new BN(0),
    operator: zero, guardian: zero, cashout_frozen: false, reserved: new Uint8Array(32),
  };
  const rawMaterialMints = {
    neuron: neuronMint, synapse: zero, signal: zero, model: zero, power: zero,
    compute: zero, dataset: datasetMint, blue_core: zero, purple_core: zero,
    red_core: zero, clear_quartz: zero, rose_quartz: zero, amber_quartz: zero,
    quantum_bit: zero, neural_chip: zero, photon_bit: zero, bio_chip: zero,
    cryo_fluid: zero, volt_fluid: zero, bio_fluid: zero, nano_fluid: zero,
    quantum_fluid: zero, soul_core: zero, bump: 0,
    max_supply: Array.from({ length: 27 }, (_, index) => new BN(index + 1)),
  };
  const configBytes = await coder.encode('Config', rawConfig);
  const materialsBytes = await coder.encode('MaterialMints', rawMaterialMints);
  const decodedConfig = coder.decode('Config', configBytes) as any;
  const decodedMaterials = coder.decode('MaterialMints', materialsBytes) as any;

  // This is the important edge: the direct Borsh coder returns the literal
  // snake_case IDL names, unlike Program's converted account client.
  assert.equal(decodedConfig.mining_enabled, false);
  assert.equal(decodedConfig.miningEnabled, undefined);
  assert.equal(decodedMaterials.max_supply.length, 27);
  assert.equal(decodedMaterials.maxSupply, undefined);

  const normalized = normalizeMiningPreflightAccounts(decodedConfig, decodedMaterials);
  assert.equal(normalized.config.miningEnabled, false);
  assert.equal(normalized.config.circuitMint.toBase58(), circuitMint.toBase58());
  assert.equal(normalized.config.siliconMint.toBase58(), siliconMint.toBase58());
  assert.equal(normalized.materialMints.dataset.toBase58(), datasetMint.toBase58());
  assert.equal(normalized.materialMints.neuron.toBase58(), neuronMint.toBase58());
  assert.equal(normalized.materialMints.maxSupply.length, 27);
  assert.equal(normalized.materialMints.maxSupply[9].toString(), '10');
}

async function main() {
  assertLifetimeCapPolicy();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = (server.address() as { port: number }).port;
  try {
    await assertSnakeCaseNormalization();
    const child = spawn(process.execPath, [require.resolve('ts-node/dist/bin.js'), '--project', 'tsconfig.json', '--transpile-only', 'scripts/miningDevnetPreflight.ts'], {
      cwd: process.cwd(), env: {
        ...process.env,
        DEVNET_RPC_URL: `http://127.0.0.1:${port}`,
        ALLOW_UNLIMITED_DEVNET_ISSUANCE: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => stdout += chunk);
    child.stderr.on('data', chunk => stderr += chunk);
    const timer = setTimeout(() => child.kill(), 12_000);
    const [status] = await once(child, 'exit');
    clearTimeout(timer);
    assert.equal(status, 1, stderr);
    const report = JSON.parse(stdout);
    assert.equal(report.status, 'BLOCKED');
    assert.ok(report.blockers.includes('wrong_cluster_genesis'));
    assert.equal(report.observations.genesisHash, 'not-the-devnet-genesis');
    assert.equal(report.observations.lifetimeIssuancePolicy, undefined,
      'unlimited acknowledgement must not be evaluated for a non-Devnet genesis');
    assert.equal(report.observations.config, undefined);
    console.log('Read-only preflight rejects wrong cluster without fetching user accounts or signing');
  } finally {
    server.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; server.close(); });
