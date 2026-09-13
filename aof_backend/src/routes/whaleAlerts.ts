import { Router } from "express";
import { db } from "../lib/db";

const r = Router();

// Лента крупных сделок (публичная, как в крипто-ботах)
r.get("/feed", async (req, res) => {
  try {
    const limit = Number(req.query.limit || 20);
    const alerts = await db.whaleAlert.findMany({
      orderBy: { ts: "desc" },
      take: Math.min(limit, 100),
    });
    res.json({ alerts });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Записать крупную сделку (вызывается индексатором при превышении порога)
r.post("/record", async (req, res) => {
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
