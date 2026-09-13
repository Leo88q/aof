/**
 * Полная формула Trust Index из ТЗ (9 компонентов + штрафной множитель).
 * Диапазон: 0-1000, тиры 1-5.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

export interface TrustBreakdown {
  ageScore: number;         // макс 100
  referralScore: number;    // макс 150
  traderScore: number;      // макс 150 (старт 75)
  stakingScore: number;     // макс 100
  rebirthScore: number;     // макс 100
  guildScore: number;       // макс 100
  compendiumScore: number;  // макс 100
  questScore: number;       // макс 100
  craftRepScore: number;    // макс 100
  antiBotScore: number;     // макс 100 (NEW: Sentinel AuditLog)
  penaltyMult: number;      // ×0.4 / ×0.7 / ×0.85 перемножаются
}

// Компонент 1: Возраст аккаунта (макс 100 за 180 дней)
async function calcAgeScore(user: string): Promise<number> {
  const firstActivity = await db.streak.findUnique({ where: { user } });
  if (!firstActivity?.lastLogin) return 0;
  const days = (Date.now() - new Date(firstActivity.lastLogin).getTime()) / 86400000;
  return Math.min(100, Math.floor((days * 100) / 180));
}

// Компонент 2: Здоровье реферальной сети (макс 150)
// [ФИКС] Градуированный скоринг вместо бинарного 0/150
async function calcReferralScore(user: string): Promise<number> {
  const sybilFlags = await db.trustFlag.count({
    where: { user, flagType: "sybil", active: true },
  });
  if (sybilFlags > 0) return 0;
  const stats = await db.referralStatsDb.findUnique({ where: { user } });
  if (!stats) return 75; // нейтрально без рефералов (было 150 — слишком щедро)
  const direct = Math.min(stats.directCount, 25);
  const l2 = Math.min(stats.l2Count, 5);
  const score = 50 + Math.min(60, direct * 6) + Math.min(40, l2 * 8);
  return Math.max(0, Math.min(150, score));
}

// Компонент 3: Честность торговли ботом (старт 75, макс 150)
async function calcTraderScore(user: string): Promise<number> {
  const executions = await db.traderExecution.findMany({
    where: {
      user,
      ts: { gte: new Date(Date.now() - 30 * 86400000) },
    },
  });
  if (executions.length === 0) return 75; // Нейтрально для новых
  const successRate = executions.filter((e) => e.success).length / executions.length;
  // Линейно от 75 до 150 по success rate
  return Math.floor(75 + successRate * 75);
}

// Компонент 4: Лояльность стейкинга (макс 100)
// [ФИКС] Градуированный скоринг вместо бинарного 0/100: 20 за объект, кап 100
async function calcStakingScore(user: string): Promise<number> {
  const buildings = await db.farmBuilding.count({ where: { user } });
  return Math.min(100, buildings * 20);
}

// Компонент 5: Rebirth (20 за каждый, макс 100 на 5-м)
// После деплоя контрактов читает ончейн RebirthRecord через provider
async function calcRebirthScore(user: string): Promise<number> {
  try {
    // Пытаемся прочитать ончейн RebirthRecord
    const { rebirthProgram } = await import("../provider");
    const { rebirthRecordPda } = await import("./pda");
    const { PublicKey } = await import("@solana/web3.js");
    const userPk = new PublicKey(user);
    const [recordPda] = rebirthRecordPda(userPk);
    const record: any = await (rebirthProgram.account as any)["rebirthRecord"]
      .fetch(recordPda)
      .catch(() => null);
    if (record) {
      const rebirthCount = Number(record.rebirthCount.toString());
      return Math.min(100, rebirthCount * 20);
    }
  } catch {}
  // Фоллбэк: контракты не задеплоены → 0
  return 0;
}

// Компонент 6: Вклад в гильдию (макс 100)
async function calcGuildScore(user: string): Promise<number> {
  const deposits = await db.guildActivity.count({
    where: {
      actor: user,
      action: "deposit",
      ts: { gte: new Date(Date.now() - 60 * 86400000) },
    },
  });
  return Math.min(100, deposits * 10);
}

// Компонент 7: Компендиум (процент заполнения)
async function calcCompendiumScore(user: string): Promise<number> {
  const seen = await db.compendiumEntry.count({ where: { user } });
  return Math.min(100, Math.round((seen / 20) * 100));
}

// Компонент 8: Консистентность заданий (макс 100)
// [ФИКС] Реальные данные квестов из QuestProgressDb вместо прокси через стрик
async function calcQuestScore(user: string): Promise<number> {
  const completed = await db.questProgressDb.count({
    where: { user, completed: true },
  });
  const recent = await db.questProgressDb.count({
    where: { user, updatedAt: { gte: new Date(Date.now() - 30 * 86400000) } },
  });
  return Math.min(100, completed * 15 + recent * 5);
}

// Компонент 9: Репутация исполнителя (макс 100)
// Прокси: успешность сделок бота + отсутствие ошибок в исполнениях
async function calcCraftRepScore(user: string): Promise<number> {
  const executions = await db.traderExecution.findMany({
    where: { user, ts: { gte: new Date(Date.now() - 90 * 86400000) } },
  });
  if (executions.length === 0) return 50; // Нейтрально для новых

  const successRate = executions.filter((e) => e.success).length / executions.length;
  const disputePenalty = executions.filter((e) => e.error?.includes("dispute")).length * 10;

  // Базовые 50 + до 50 за успешность − штрафы за споры
  const score = 50 + Math.floor(successRate * 50) - disputePenalty;
  return Math.max(0, Math.min(100, score));
}


// Компонент 10: Анти-бот детекция через Sentinel AuditLog (макс 100)
// [NEW] Анализирует паттерны активности игрока из audit logs
async function calcAntiBotScore(user: string): Promise<number> {
  try {
    const now = Date.now();
    const last24h = new Date(now - 24 * 3600 * 1000);
    const last7d = new Date(now - 7 * 24 * 3600 * 1000);
    
    // Получаем все действия за 24 часа
    const actions24h = await db.auditLog.findMany({
      where: { 
        user,
        timestamp: { gte: last24h }
      },
      orderBy: { timestamp: "asc" }
    });
    
    // Получаем действия за 7 дней
    const actions7d = await db.auditLog.count({
      where: {
        user,
        timestamp: { gte: last7d }
      }
    });
    
    // Фактор 1: Разнообразие действий (bots делают одно и то же)
    const uniqueActions = new Set(actions24h.map(a => a.action)).size;
    const diversityScore = Math.min(30, uniqueActions * 5); // до 30 за 6+ разных действий
    
    // Фактор 2: Распределение по времени суток (bots работают 24/7)
    const hours = actions24h.map(a => new Date(a.timestamp).getHours());
    const hourSet = new Set(hours);
    const timeSpread = hourSet.size;
    // Реальные игроки активны 4-12 часов в сутки
    const naturalSpread = (timeSpread >= 4 && timeSpread <= 14) ? 25 : 10;
    
    // Фактор 3: Интервалы между действиями (bots действуют с фиксированными интервалами)
    let intervalScore = 25; // по умолчанию хорошо
    if (actions24h.length >= 5) {
      const intervals: number[] = [];
      for (let i = 1; i < actions24h.length; i++) {
        const diff = (new Date(actions24h[i].timestamp).getTime() - 
                     new Date(actions24h[i-1].timestamp).getTime()) / 1000;
        intervals.push(diff);
      }
      
      if (intervals.length >= 3) {
        const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const variance = intervals.reduce((sum, i) => sum + Math.pow(i - avg, 2), 0) / intervals.length;
        const stdDev = Math.sqrt(variance);
        
        // Bots имеют очень низкую вариативность (stdDev < 5% от avg)
        // Реальные игроки имеют высокую вариативность
        const cv = avg > 0 ? stdDev / avg : 0; // coefficient of variation
        
        if (cv < 0.1) intervalScore = 5;       // подозрительно: почти идеальные интервалы
        else if (cv < 0.3) intervalScore = 15; // настороже
        else if (cv < 0.7) intervalScore = 20; // нормально
        else intervalScore = 25;                // хорошо: разнообразное поведение
      }
    }
    
    // Фактор 4: Соотношение успех/неудача (bots часто ошибаются)
    const successCount = actions24h.filter(a => a.result === "success").length;
    const successRate = actions24h.length > 0 ? successCount / actions24h.length : 0.5;
    const successScore = Math.floor(successRate * 20); // до 20 за 100% успех
    
    const total = diversityScore + naturalSpread + intervalScore + successScore;
    return Math.min(100, Math.max(0, total));
  } catch (e) {
    // Fallback: если AuditLog не доступен — нейтральный скор
    return 50;
  }
}

// Штрафной множитель из активных флагов
async function calcPenaltyMult(user: string): Promise<number> {
  const flags = await db.trustFlag.findMany({
    where: { user, active: true },
  });
  let mult = 1.0;
  for (const flag of flags) {
    mult *= flag.mult;
  }
  return mult;
}

export async function computeTrustIndex(user: string): Promise<{
  score: number;
  tier: number;
  breakdown: TrustBreakdown;
}> {
  const [
    ageScore,
    referralScore,
    traderScore,
    stakingScore,
    rebirthScore,
    guildScore,
    compendiumScore,
    questScore,
    craftRepScore,
    antiBotScore,
    penaltyMult,
  ] = await Promise.all([
    calcAgeScore(user),
    calcReferralScore(user),
    calcTraderScore(user),
    calcStakingScore(user),
    calcRebirthScore(user),
    calcGuildScore(user),
    calcCompendiumScore(user),
    calcQuestScore(user),
    calcCraftRepScore(user),
    calcAntiBotScore(user),
    calcPenaltyMult(user),
  ]);

  const rawSum =
    ageScore + referralScore + traderScore + stakingScore +
    rebirthScore + guildScore + compendiumScore + questScore + craftRepScore + antiBotScore;

  const score = Math.max(0, Math.min(1000, Math.floor(rawSum * penaltyMult)));

  // Тиры из ТЗ
  const tier =
    score >= 800 ? 5 :
    score >= 600 ? 4 :
    score >= 400 ? 3 :
    score >= 200 ? 2 : 1;

  return {
    score,
    tier,
    breakdown: {
      ageScore, referralScore, traderScore, stakingScore, rebirthScore,
      guildScore, compendiumScore, questScore, craftRepScore, antiBotScore, penaltyMult,
    },
  };
}

// Лимиты Farm-Trader по тирам (эквивалент SOL/день)
export function getTraderLimit(tier: number): number {
  const base = 0.5;
  const multipliers: Record<number, number> = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 20 };
  return base * (multipliers[tier] || 1);
}

// Скидки на комиссии по тирам
export function getFeeDiscount(tier: number): number {
  const discounts: Record<number, number> = { 1: 0, 2: 5, 3: 10, 4: 15, 5: 20 };
  return discounts[tier] || 0;
}

// Holding period рефералки по тирам (часы)
export function getHoldingPeriod(tier: number): number {
  const periods: Record<number, number> = { 1: 72, 2: 48, 3: 24, 4: 12, 5: 0 };
  return periods[tier] || 72;
}
