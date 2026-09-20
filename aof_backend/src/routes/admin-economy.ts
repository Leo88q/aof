import { Router } from "express";
import { db } from "../lib/db";
import { takeEconomySnapshot } from "../lib/economyMonitor";
import { ECONOMY_FIELD_QUALITY, worstQuality } from "../lib/dataQuality";
import { adminByMethod } from "../middleware/adminAuth";

const r = Router();
r.use(adminByMethod);

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
    
    // Persisted snapshots carry no provenance column; attach the provenance
    // of the code that produced them so the dashboard never renders a
    // placeholder zero (unimplemented indexer) as a measured value.
    const safe = snapshots.map((s: any) => {
      let fieldQuality = ECONOMY_FIELD_QUALITY;
      if (s.fieldQuality) { try { fieldQuality = { ...ECONOMY_FIELD_QUALITY, ...JSON.parse(s.fieldQuality) }; } catch { /* keep baseline */ } }
      const dataQuality = worstQuality(fieldQuality);
      return {
        ...s,
        potatoSupply: s.potatoSupply.toString(),
        potatoBurned24h: fieldQuality.potatoBurned24h === "unavailable" ? null : s.potatoBurned24h.toString(),
        potatoMinted24h: fieldQuality.potatoMinted24h === "unavailable" ? null : s.potatoMinted24h.toString(),
        dataQuality,
        fieldQuality,
      };
    });
    
    res.setHeader("X-Data-Quality", safe[0]?.dataQuality ?? worstQuality(ECONOMY_FIELD_QUALITY));
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
