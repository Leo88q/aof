import { getExpiredCommits, markUsed } from "./secretStore";
import { prisma } from "./db";

/**
 * Фоновый воркер: обрабатывает протухшие коммиты.
 * В идеале должен вызывать on-chain reveal-инструкцию.
 * Пока что просто помечает как использованные + логирует.
 *
 * TODO (этап 2): добавить реальный CPI к on-chain программе
 */
export async function runCommitRevealer(): Promise<void> {
  try {
    const expired = await getExpiredCommits(50);
    if (expired.length === 0) return;

    console.log(`🕐 [CommitRevealer] Found ${expired.length} expired commits`);

    for (const record of expired) {
      try {
        // TODO: Здесь должен быть on-chain reveal
        // const secret = Buffer.from(record.secret, "hex");
        // await submitRevealTx(record.key, secret);

        await markUsed(record.key);
        console.log(`  ✅ Revealed: ${record.key}`);
      } catch (e) {
        console.error(`  ❌ Failed to reveal ${record.key}:`, e);
      }
    }
  } catch (e) {
    console.error("[CommitRevealer] Error:", e);
  }
}

/**
 * Запускает воркер с заданным интервалом.
 */
export function startCommitRevealer(intervalMs: number = 60_000): NodeJS.Timeout {
  console.log(`✅ [CommitRevealer] Started (every ${intervalMs / 1000}s)`);
  return setInterval(runCommitRevealer, intervalMs);
}
