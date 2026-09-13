/**
 * Trust-Index Worker: пересчёт индекса для активных аккаунтов.
 * Запуск: npx ts-node services/trust-worker/index.ts
 * Интервал: раз в 6 часов (по ТЗ), для локальной разработки — 1 мин.
 */
import { PrismaClient } from "@prisma/client";
import { computeTrustIndex } from "../../src/lib/trustFormula";

const db = new PrismaClient();
const RECALC_INTERVAL_MS = process.env.NODE_ENV === "production"
  ? 6 * 3600 * 1000  // 6 часов в проде
  : 60 * 1000;        // 1 минута локально

// [ФИКС] Пуш снапшота ончейн после пересчёта индекса в БД.
// Без этого TrustSnapshot PDA всегда пустой и session_create не может его прочитать.
// ВАЖНО: вызывается из recalcAll после успешной записи в БД (раньше здесь была
// рекурсия — функция звала саму себя, а реальный вызов в цикле отсутствовал).
async function pushTrustSnapshotOnChain(user: string, score: number, tier: number): Promise<void> {
  try {
    const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8080";
    const response = await fetch(BACKEND_URL + "/trust/snapshot/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user, score, tier }),
    });
    if (!response.ok) {
      const err: any = await response.json().catch(() => ({}));
      console.error("[trust-worker] snapshot push failed:", err.error || response.status);
      return;
    }
    const result: any = await response.json();
    console.log("[trust-worker] snapshot pushed onchain:", result.sig || "ok");
  } catch (e: any) {
    console.error("[trust-worker] snapshot push error:", e.message);
  }
}

async function getActiveUsers(): Promise<string[]> {
  // Активные = был стрик за последние 30 дней
  const streaks = await db.streak.findMany({
    where: { lastLogin: { gte: new Date(Date.now() - 30 * 86400000) } },
    select: { user: true },
  });
  return streaks.map((s) => s.user);
}

async function recalcAll() {
  const users = await getActiveUsers();
  console.log(`[trust-worker] Пересчёт для ${users.length} активных пользователей`);

  for (const user of users) {
    try {
      const { score, tier, breakdown } = await computeTrustIndex(user);

      await db.trustScore.upsert({
        where: { user },
        update: {
          score,
          tier,
          ageScore: breakdown.ageScore,
          referralScore: breakdown.referralScore,
          traderScore: breakdown.traderScore,
          stakingScore: breakdown.stakingScore,
          rebirthScore: breakdown.rebirthScore,
          guildScore: breakdown.guildScore,
          compendiumScore: breakdown.compendiumScore,
          questScore: breakdown.questScore,
          craftRepScore: breakdown.craftRepScore,
          penaltyMult: breakdown.penaltyMult,
          computedAt: new Date(),
        },
        create: {
          user,
          score,
          tier,
          ageScore: breakdown.ageScore,
          referralScore: breakdown.referralScore,
          traderScore: breakdown.traderScore,
          stakingScore: breakdown.stakingScore,
          rebirthScore: breakdown.rebirthScore,
          guildScore: breakdown.guildScore,
          compendiumScore: breakdown.compendiumScore,
          questScore: breakdown.questScore,
          craftRepScore: breakdown.craftRepScore,
          penaltyMult: breakdown.penaltyMult,
        },
      });

      // [ФИКС] Пушим снапшот ончейн после успешной записи в БД
      await pushTrustSnapshotOnChain(user, score, tier);

      console.log(`[trust-worker] ${user}: score=${score}, tier=${tier}`);
    } catch (e: any) {
      console.error(`[trust-worker] Ошибка для ${user}:`, e.message);
    }
  }
}

async function main() {
  console.log("[trust-worker] Запуск");
  await recalcAll();
  setInterval(recalcAll, RECALC_INTERVAL_MS);
}

main().catch(console.error);
