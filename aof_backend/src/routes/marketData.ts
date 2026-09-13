import { Router } from "express";
import { db } from "../lib/db";

const r = Router();

// Текущая цена по редкости (последний тик)
r.get("/price/:rarity", async (req, res) => {
  try {
    const rarity = Number(req.params.rarity);
    const tick = await db.priceTick.findFirst({
      where: { rarity },
      orderBy: { ts: "desc" },
    });
    res.json({ rarity, price: tick });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Свечи для графика (lightweight-charts)
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
    // Разворачиваем для графика (старые → новые)
    res.json({ candles: candles.reverse() });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Лента сделок (последние тики с buy/sell)
r.get("/trades/:rarity", async (req, res) => {
  try {
    const rarity = Number(req.params.rarity);
    const limit = Math.min(Number(req.query.limit || 20), 100);

    const trades = await db.priceTick.findMany({
      where: { rarity, side: { in: ["buy", "sell"] } },
      orderBy: { ts: "desc" },
      take: limit,
    });
    res.json({ trades });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
