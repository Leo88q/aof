import { Router } from "express";
import { db } from "../lib/db";

const r = Router();

// Сезонные "лови сейчас" списки (из ТЗ: "обновляемый список 'лови сейчас'")
const SEASONAL_TARGETS: Record<number, { toolType: string; rarity: string }[]> = {
  1: [
    { toolType: "plasma_cutter", rarity: "epic" },
    { toolType: "silicon_extractor", rarity: "legendary" },
  ],
  2: [
    { toolType: "data_harvester", rarity: "epic" },
    { toolType: "quantum_transmitter", rarity: "legendary" },
    { toolType: "neural_seeder", rarity: "rare" },
  ],
};

// Текущий сезонный компендиум (цели для текущего сезона)
r.get("/:user", async (req, res) => {
  try {
    const user = req.params.user;
    const seasonId = Number(req.query.seasonId || 1);
    const targets = SEASONAL_TARGETS[seasonId] || [];

    // Проверяем какие цели уже выполнены
    const entries = await db.compendiumEntry.findMany({ where: { user } });
    const seasonalProgress = targets.map((target) => ({
      ...target,
      caught: entries.some(
        (e: { toolType: string; rarity: string }) => e.toolType === target.toolType && e.rarity === target.rarity
      ),
    }));

    const caughtCount = seasonalProgress.filter((t) => t.caught).length;
    res.json({
      seasonId,
      targets: seasonalProgress,
      progress: {
        caught: caughtCount,
        total: targets.length,
        pct: targets.length > 0 ? Math.round((caughtCount / targets.length) * 100) : 0,
      },
      reward: caughtCount === targets.length && targets.length > 0
        ? { type: "seasonal_complete", bonus: "exclusive_skin" }
        : null,
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
