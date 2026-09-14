import { Router } from "express";
import { db } from "../lib/db";

const r = Router();

// Предустановленные территории (связаны с Exploration-локациями)
const TERRITORIES = [
  { territoryId: "forest_edge", name: "Опушка леса", bonusType: "wood_mining_+15pct" },
  { territoryId: "stone_quarry", name: "Каменный карьер", bonusType: "stone_mining_+15pct" },
  { territoryId: "fertile_field", name: "Плодородное поле", bonusType: "food_mining_+15pct" },
  { territoryId: "ancient_ruins", name: "Древние руины", bonusType: "rare_loot_+25pct" },
  { territoryId: "mountain_peak", name: "Горный пик", bonusType: "all_+10pct" },
];

// Список территорий с текущими владельцами
r.get("/territories", async (req, res) => {
  try {
    const territories = await db.territory.findMany();
    // Если территорий ещё нет — инициализируем
    if (territories.length === 0) {
      for (const t of TERRITORIES) {
        await db.territory.create({ data: t });
      }
      const fresh = await db.territory.findMany();
      return res.json({ territories: fresh });
    }
    res.json({ territories });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Захватить территорию (только лидер/офицер гильдии)
r.post("/capture", async (req, res) => {
  try {
    const { guildId, territoryId, actor } = req.body;
    if (!TERRITORIES.some((t) => t.territoryId === territoryId)) {
      return res.status(400).json({ error: "Unknown territory" });
    }

    // Проверяем роль захватчика
    const member = await db.guildMember.findFirst({
      where: { guildId, user: actor },
    });
    if (!member || !["leader", "officer"].includes(member.role)) {
      return res.status(403).json({ error: "Only leader/officer can capture territory" });
    }

    // Захватываем территорию
    const territory = await db.territory.upsert({
      where: { territoryId },
      update: { guildId, contestedAt: new Date() },
      create: {
        territoryId,
        name: TERRITORIES.find((t) => t.territoryId === territoryId)?.name || territoryId,
        guildId,
        bonusType: TERRITORIES.find((t) => t.territoryId === territoryId)?.bonusType,
        contestedAt: new Date(),
      },
    });

    // Записываем в ленту активности гильдии
    await db.guildActivity.create({
      data: { guildId, actor, action: "territory_captured", amount: null },
    });

    res.json({ territory });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Территории моей гильдии + их бусты
r.get("/guild/:guildId", async (req, res) => {
  try {
    const guildId = req.params.guildId;
    const territories = await db.territory.findMany({ where: { guildId } });
    const activeBonuses = territories.map((t) => t.bonusType).filter(Boolean);
    res.json({ territories, activeBonuses });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
