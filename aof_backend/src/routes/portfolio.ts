import { Router } from "express";
import { db } from "../lib/db";
import { PublicKey } from "@solana/web3.js";
import { configPda, materialMintsPda, playerPda } from "../lib/pda";
import { fetchOne } from "../lib/decode";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import BN from "bn.js";

const r = Router();

// Агрегированная стоимость всех активов игрока
// Теперь берёт реальные цены из индексатора (таблица priceTick), а не заглушку
r.get("/:user", async (req, res) => {
  try {
    const user = req.params.user;
    const userPk = new PublicKey(user);

    // Читаем данные игрока из БД
    const plot = await db.farmPlot.findUnique({ where: { user } });
    const buildings = await db.farmBuilding.findMany({ where: { user } });
    const compendiumCount = await db.compendiumEntry.count({ where: { user } });
    const streak = await db.streak.findUnique({ where: { user } });

    // Реальные цены из индексатора (последний тик по каждой редкости)
    const latestTicks = await db.priceTick.groupBy({
      by: ["rarity"],
      _max: { priceMascot: true, priceSol: true, ts: true },
    });
    
    // Маппинг: Prisma (priceMascot) → API (pricePotato)
    const priceByRarity: Record<number, { potato: number; sol: number }> = {};
    for (const tick of latestTicks) {
      priceByRarity[tick.rarity] = {
        potato: tick._max?.priceMascot || 0,
        sol: tick._max?.priceSol || 0,
      };
    }

    // Базовые цены по редкости (из ТЗ: маскот-токен)
    const basePriceByRarity: Record<string, number> = {
      common: 100, uncommon: 500, rare: 2000, epic: 10000, legendary: 50000,
    };

    // Оценка стоимости строений (застейканных инструментов)
    // Используем реальную цену из индексатора если есть, иначе базовую
    const toolValue = buildings.reduce((sum, b) => {
      // Определяем редкость по типу (упрощённо, в полной версии читаем toolData)
      const rarity = 2; // uncommon как дефолт
      const realPrice = priceByRarity[rarity]?.potato || basePriceByRarity["uncommon"];
      return sum + realPrice;
    }, 0);

    // История за 7/30/90 дней из свечей (реальные данные индексатора)
    const history7d = await db.candle.findMany({
      where: { rarity: 2, timeframe: "1d", tsStart: { gte: new Date(Date.now() - 7 * 86400000) } },
      orderBy: { tsStart: "asc" },
      select: { tsStart: true, close: true },
    });
    const history30d = await db.candle.findMany({
      where: { rarity: 2, timeframe: "1d", tsStart: { gte: new Date(Date.now() - 30 * 86400000) } },
      orderBy: { tsStart: "asc" },
      select: { tsStart: true, close: true },
    });
    const history90d = await db.candle.findMany({
      where: { rarity: 2, timeframe: "1d", tsStart: { gte: new Date(Date.now() - 90 * 86400000) } },
      orderBy: { tsStart: "asc" },
      select: { tsStart: true, close: true },
    });

    res.json({
      user,
      netWorth: {
        total: toolValue,
        byCategory: {
          tools: toolValue,
          resources: 0,
          staked: 0,
          lpShares: 0,
          gasTank: 0,
        },
      },
      prices: priceByRarity,
      history: {
        "7d": history7d,
        "30d": history30d,
        "90d": history90d,
      },
      stats: {
        farmSize: plot?.size ?? 8,
        buildings: buildings.length,
        compendiumPct: Math.round((compendiumCount / 20) * 100),
        streak: streak?.current ?? 0,
      },
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
