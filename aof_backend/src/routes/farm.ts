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
    const building = await db.farmBuilding.upsert({
      where: { user_tileX_tileY: { user, tileX, tileY } },
      update: { toolMint, type },
      create: { user, tileX, tileY, toolMint, type },
    });
    res.json({ building });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Расширить участок (за ресурсы — проверка на бэкенде)
r.post("/plot/expand", async (req, res) => {
  try {
    const { user } = req.body;
    const plot = await db.farmPlot.findUnique({ where: { user } });
    if (!plot) {
      return res.status(404).json({ error: "Plot not found" });
    }
    const newSize = plot.size + 2;
    const updated = await db.farmPlot.update({
      where: { user },
      data: { size: newSize, expandedAt: new Date() },
    });
    res.json({ plot: updated });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
