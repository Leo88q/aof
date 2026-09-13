import { Router } from "express";
import { db } from "../lib/db";

const r = Router();

const FREE_TIER_MAX_ALERTS = 1; // без VIP — только 1 алерт

// Список алертов пользователя
r.get("/:user", async (req, res) => {
  try {
    const user = req.params.user;
    const alerts = await db.priceAlert.findMany({ where: { user, active: true } });
    res.json({
      alerts,
      used: alerts.length,
      limit: FREE_TIER_MAX_ALERTS,
      canAddMore: alerts.length < FREE_TIER_MAX_ALERTS,
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Создать алерт (с проверкой лимита и апселлом для VIP)
r.post("/create", async (req, res) => {
  try {
    const { user, rarity, currency, direction, threshold } = req.body;
    const existing = await db.priceAlert.count({ where: { user, active: true } });

    // Воронка: если лимит исчерпан — апселл, а не блокировка
    if (existing >= FREE_TIER_MAX_ALERTS) {
      return res.status(402).json({
        error: "Free tier limit reached",
        upsell: {
          message: "VIP разблокирует неограниченные алерты с выбором редкости, валюты и направления",
          cta: "buy_vip_pass",
        },
      });
    }

    const alert = await db.priceAlert.create({
      data: { user, rarity, currency, direction, threshold },
    });
    res.json({ alert });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Удалить алерт
r.delete("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    await db.priceAlert.update({ where: { id }, data: { active: false } });
    res.json({ deleted: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
