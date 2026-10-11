import { strict as assert } from 'assert';
import { spawn } from 'child_process';
import { createServer, Server } from 'http';
import { once } from 'events';
import { BorshAccountsCoder, BN } from '@coral-xyz/anchor';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';
import coreIdl from '../src/idl/aof_core.json';
import questsIdl from '../src/idl/aof_quests.json';

async function runInspector(server: Server, mint: string) {
  const port = (server.address() as { port: number }).port;
  const child = spawn(process.execPath, [require.resolve('ts-node/dist/bin.js'), '--project', 'tsconfig.json', '--transpile-only', 'scripts/mindDevnetInspect.ts'], {
    cwd: process.cwd(), env: { ...process.env, MIND_DEVNET_MINT: mint, DEVNET_RPC_URL: `http://127.0.0.1:${port}` },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '', stderr = '';
  child.stdout.on('data', chunk => stdout += chunk);
  child.stderr.on('data', chunk => stderr += chunk);
  const timer = setTimeout(() => child.kill(), 12_000);
  const [status] = await once(child, 'exit');
  clearTimeout(timer);
  assert.ok(stdout, stderr);
  return { status, report: JSON.parse(stdout) };
}

async function main() {
  // A foreign genesis must be rejected before any account read.
  let accountReads = 0;
  const wrongCluster = createServer(async (req, res) => {
    let input = '';
    for await (const chunk of req) input += String(chunk);
    const request = JSON.parse(input);
    if (request.method !== 'getGenesisHash') accountReads++;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: 'not-devnet' }));
  });
  wrongCluster.listen(0, '127.0.0.1');
  await once(wrongCluster, 'listening');
  try {
    const { status, report } = await runInspector(wrongCluster, 'So11111111111111111111111111111111111111112');
    assert.equal(status, 1);
    assert.equal(report.status, 'BLOCKED');
    assert.deepEqual(report.blockers, ['wrong_cluster_genesis']);
    assert.equal(accountReads, 0);
  } finally { wrongCluster.close(); }

  // Encode the committed Config/QuestConfig and classic SPL mint layouts.
  // The current aof_quests IDL no longer defines MindBank: do not invent a
  // client-side bank layout. Missing or unknown bank accounts must stay blocked.
  const mint = new PublicKey('So11111111111111111111111111111111111111112');
  const core = new PublicKey(coreIdl.address), quests = new PublicKey(questsIdl.address);
  const bank = PublicKey.findProgramAddressSync([Buffer.from('mind_bank')], quests)[0];
  const vault = getAssociatedTokenAddressSync(mint, bank, true);
  const coreCoder = new BorshAccountsCoder(coreIdl as any);
  const questCoder = new BorshAccountsCoder(questsIdl as any);
  const zero = PublicKey.default;
  const coreData = await coreCoder.encode('Config', {
    authority: zero, treasury: zero, data_mint: zero, circuit_mint: zero, silicon_mint: zero,
    neuron_mint: zero, power_mint: zero, mind_mint: zero,
    craft_fee: new BN(0), unstake_fee: new BN(0), paused: false, bump: 0,
    mining_enabled: false, pending_authority: zero, authority_updated_at: new BN(0),
    operator: zero, guardian: zero, cashout_frozen: false, reserved: Array(32).fill(0),
  } as any);
  const questData = await questCoder.encode('QuestConfig', {
    authority: zero, bump: 0, mascot_mint: zero, treasury_mascot: zero,
    paused: true, pending_authority: zero, authority_updated_at: new BN(0),
  } as any);
  const mintData = Buffer.alloc(82);
  mintData[44] = 9; mintData[45] = 1; // initialized classic SPL mint
  const account = (owner: PublicKey, data: Buffer) => ({
    data: [data.toString('base64'), 'base64'], executable: false,
    lamports: 2_000_000, owner: owner.toBase58(), rentEpoch: 0,
  });
  let bankData: Buffer | null = null;
  let bankMintCollidesWithMind = false;
  const coreWithMindCollision = Buffer.from(coreData);
  // Config's historical MIND field follows seven 32-byte pubkeys and the
  // eight-byte account discriminator; retain the distinct-mint fail-closed check.
  mint.toBuffer().copy(coreWithMindCollision, 8 + 7 * 32);
  const mock = createServer(async (req, res) => {
    let input = '';
    for await (const chunk of req) input += String(chunk);
    const request = JSON.parse(input);
    const result = request.method === 'getGenesisHash' ? 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG' :
      { context: { slot: 1 }, value: [
        account(core, bankMintCollidesWithMind ? coreWithMindCollision : coreData), account(quests, questData),
        account(TOKEN_PROGRAM_ID, mintData), bankData ? account(quests, bankData) : null, null,
      ] };
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }));
  });
  mock.listen(0, '127.0.0.1');
  await once(mock, 'listening');
  try {
    for (const scenario of [
      {
        bankAccount: 'missing', bankMintCollidesWithMind: false,
        blockers: ['mind_bank_missing_or_wrong_owner', 'mind_vault_ata_missing'],
      },
      {
        bankAccount: 'missing', bankMintCollidesWithMind: true,
        blockers: ['mind_must_be_distinct_from_mind', 'mind_bank_missing_or_wrong_owner', 'mind_vault_ata_missing'],
      },
      { bankAccount: 'unknown', bankMintCollidesWithMind: false, blockers: ['account_decode_or_rpc_failed'] },
    ] as const) {
      bankData = scenario.bankAccount === 'unknown' ? Buffer.alloc(64) : null;
      bankMintCollidesWithMind = scenario.bankMintCollidesWithMind;
      const { status, report } = await runInspector(mock, mint.toBase58());
      assert.equal((report.observations.addresses as any)?.mindBank, bank.toBase58());
      assert.equal((report.observations.addresses as any)?.requiredVaultAta, vault.toBase58());
      assert.equal(report.observations.bank, undefined, 'unsupported bank state must never be fabricated');
      assert.equal(report.observations.vaultAtoms, undefined);
      assert.equal(report.observations.mindMint, (bankMintCollidesWithMind ? mint : zero).toBase58());
      assert.equal(status, 1);
      assert.deepEqual(report.blockers, scenario.blockers);
      assert.equal(report.status, 'BLOCKED');
    }
  } finally { mock.close(); }
  console.log('MIND inspector: foreign genesis, unsupported/missing bank, unknown account and mint collision fail closed without signing');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
