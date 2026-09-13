import { Router } from "express";
import { getMerchantStats, runMerchantCycle } from "../lib/npcMerchant";

const r = Router();

/**
 * GET /npc/stats
 * Статистика NPC торговцев
 */
r.get("/stats", async (req, res) => {
  try {
    const stats = await getMerchantStats();
    res.json(stats);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * POST /npc/run
 * Ручной запуск цикла NPC (для тестирования)
 */
r.post("/run", async (req, res) => {
  try {
    const actions = await runMerchantCycle();
    res.json({ success: true, actions });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
