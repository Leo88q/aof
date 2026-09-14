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
    const numericThreshold = Number(threshold);
    if (!user || !Number.isFinite(numericThreshold)) {
      return res.status(400).json({ error: "user and a finite threshold are required" });
    }

    const alert = await db.$transaction(async (tx: any) => {
      const existing = await tx.priceAlert.count({ where: { user, active: true } });
      // Воронка: если лимит исчерпан — апселл, а не блокировка
      if (existing >= FREE_TIER_MAX_ALERTS) {
        throw new Error("FREE_TIER_LIMIT_REACHED");
      }
      return tx.priceAlert.create({
        data: { user, rarity, currency, direction, threshold: numericThreshold },
      });
    });
    res.json({ alert });
  } catch (e: any) {
    if (e?.message === "FREE_TIER_LIMIT_REACHED") {
      return res.status(402).json({
        error: "Free tier limit reached",
        upsell: {
          message: "VIP разблокирует неограниченные алерты с выбором редкости, валюты и направления",
          cta: "buy_vip_pass",
        },
      });
    }
    res.status(400).json({ error: e.message });
  }
});

// Удалить алерт
r.delete("/:id", async (req, res) => {
  try {
    const { user } = req.body;
    const id = req.params.id;
    const alert = await db.priceAlert.findUnique({ where: { id } });
    if (!alert) return res.status(404).json({ error: "Not found" });
    if (alert.user !== user) return res.status(403).json({ error: "Not your alert" });
    await db.priceAlert.update({ where: { id }, data: { active: false } });
    res.json({ deleted: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
