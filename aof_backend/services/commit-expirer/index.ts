/**
 * Commit-Expirer: возврат средств по просроченным commit-reveal коммитам.
 *
 * Обслуживает паки (PackCommit → pack_open_expire: возврат SOL-escrow) и
 * кузницу (ForgeCommit → forge_attempt_expire: возврат SOL-fee из escrow и
 * ре-минт сожжённых wood/stone). Если сервер по любой причине не сделал
 * reveal за окно SlotHashes, воркер возвращает всё игроку (адрес берётся из
 * самого аккаунта коммита, не из внешних данных).
 *
 * Инструкция permissionless и сама проверяет `slot - commit_slot >=
 * COMMIT_EXPIRY_SLOTS`, поэтому воркер безопасен при любых гонках: раньше
 * срока получит CommitNotExpired, после reveal аккаунта уже нет.
 *
 * Запуск: npm run commit-expirer   (ts-node services/commit-expirer/index.ts)
 * Интервал: EXPIRER_INTERVAL_MS, по умолчанию 2 мин (прод) / 20с (локал).
 */
import { program, connection } from "../../src/provider";
import { configPda } from "../../src/lib/pda";
import { authorityOnly } from "../../src/lib/tx";
import { markUsed } from "../../src/lib/secretStore";
import { buildForgeExpireIx } from "../../src/routes/forge";

// Должно совпадать с aof-core/src/constants.rs::COMMIT_EXPIRY_SLOTS.
const COMMIT_EXPIRY_SLOTS = 600;

const EXPIRER_INTERVAL_MS = Number(process.env.EXPIRER_INTERVAL_MS) > 0
  ? Number(process.env.EXPIRER_INTERVAL_MS)
  : process.env.NODE_ENV === "production"
    ? 2 * 60 * 1000
    : 20 * 1000;

async function expirePacks(): Promise<void> {
  const slot = await connection.getSlot("confirmed");
  const commits: Array<{ publicKey: any; account: any }> = await (program.account as any).packCommit.all();
  let refunded = 0;
  for (const { publicKey, account } of commits) {
    if (account.revealed) continue;
    const age = slot - Number(account.commitSlot);
    if (age < COMMIT_EXPIRY_SLOTS) continue;
    try {
      const ix = await (program.methods as any)
        .packOpenExpire()
        .accounts({ config: configPda()[0], packCommit: publicKey, user: account.user, mint: account.mint })
        .instruction();
      const sig = await authorityOnly([ix]);
      await markUsed(`pack:${account.mint.toBase58()}`).catch(() => {});
      refunded++;
      console.log(`[commit-expirer] pack ${account.mint.toBase58()}: refunded ${account.paidLamports.toString()} lamports to ${account.user.toBase58()}, age=${age} slots, sig=${sig}`);
    } catch (e: any) {
      // CommitNotExpired / AccountNotFound после гонки с reveal — не ошибка.
      console.warn(`[commit-expirer] pack ${account.mint.toBase58()}: пропуск — ${e.message}`);
    }
  }
  console.log(`[commit-expirer] packs: ${commits.length} коммитов, возвращено ${refunded}`);
}

async function expireForge(): Promise<void> {
  const slot = await connection.getSlot("confirmed");
  const commits: Array<{ publicKey: any; account: any }> = await (program.account as any).forgeCommit.all();
  let refunded = 0;
  for (const { publicKey, account } of commits) {
    const age = slot - Number(account.commitSlot);
    if (age < COMMIT_EXPIRY_SLOTS) continue;
    try {
      const ix = await buildForgeExpireIx(publicKey);
      const sig = await authorityOnly([ix]);
      await markUsed(`forge:${account.toolMint.toBase58()}:${account.slotType}`).catch(() => {});
      refunded++;
      console.log(`[commit-expirer] forge ${account.toolMint.toBase58()}/${account.slotType}: refunded ${account.paidLamports.toString()} lamports + wood/stone to ${account.user.toBase58()}, age=${age}, sig=${sig}`);
    } catch (e: any) {
      console.warn(`[commit-expirer] forge ${account.toolMint.toBase58()}/${account.slotType}: пропуск — ${e.message}`);
    }
  }
  console.log(`[commit-expirer] forge: ${commits.length} коммитов, возвращено ${refunded}`);
}

async function cycle(): Promise<void> {
  console.log(`[commit-expirer] Цикл начат (${new Date().toISOString()})`);
  for (const step of [expirePacks, expireForge]) {
    try {
      await step();
    } catch (e: any) {
      console.error(`[commit-expirer] ошибка ${step.name}`, e.message);
    }
  }
}

async function main() {
  console.log(`[commit-expirer] Запуск, интервал ${EXPIRER_INTERVAL_MS}мс`);
  await cycle();
  setInterval(cycle, EXPIRER_INTERVAL_MS);
}

main().catch(console.error);
