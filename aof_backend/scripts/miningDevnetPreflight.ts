// READ-ONLY devnet preflight. No signer, transaction, airdrop, keypair or DB.
// Does not prove bytecode parity: scripts/verify-programs.sh and a smoke run
// are still mandatory before enabling Config.mining_enabled.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BorshAccountsCoder } from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import { unpackMint, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { miningRewardMint, TOOL_RESOURCE_MINT } from '../src/lib/toolResourceMint';
import idl from '../src/idl/aof_core.json';

// Indices in aof-core::ResourceKind / aof_backend/src/lib/pda.ts::RESOURCE_KIND_ORDER.
const MINING_KIND_INDEX = { CIRCUIT: 1, SILICON: 2, NEURON: 3, DATASET: 9 } as const;

const root = join(__dirname, '../..');
const GENESIS_DEVNET = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG7';
const LOADER = new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111');
const UNLIMITED = (1n << 64n) - 1n;
const TIMEOUT_MS = 15_000;
const withTimeout = async <T>(label: string, promise: Promise<T>): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(label + ': RPC timed out')), TIMEOUT_MS);
    })]);
  } finally { if (timer) clearTimeout(timer); }
};

const report: { status: string; network: string; programIds: Record<string, string>; observations: Record<string, unknown>; blockers: string[]; warning: string } = {
  status: 'BLOCKED', network: 'devnet', programIds: {}, observations: {}, blockers: [],
  warning: 'Read-only RPC checks; deployed bytecode hash and wallet-signed gameplay NOT verified.',
};
const fail = (code: string) => report.blockers.push(code);
const repo = (path: string) => readFileSync(join(root, path), 'utf8');

