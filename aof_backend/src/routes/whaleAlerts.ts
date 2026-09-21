import { Router } from "express";
import { db } from "../lib/db";
import { requireAdmin } from "../middleware/adminAuth";

const r = Router();

// Лента крупных сделок (публичная, как в крипто-ботах).
// Отдаёт только агрегированные поля (type/mint/amount/price/ts) — кошельков
// в модели нет. Защищена readLimiter на уровне server.ts.
r.get("/feed", async (req, res) => {
  try {
    const parsed = Number(req.query.limit);
    const limit = Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), 100) : 20;
    const alerts = await db.whaleAlert.findMany({
      orderBy: { ts: "desc" },
      take: limit,
      select: { id: true, type: true, mint: true, amount: true, price: true, ts: true },
    });
    res.json({ alerts });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Записать крупную сделку (вызывается индексатором при превышении порога)
r.post("/record", requireAdmin, async (req, res) => {
  try {
    const { type, mint, amount, price } = req.body;
    const alert = await db.whaleAlert.create({
      data: { type, mint, amount, price },
    });
    res.json({ alert });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
