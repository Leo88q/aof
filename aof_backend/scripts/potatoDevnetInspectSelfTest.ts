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
  const child = spawn(process.execPath, [require.resolve('ts-node/dist/bin.js'), '--project', 'tsconfig.json', '--transpile-only', 'scripts/potatoDevnetInspect.ts'], {
    cwd: process.cwd(), env: { ...process.env, POTATO_DEVNET_MINT: mint, DEVNET_RPC_URL: `http://127.0.0.1:${port}` },
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

  // Encode real Anchor layouts and classic SPL mint/vault layouts. This catches
  // IDL field naming errors that a wrong-genesis test cannot exercise.
  const mint = new PublicKey('So11111111111111111111111111111111111111112');
  const core = new PublicKey(coreIdl.address), quests = new PublicKey(questsIdl.address);
  const bank = PublicKey.findProgramAddressSync([Buffer.from('potato_bank')], quests)[0];
  const vault = getAssociatedTokenAddressSync(mint, bank, true);
  const coreCoder = new BorshAccountsCoder(coreIdl as any);
  const questCoder = new BorshAccountsCoder(questsIdl as any);
  const zero = PublicKey.default;
  const coreData = await coreCoder.encode('Config', {
    authority: zero, treasury: zero, food_mint: zero, wood_mint: zero, stone_mint: zero,
    seeds_mint: zero, water_mint: zero, potato_mint: zero,
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
  const vaultData = Buffer.alloc(165);
  mint.toBuffer().copy(vaultData, 0);
  bank.toBuffer().copy(vaultData, 32);
  vaultData.writeBigUInt64LE(55_000_000_000n, 64);
  vaultData[108] = 1; // initialized classic SPL token account
  const account = (owner: PublicKey, data: Buffer) => ({
    data: [data.toString('base64'), 'base64'], executable: false,
    lamports: 2_000_000, owner: owner.toBase58(), rentEpoch: 0,
  });
  let paused = true, mindIsPotato = false, openSpins = 0;
  const coreWithMindCollision = Buffer.from(coreData);
  // Config's historical MIND field follows seven 32-byte pubkeys and the
  // eight-byte account discriminator. The test additionally checks the
  // inspector's on-chain MIND/Potato distinctness gate.
  mint.toBuffer().copy(coreWithMindCollision, 8 + 7 * 32);
  const mock = createServer(async (req, res) => {
    let input = '';
    for await (const chunk of req) input += String(chunk);
    const request = JSON.parse(input);
    const bankData = await questCoder.encode('PotatoBank', {
      mint, vault, reserved_atoms: new BN(openSpins * 50_000_000_000), open_spins: openSpins, paused, bump: 255,
    } as any);
    const result = request.method === 'getGenesisHash' ? 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG7' :
      { context: { slot: 1 }, value: [
        account(core, mindIsPotato ? coreWithMindCollision : coreData), account(quests, questData), account(TOKEN_PROGRAM_ID, mintData),
        account(quests, bankData), account(TOKEN_PROGRAM_ID, vaultData),
      ] };
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }));
  });
  mock.listen(0, '127.0.0.1');
  await once(mock, 'listening');
  try {
    for (const scenario of [
      { paused: true, mindIsPotato: false, openSpins: 0, blockers: [] },
      { paused: false, mindIsPotato: false, openSpins: 0, blockers: ['potato_bank_not_paused_for_preflight'] },
      { paused: true, mindIsPotato: true, openSpins: 0, blockers: ['potato_must_be_distinct_from_mind'] },
      { paused: true, mindIsPotato: false, openSpins: 1, blockers: ['potato_vault_below_existing_reserve_plus_one_maximum_prize'] },
    ]) {
      ({ paused, mindIsPotato, openSpins } = scenario);
      const { status, report } = await runInspector(mock, mint.toBase58());
      assert.equal(report.observations.bank?.mint, mint.toBase58());
      assert.equal(report.observations.vaultAtoms, '55000000000');
      assert.equal(report.observations.mindMint, (mindIsPotato ? mint : zero).toBase58());
      assert.equal(report.observations.bank?.paused, paused);
      assert.equal(report.observations.bank?.openSpins, String(openSpins));
      assert.equal(status, scenario.blockers.length ? 1 : 0);
      assert.deepEqual(report.blockers, scenario.blockers);
      assert.equal(report.status, scenario.blockers.length ? 'BLOCKED' : 'MINT_AND_CUSTODY_OBSERVED_NOT_PAYMENT_READY');
    }
  } finally { mock.close(); }
  console.log('Potato inspector: foreign genesis, bank custody, MIND collision, reserves and pause checked without signing');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