async function preflight() {
  const registry = JSON.parse(repo('watchtower/addresses.json')) as { network: string; programs: Array<{ name: string; address: string; status: string; idl: string; source: string }> };
  if (registry.network !== 'devnet') fail('registry_wrong_network');
  const anchor = repo('Anchor.toml');
  const section = anchor.split('[programs.devnet]')[1]?.split(/\n\[/)[0] || '';
  const coreEntry = registry.programs.find(p => p.name === 'aof_core');
  if (!coreEntry) { fail('registry_core_missing'); return; }
  for (const entry of registry.programs) {
    report.programIds[entry.name] = entry.address;
    if (!section.includes(`${entry.name} = "${entry.address}"`)) fail(`${entry.name}:anchor_id_mismatch`);
    if (JSON.parse(repo(entry.idl)).address !== entry.address) fail(`${entry.name}:idl_id_mismatch`);
    if (!repo(entry.source).includes(`declare_id!("${entry.address}")`)) fail(`${entry.name}:source_id_mismatch`);
    if (entry.status !== 'verified') fail(`${entry.name}:registry_${entry.status}`);
  }
  // No hidden mainnet fallback: require both an explicit devnet genesis hash
  // AND the expected core program id, including when using a private RPC.
  const rpc = process.env.DEVNET_RPC_URL || 'https://api.devnet.solana.com';
  const connection = new Connection(rpc, 'confirmed');
  let genesis: string;
  try { genesis = await withTimeout('genesis', connection.getGenesisHash()); }
  catch { fail('rpc_unavailable'); return; }
  report.observations.genesisHash = genesis;
  if (genesis !== GENESIS_DEVNET) { fail('wrong_cluster_genesis'); return; }

  for (const entry of registry.programs) {
    const id = new PublicKey(entry.address);
    try {
      const info = await withTimeout(entry.name, connection.getAccountInfo(id, 'confirmed'));
      if (!info || !info.executable || !info.owner.equals(LOADER) || info.data.length < 36 || info.data.readUInt32LE(0) !== 2) {
        fail(`${entry.name}:not_executable_upgradeable_program`); continue;
      }
      const dataAddress = new PublicKey(info.data.subarray(4, 36));
      const [expected] = PublicKey.findProgramAddressSync([id.toBuffer()], LOADER);
      if (!dataAddress.equals(expected)) { fail(`${entry.name}:wrong_program_data`); continue; }
      // Read only the loader header (tag, slot, optional authority); never
      // download multi-megabyte program bytecode into a probe report.
      const data = await withTimeout(entry.name + ':programData', connection.getAccountInfo(dataAddress, {
        commitment: 'confirmed', dataSlice: { offset: 0, length: 45 },
      }));
      if (!data || !data.owner.equals(LOADER) || data.data.length < 13 || data.data.readUInt32LE(0) !== 3) {
        fail(`${entry.name}:program_data_unreadable`); continue;
      }
      const flag = data.data[12]; // bincode Option<Pubkey>, after tag (4) and slot (8)
      const authority = flag === 0 ? null : flag === 1 && data.data.length >= 45
        ? new PublicKey(data.data.subarray(13, 45)).toBase58() : 'invalid';
      if (authority === 'invalid') fail(`${entry.name}:invalid_upgrade_authority`);
      report.observations[entry.name] = { programData: dataAddress.toBase58(), upgradeAuthority: authority };
    } catch { fail(`${entry.name}:rpc_read_failed`); }
  }
  const coreId = new PublicKey(coreEntry.address);
  const [configPda] = PublicKey.findProgramAddressSync([Buffer.from('config')], coreId);
  const [materialPda] = PublicKey.findProgramAddressSync([Buffer.from('material_mints')], coreId);
  const [authPda] = PublicKey.findProgramAddressSync([Buffer.from('auth')], coreId);
  report.observations.pdas = { config: configPda.toBase58(), materialMints: materialPda.toBase58(), mintAuthority: authPda.toBase58() };
  try {
    const [cfgInfo, mmInfo] = await withTimeout('registry accounts', connection.getMultipleAccountsInfo([configPda, materialPda], 'confirmed'));
    if (!cfgInfo || !mmInfo || !cfgInfo.owner.equals(coreId) || !mmInfo.owner.equals(coreId)) {
      fail('core_config_or_material_registry_missing'); return;
    }
    const coder = new BorshAccountsCoder(idl as any);
    const cfg = coder.decode('Config', cfgInfo.data) as any;
    const mm = coder.decode('MaterialMints', mmInfo.data) as any;
    report.observations.miningEnabled = cfg.miningEnabled;
    if (cfg.miningEnabled !== false) fail('mining_already_enabled:pause_before_pilot');
    if (cfg.paused === true) fail('core_paused');
    const byMint = new Map<string, { pubkey: PublicKey; resource: string }>();
    for (const tool of Object.keys(TOOL_RESOURCE_MINT)) {
      const mint = miningRewardMint(tool, cfg, mm);
      if (!mint) { fail(`${tool}:mint_missing_or_invalid`); continue; }
      const resource = TOOL_RESOURCE_MINT[tool as keyof typeof TOOL_RESOURCE_MINT].resource;
      byMint.set(mint.toBase58(), { pubkey: mint, resource });
      report.observations[tool] = { resource, mint: mint.toBase58() };
    }
    if (byMint.size !== 4) fail('reward_mints_missing_or_duplicated');
    const entries = [...byMint.values()];
    const mints = await withTimeout('reward mints', connection.getMultipleAccountsInfo(entries.map(e => e.pubkey), 'confirmed'));
    for (let i = 0; i < entries.length; i++) {
      const { pubkey, resource } = entries[i];
      const info = mints[i];
      if (!info || !info.owner.equals(TOKEN_PROGRAM_ID)) { fail(`${resource}:spl_mint_missing`); continue; }
      try {
        const mint = unpackMint(pubkey, info, TOKEN_PROGRAM_ID);
        if (!mint.isInitialized || mint.decimals !== 9 || !mint.mintAuthority?.equals(authPda)) fail(`${resource}:invalid_spl_mint_decimals_or_authority`);
        const index = MINING_KIND_INDEX[resource as keyof typeof MINING_KIND_INDEX];
        if (index === undefined || !Array.isArray(mm.maxSupply) || !mm.maxSupply[index]) { fail(`${resource}:cap_not_readable`); continue; }
        const cap = BigInt(mm.maxSupply[index].toString());
        if (cap === UNLIMITED || cap <= mint.supply) fail(`${resource}:finite_available_supply_cap_required`);
        report.observations[resource] = { supplyAtoms: mint.supply.toString(), capAtoms: cap.toString(), decimals: mint.decimals };
      } catch { fail(`${resource}:invalid_mint_or_cap`); }
    }
  } catch { fail('core_registry_decode_or_rpc_failed'); }
}

preflight().catch(() => fail('preflight_failed')).finally(() => {
  // Never claim the bytecode or gameplay is verified from these account reads.
  // Registry entries remain reference-unverified until an operator signs off.
  report.status = report.blockers.length ? 'BLOCKED' : 'READ_ONLY_PREFLIGHT_PASSED_BYTECODE_AND_SMOKE_REQUIRED';
  const output = JSON.stringify(report, null, 2);
  console.log(output);
  if (process.env.MINING_PREFLIGHT_REPORT) writeFileSync(process.env.MINING_PREFLIGHT_REPORT, output + '\n');
  if (report.blockers.length) process.exitCode = 1;
});
