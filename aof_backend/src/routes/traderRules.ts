import { Router } from "express";
import { db } from "../lib/db";

const r = Router();

// Создать правило (доступно только с VIP)
r.post("/create", async (req, res) => {
  try {
    const { user, type, rarity, toolType, currency, threshold, direction, maxSpendPerDay } = req.body;

    // VIP-чек: Farm-Trader доступен только с Premium
    const profile = await db.profile.findUnique({ where: { user } });
    const isVip = Boolean(profile?.title?.includes("VIP"));
    if (!isVip && (type === "smart_sell" || type === "smart_buy")) {
      return res.status(403).json({
        error: "VIP required",
        upsell: {
          message: "Farm-Trader (авто-покупка/продажа) доступен только с Premium-пассом",
          cta: "buy_vip_pass",
        },
      });
    }

    if (!["smart_sell", "smart_buy", "push"].includes(type)) {
      return res.status(400).json({ error: "Invalid rule type" });
    }
    if (type !== "push" && !threshold) {
      return res.status(400).json({ error: "Threshold required for trading rules" });
    }
    if (type === "push" && !direction) {
      return res.status(400).json({ error: "Direction required for push alerts" });
    }

    const rule = await db.traderRule.create({
      data: {
        user,
        type,
        rarity: rarity ? Number(rarity) : null,
        toolType,
        currency,
        threshold: threshold ? Number(threshold) : null,
        direction,
        maxSpendPerDay: maxSpendPerDay ? Number(maxSpendPerDay) : null,
      },
    });
    res.json({ rule });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Список правил пользователя (с проверкой лимитов по трасту)
r.get("/:user", async (req, res) => {
  try {
    const user = req.params.user;
    const rules = await db.traderRule.findMany({
      where: { user, active: true },
      orderBy: { createdAt: "desc" },
    });
    // Проверка лимитов по траст-индексу
    const trust = await db.trustScore.findUnique({ where: { user } });
    const tier = trust?.tier ?? 1;
    // VIP-чек для лимитов
    const profile = await db.profile.findUnique({ where: { user } });
    const isVip = Boolean(profile?.title?.includes("VIP"));
    const maxRules = isVip ? 10 : tier >= 4 ? 10 : tier >= 3 ? 5 : tier >= 2 ? 3 : 1;
    const maxSpendPerDaySol = isVip ? 4.0 : 0.5 * (tier === 1 ? 1 : tier === 2 ? 2 : tier === 3 ? 4 : tier === 4 ? 8 : 20);
    res.json({
      rules,
      limits: {
        maxRules,
        maxSpendPerDaySol,
        tier,
        isVip,
      },
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Пауза/возобновление правила
r.post("/toggle", async (req, res) => {
  try {
    const { id } = req.body;
    const rule = await db.traderRule.findUnique({ where: { id } });
    if (!rule) return res.status(404).json({ error: "Not found" });
    const updated = await db.traderRule.update({
      where: { id },
      data: { paused: !rule.paused },
    });
    res.json({ rule: updated });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Удалить правило
r.delete("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    await db.traderRule.update({ where: { id }, data: { active: false } });
    res.json({ deleted: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// История исполнений воркера для пользователя
r.get("/executions/:user", async (req, res) => {
  try {
    const user = req.params.user;
    const limit = Math.min(Number(req.query.limit || 50), 100);
    const executions = await db.traderExecution.findMany({
      where: { user },
      orderBy: { ts: "desc" },
      take: limit,
    });
    // Суммарный П&Л бота за сессию
    const successful = executions.filter((e) => e.success);
    res.json({
      executions,
      stats: {
        total: executions.length,
        successful: successful.length,
        failed: executions.length - successful.length,
      },
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
