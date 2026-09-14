import { Router } from "express";
import { requireAdmin } from "../middleware/adminAuth";

const r = Router();

/**
 * GET /npc/stats
 * Статистика NPC торговцев
 */
r.get("/stats", async (_req, res) => {
  // Do not expose historical/random audit rows as live market activity.
  res.json({
    enabled: false,
    reason: "NPC trading is unavailable until canonical orderbook settlement is deployed",
  });
});

/**
 * POST /npc/run
 * Ручной запуск цикла NPC (для тестирования)
 */
r.post("/run", requireAdmin, async (_req, res) => {
  res.status(503).json({
    error: "NPC trading is unavailable until canonical orderbook settlement is deployed",
  });
});

export default r;
