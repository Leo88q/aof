// Unsigned preflight only. The isolated V2 bank is wired to a hard-disabled
// paid commit; reserve arithmetic alone cannot certify deployed bytecode or gameplay.
import { BorshAccountsCoder } from '@coral-xyz/anchor';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, unpackAccount, unpackMint } from '@solana/spl-token';
import { Connection, PublicKey } from '@solana/web3.js';
import coreIdl from '../src/idl/aof_core.json';
import questsIdl from '../src/idl/aof_quests.json';

const DEVNET_GENESIS = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG7';
const core = new PublicKey(coreIdl.address);
const quests = new PublicKey(questsIdl.address);
const report: { status: string; observations: Record<string, unknown>; blockers: string[]; warning: string } = {
  status: 'BLOCKED', observations: {}, blockers: [],
  warning: 'READ-ONLY: V2 bank state/custody inspection is NOT deployed-bytecode verification, a successful paid spin, or a signed refund.',
};
const block = (code: string) => report.blockers.push(code);
const withTimeout = async <T>(promise: Promise<T>): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('RPC timed out')), 15_000);
    })]);
  } finally { if (timer) clearTimeout(timer); }
};

async function inspect() {
  const input = process.env.POTATO_DEVNET_MINT;
  let mintKey: PublicKey;
  try {
    if (!input) { block('potato_mint_not_provided'); return; }
    mintKey = new PublicKey(input);
    if (mintKey.equals(PublicKey.default)) { block('potato_mint_is_zero'); return; }
  } catch { block('potato_mint_invalid'); return; }
  const rpc = process.env.DEVNET_RPC_URL || 'https://api.devnet.solana.com';
  const connection = new Connection(rpc, 'confirmed');
  let genesis: string;
  try { genesis = await withTimeout(connection.getGenesisHash()); }
  catch { block('rpc_unavailable'); return; }
  report.observations.genesisHash = genesis;
  if (genesis !== DEVNET_GENESIS) { block('wrong_cluster_genesis'); return; }

  const [configPda] = PublicKey.findProgramAddressSync([Buffer.from('config')], core);
  const [questConfigPda] = PublicKey.findProgramAddressSync([Buffer.from('quest_config')], quests);
  const [bankPda] = PublicKey.findProgramAddressSync([Buffer.from('potato_bank')], quests);
  const vaultAta = getAssociatedTokenAddressSync(mintKey, bankPda, true);
  report.observations.addresses = {
    potatoMint: mintKey.toBase58(), mindConfig: configPda.toBase58(),
    questConfig: questConfigPda.toBase58(), potatoBank: bankPda.toBase58(), requiredVaultAta: vaultAta.toBase58(),
  };
  try {
    const [coreInfo, questInfo, mintInfo, bankInfo, vaultInfo] = await withTimeout(connection.getMultipleAccountsInfo(
      [configPda, questConfigPda, mintKey, bankPda, vaultAta], 'confirmed'));
    if (!coreInfo || !coreInfo.owner.equals(core)) block('mind_config_missing_or_wrong_owner');
    else {
      const cfg: any = new BorshAccountsCoder(coreIdl as any).decode('Config', coreInfo.data);
      report.observations.mindMint = cfg.potato_mint.toBase58(); // historical ABI field: MIND, not Potato
      if (mintKey.equals(cfg.potato_mint)) block('potato_must_be_distinct_from_mind');
    }
    let quest: any;
    if (!questInfo || !questInfo.owner.equals(quests)) block('quest_config_missing_or_wrong_owner');
    else {
      quest = new BorshAccountsCoder(questsIdl as any).decode('QuestConfig', questInfo.data);
      report.observations.questMint = quest.mascot_mint.toBase58();
      report.observations.questTreasury = quest.treasury_mascot.toBase58();
      // The legacy quest treasury is isolated from V2 Potato spin inventory.
      // Old claims/refunds must remain on their original mint and custodian.
      report.observations.legacyQuestMintIsPotato = quest.mascot_mint.equals(mintKey);
    }
    if (!mintInfo || !mintInfo.owner.equals(TOKEN_PROGRAM_ID)) block('potato_spl_mint_missing');
    else {
      const mint = unpackMint(mintKey, mintInfo, TOKEN_PROGRAM_ID);
      report.observations.decimals = mint.decimals;
      report.observations.mintAuthority = mint.mintAuthority?.toBase58() ?? null;
      report.observations.freezeAuthority = mint.freezeAuthority?.toBase58() ?? null;
      // The 5 / 2..50 table is in WHOLE Potato. V2 converts using 9
      // decimals, an unconfirmed mint assumption; its paid commit is disabled.
      if (!mint.isInitialized || mint.decimals !== 9) block('potato_mint_requires_nine_decimals');
    }
    if (!bankInfo || !bankInfo.owner.equals(quests)) block('potato_bank_missing_or_wrong_owner');
    else {
      const bank: any = new BorshAccountsCoder(questsIdl as any).decode('PotatoBank', bankInfo.data);
      const reserved = BigInt(bank.reserved_atoms.toString());
      const spins = BigInt(bank.open_spins);
      report.observations.bank = { mint: bank.mint.toBase58(), vault: bank.vault.toBase58(),
        reservedAtoms: reserved.toString(), openSpins: spins.toString(), paused: bank.paused };
      if (!bank.mint.equals(mintKey) || !bank.vault.equals(vaultAta)) block('potato_bank_mint_or_vault_mismatch');
      if (reserved !== spins * 50n * 1_000_000_000n) block('potato_bank_reserve_inconsistent');
      if (bank.paused !== true) block('potato_bank_not_paused_for_preflight');
    }
    if (!vaultInfo || !vaultInfo.owner.equals(TOKEN_PROGRAM_ID)) block('potato_vault_ata_missing');
    else {
      const account = unpackAccount(vaultAta, vaultInfo, TOKEN_PROGRAM_ID);
      if (!account.mint.equals(mintKey) || !account.owner.equals(bankPda)) block('potato_vault_custody_mismatch');
      report.observations.vaultAtoms = account.amount.toString();
      // Inspect available backing, not merely a single jackpot. A successful
      // read remains NOT a signable transaction and cannot authorise payments.
      if (bankInfo && bankInfo.owner.equals(quests)) {
        const bank: any = new BorshAccountsCoder(questsIdl as any).decode('PotatoBank', bankInfo.data);
        if (account.amount < BigInt(bank.reserved_atoms.toString()) + 50n * 1_000_000_000n)
          block('potato_vault_below_existing_reserve_plus_one_maximum_prize');
      }
    }
  } catch { block('account_decode_or_rpc_failed'); }
}

inspect().catch(() => block('inspection_failed')).finally(() => {
  report.status = report.blockers.length ? 'BLOCKED' : 'MINT_AND_CUSTODY_OBSERVED_NOT_PAYMENT_READY';
  console.log(JSON.stringify(report, null, 2));
  if (report.blockers.length) process.exitCode = 1;
});
