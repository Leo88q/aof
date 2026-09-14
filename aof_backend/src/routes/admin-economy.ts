import { Router } from "express";
import { db } from "../lib/db";
import { takeEconomySnapshot } from "../lib/economyMonitor";
import { requireAdmin } from "../middleware/adminAuth";

const r = Router();
r.use(requireAdmin);

/**
 * GET /admin/economy/snapshots
 * Последние snapshots экономики
 */
r.get("/snapshots", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const snapshots = await db.economySnapshot.findMany({
      orderBy: { timestamp: "desc" },
      take: limit,
    });
    
    // [ФИКС] Конвертируем BigInt поля в string для JSON
    const safe = snapshots.map((s: any) => ({
      ...s,
      potatoSupply: s.potatoSupply.toString(),
      potatoBurned24h: s.potatoBurned24h.toString(),
      potatoMinted24h: s.potatoMinted24h.toString(),
    }));
    
    res.json(safe);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * GET /admin/economy/alerts
 * Активные алерты
 */
r.get("/alerts", async (req, res) => {
  try {
    const unresolved = req.query.unresolved === "true";
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    
    const where: any = {};
    if (unresolved) where.resolved = false;
    
    const alerts = await db.economyAlert.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: limit,
    });
    
    res.json(alerts);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * POST /admin/economy/snapshot
 * Ручной запуск snapshot
 */
r.post("/snapshot", async (req, res) => {
  try {
    const metrics = await takeEconomySnapshot();
    res.json({ success: true, metrics });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * POST /admin/economy/alerts/:id/resolve
 * Пометить алерт как решённый
 */
r.post("/alerts/:id/resolve", async (req, res) => {
  try {
    const { id } = req.params;
    await db.economyAlert.update({
      where: { id },
      data: {
        resolved: true,
        resolvedAt: new Date(),
      },
    });
    
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
