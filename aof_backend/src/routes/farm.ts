import { Router } from "express";
import { db } from "../lib/db";

const r = Router();

// Получить участок фермы пользователя
r.get("/plot/:user", async (req, res) => {
  try {
    const user = req.params.user;
    let plot = await db.farmPlot.findUnique({ where: { user } });
    if (!plot) {
      plot = await db.farmPlot.create({ data: { user } });
    }
    const buildings = await db.farmBuilding.findMany({ where: { user } });
    res.json({ plot, buildings });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Разместить строение на тайле
r.post("/building/place", async (req, res) => {
  try {
    const { user, tileX, tileY, toolMint, type } = req.body;
    const x = Number(tileX);
    const y = Number(tileY);
    if (!user || !Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || !toolMint || !type) {
      return res.status(400).json({ error: "Invalid building placement" });
    }
    const plot = await db.farmPlot.findUnique({ where: { user } });
    if (!plot) return res.status(404).json({ error: "Plot not found" });
    if (x >= plot.size || y >= plot.size) {
      return res.status(400).json({ error: "Building must be placed inside the farm plot" });
    }
    const building = await db.farmBuilding.upsert({
      where: { user_tileX_tileY: { user, tileX: x, tileY: y } },
      update: { toolMint, type },
      create: { user, tileX: x, tileY: y, toolMint, type },
    });
    res.json({ building });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Расширить участок (за ресурсы — проверка на бэкенде)
r.post("/plot/expand", async (_req, res) => {
  // Expansion used to increase the off-chain plot size without charging the
  // configured resource cost. Fail closed until the canonical resource debit
  // and tile bounds are implemented together.
  return res.status(503).json({ error: "Farm expansion is unavailable until canonical resource settlement is deployed" });
});

export default r;
