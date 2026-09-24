import { Router } from "express";
import { validate } from "../middleware/validate";
import { compendiumMarkSeenSchema } from "../lib/validation";
import { db } from "../lib/db";
import { requireAdmin } from "../middleware/adminAuth";
import { requireWalletProof } from "../security/walletProof";

const r = Router();

// [REBRAND] NeuroForge tool ids; legacy pre-rebrand ids are normalized
// so tools minted before the rebrand still register in the catalog.
const TOOL_TYPES = ["plasma_cutter", "silicon_extractor", "data_harvester", "quantum_transmitter", "neural_seeder"];
const LEGACY_TOOL_IDS: Record<string, string> = {
  axe: "plasma_cutter",
  pick: "silicon_extractor",
  spear: "data_harvester",
  bow: "quantum_transmitter",
  reaper: "neural_seeder",
};
const normalizeToolType = (t: string) => TOOL_TYPES.includes(t) ? t : (LEGACY_TOOL_IDS[t] || t);
const RARITIES = ["common", "uncommon", "rare", "epic", "legendary"];
const TOTAL_ENTRIES = TOOL_TYPES.length * RARITIES.length; // 20

// Отметить что инструмент "виден" (при получении/крафте/покупке)
r.post("/mark-seen", requireWalletProof("compendium_mark_seen", "user"), validate(compendiumMarkSeenSchema), async (req, res) => {
  try {
    const { user, rarity } = req.body;
    const toolType = normalizeToolType(req.body.toolType);
    if (!TOOL_TYPES.includes(toolType) || !RARITIES.includes(rarity)) {
      return res.status(400).json({ error: "Invalid toolType or rarity" });
    }
    await db.compendiumEntry.upsert({
      where: { user_toolType_rarity: { user, toolType, rarity } },
      update: {},
      create: { user, toolType, rarity },
    });
    const progress = await computeProgress(user);
    res.json({ progress });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Прогресс компендиума + награды за 25/50/75/100%
async function computeProgress(user: string) {
  const seen = await db.compendiumEntry.count({ where: { user } });
  const pct = Math.round((seen / TOTAL_ENTRIES) * 100);
  const milestones = [25, 50, 75, 100].filter((m) => pct >= m);
  return { seen, total: TOTAL_ENTRIES, pct, milestones };
}

r.get("/:user", async (req, res) => {
  try {
    const user = req.params.user;
    const entries = await db.compendiumEntry.findMany({ where: { user } });
    const progress = await computeProgress(user);
    // Матрица для фронтенда: какие ячейки заполнены
    const grid = TOOL_TYPES.map((t) => ({
      toolType: t,
      rarities: RARITIES.map((r2) => ({
        rarity: r2,
        seen: entries.some((e) => e.toolType === t && e.rarity === r2),
      })),
    }));
    res.json({ grid, progress });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
