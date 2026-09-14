import { Router } from "express";
import { db } from "../lib/db";
import { requireAdmin } from "../middleware/adminAuth";

const r = Router();
r.use(requireAdmin);

/**
 * GET /admin/audit/logs
 * Последние audit logs.
 * В dev открыто. Перед продом нужно закрыть authority/admin проверкой.
 */
r.get("/logs", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const user = req.query.user as string | undefined;
    const action = req.query.action as string | undefined;

    const where: any = {};
    if (user) where.user = user;
    if (action) where.action = action;

    const logs = await db.auditLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: limit,
    });

    res.json(logs);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * GET /admin/audit/stats
 * Группировка по actions.
 */
r.get("/stats", async (_req, res) => {
  try {
    const stats = await db.auditLog.groupBy({
      by: ["action"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    });

    res.json(stats);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
