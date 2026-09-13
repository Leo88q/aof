import { Router } from "express";
import { db } from "../../lib/db";
import { apiKeyAuth } from "../../middleware/apiKey";

const r = Router();

// Все эндпоинты публичного API требуют API-ключ
r.use(apiKeyAuth);

// Текущие цены по всем редкостям
r.get("/prices", async (req, res) => {
  try {
    const latestTicks = await db.priceTick.groupBy({
      by: ["rarity"],
      _max: { priceMascot: true, priceSol: true, ts: true },
    });
    res.json({
      prices: latestTicks.map((t) => ({
        rarity: t.rarity,
        pricePotato: t._max?.priceMascot || 0,
        priceSol: t._max?.priceSol || 0,
        ts: t._max?.ts || new Date(),
      })),
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Свечи для графиков
r.get("/candles/:rarity", async (req, res) => {
  try {
    const rarity = Number(req.params.rarity);
    const timeframe = (req.query.tf as string) || "1m";
    const limit = Math.min(Number(req.query.limit || 100), 500);

    const candles = await db.candle.findMany({
      where: { rarity, timeframe },
      orderBy: { tsStart: "desc" },
      take: limit,
    });
    res.json({ candles: candles.reverse() });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Общая статистика игры
r.get("/stats", async (req, res) => {
  try {
    const [totalPlayers, totalGuilds, totalQuests, activeToday] = await Promise.all([
      db.profile.count(),
      db.guild.count(),
      db.questProgressDb.count(),
      db.streak.count({
        where: { lastLogin: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      }),
    ]);
    res.json({ totalPlayers, totalGuilds, totalQuests, activeToday });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Лидерборд топ-100
r.get("/leaderboard/:period/:periodId", async (req, res) => {
  try {
    const { period, periodId } = req.params;
    const limit = Math.min(Number(req.query.limit || 100), 100);

    const snapshot = await db.leaderboardSnapshot.findUnique({
      where: { period_periodId: { period, periodId: Number(periodId) } },
    });
    if (!snapshot) return res.status(404).json({ error: "Snapshot not found" });

    const entries = await db.leaderboardEntry.findMany({
      where: { snapshotId: snapshot.id },
      orderBy: { rank: "asc" },
      take: limit,
    });
    res.json({ merkleRoot: snapshot.merkleRoot, entries });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
