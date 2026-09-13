"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeTrustIndex = computeTrustIndex;
exports.getTraderLimit = getTraderLimit;
exports.getFeeDiscount = getFeeDiscount;
exports.getHoldingPeriod = getHoldingPeriod;
/**
 * Полная формула Trust Index из ТЗ (9 компонентов + штрафной множитель).
 * Диапазон: 0-1000, тиры 1-5.
 */
const client_1 = require("@prisma/client");
const db = new client_1.PrismaClient();
// Компонент 1: Возраст аккаунта (макс 100 за 180 дней)
async function calcAgeScore(user) {
    const profile = await db.profile.findUnique({ where: { user } });
    if (!profile)
        return 0;
    const daysActive = (Date.now() - new Date(profile.id.slice(0, 8), 16).getTime()) / 86400000;
    // Упрощённо: используем дату создания первой записи
    const firstActivity = await db.streak.findUnique({ where: { user } });
    if (!firstActivity?.lastLogin)
        return 0;
    const days = (Date.now() - new Date(firstActivity.lastLogin).getTime()) / 86400000;
    return Math.min(100, Math.floor((days * 100) / 180));
}
// Компонент 2: Здоровье реферальной сети (макс 150)
async function calcReferralScore(user) {
    const stats = await db.referralStatsDb.findUnique({ where: { user } });
    if (!stats)
        return 150; // Нет рефералов = чистая сеть
    // Упрощённо: если есть флаги, снижаем
    const sybilFlags = await db.trustFlag.count({
        where: { user, flagType: "sybil", active: true },
    });
    if (sybilFlags > 0)
        return 0;
    return 150;
}
// Компонент 3: Честность торговли ботом (старт 75, макс 150)
async function calcTraderScore(user) {
    const executions = await db.traderExecution.findMany({
        where: {
            user,
            ts: { gte: new Date(Date.now() - 30 * 86400000) },
        },
    });
    if (executions.length === 0)
        return 75; // Нейтрально для новых
    const successRate = executions.filter((e) => e.success).length / executions.length;
    // Линейно от 75 до 150 по success rate
    return Math.floor(75 + successRate * 75);
}
// Компонент 4: Лояльность стейкинга (макс 100)
async function calcStakingScore(user) {
    // Упрощённо: проверяем активные стейки через БД-записи
    // В полной версии читаем ончейн Stake PDA
    const buildings = await db.farmBuilding.count({ where: { user } });
    // 100 очков если есть застейканные инструменты (упрощённо)
    return buildings > 0 ? 100 : 0;
}
// Компонент 5: Rebirth (20 за каждый, макс 100 на 5-м)
async function calcRebirthScore(user) {
    // Упрощённо: читаем из БД если есть запись, иначе 0
    // В полной версии читаем ончейн RebirthRecord
    return 0; // TODO: чтение ончейн после деплоя
}
// Компонент 6: Вклад в гильдию (макс 100)
async function calcGuildScore(user) {
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
async function calcCompendiumScore(user) {
    const seen = await db.compendiumEntry.count({ where: { user } });
    return Math.min(100, Math.round((seen / 20) * 100));
}
// Компонент 8: Консистентность заданий (макс 100)
async function calcQuestScore(user) {
    const streak = await db.streak.findUnique({ where: { user } });
    if (!streak)
        return 0;
    // Доля дней с активностью за последние 30 дней
    return Math.min(100, streak.current * 3);
}
// Компонент 9: Репутация исполнителя (макс 100)
async function calcCraftRepScore(user) {
    // Упрощённо: пока нет данных о CraftOrder в БД
    return 50; // Нейтрально
}
// Штрафной множитель из активных флагов
async function calcPenaltyMult(user) {
    const flags = await db.trustFlag.findMany({
        where: { user, active: true },
    });
    let mult = 1.0;
    for (const flag of flags) {
        mult *= flag.mult;
    }
    return mult;
}
async function computeTrustIndex(user) {
    const [ageScore, referralScore, traderScore, stakingScore, rebirthScore, guildScore, compendiumScore, questScore, craftRepScore, penaltyMult,] = await Promise.all([
        calcAgeScore(user),
        calcReferralScore(user),
        calcTraderScore(user),
        calcStakingScore(user),
        calcRebirthScore(user),
        calcGuildScore(user),
        calcCompendiumScore(user),
        calcQuestScore(user),
        calcCraftRepScore(user),
        calcPenaltyMult(user),
    ]);
    const rawSum = ageScore + referralScore + traderScore + stakingScore +
        rebirthScore + guildScore + compendiumScore + questScore + craftRepScore;
    const score = Math.max(0, Math.min(1000, Math.floor(rawSum * penaltyMult)));
    // Тиры из ТЗ
    const tier = score >= 800 ? 5 :
        score >= 600 ? 4 :
            score >= 400 ? 3 :
                score >= 200 ? 2 : 1;
    return {
        score,
        tier,
        breakdown: {
            ageScore, referralScore, traderScore, stakingScore, rebirthScore,
            guildScore, compendiumScore, questScore, craftRepScore, penaltyMult,
        },
    };
}
// Лимиты Farm-Trader по тирам (эквивалент SOL/день)
function getTraderLimit(tier) {
    const base = 0.5;
    const multipliers = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 20 };
    return base * (multipliers[tier] || 1);
}
// Скидки на комиссии по тирам
function getFeeDiscount(tier) {
    const discounts = { 1: 0, 2: 5, 3: 10, 4: 15, 5: 20 };
    return discounts[tier] || 0;
}
// Holding period рефералки по тирам (часы)
function getHoldingPeriod(tier) {
    const periods = { 1: 72, 2: 48, 3: 24, 4: 12, 5: 0 };
    return periods[tier] || 72;
}
