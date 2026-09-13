import { Router } from "express";
import { db } from "../lib/db";

const r = Router();

const MAX_VISITS_PER_DAY = 5;

// Список друзей с превью их участков
r.get("/list/:user", async (req, res) => {
  try {
    const user = req.params.user;
    // Друзья = рефералы (упрощённо, потом свяжем с referral-системой)
    const visitedToday = await db.neighborVisit.count({
      where: {
        visitor: user,
        ts: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    });
    res.json({
      visitsLeftToday: Math.max(0, MAX_VISITS_PER_DAY - visitedToday),
      maxVisitsPerDay: MAX_VISITS_PER_DAY,
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Посетить ферму друга и выполнить действие (полить / помочь с ремонтом)
r.post("/visit", async (req, res) => {
  try {
    const { visitor, host, action } = req.body;
    if (!["water", "help_repair"].includes(action)) {
      return res.status(400).json({ error: "Invalid action" });
    }

    // Трата энергии на визит (по ТЗ: визит стоит 1 энергию)
    const energy = await db.energy.findUnique({ where: { user: visitor } });
    if (!energy || energy.amount < 1) {
      return res.status(400).json({ error: "Not enough energy for visit" });
    }
    await db.energy.update({
      where: { user: visitor },
      data: { amount: energy.amount - 1 },
    });

    // Проверка дневного лимита
    const visitedToday = await db.neighborVisit.count({
      where: {
        visitor,
        ts: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    });
    if (visitedToday >= MAX_VISITS_PER_DAY) {
      return res.status(400).json({ error: "Daily visit limit reached" });
    }

    // Проверка что не посещал этого друга сегодня с тем же действием
    const alreadyVisited = await db.neighborVisit.findFirst({
      where: {
        visitor,
        host,
        action,
        ts: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    });
    if (alreadyVisited) {
      return res.status(400).json({ error: "Already did this action for this friend today" });
    }

    const visit = await db.neighborVisit.create({
      data: { visitor, host, action },
    });

    // Награда гостю (фиксированная из пула соц-наград) и буст хозяину
    const guestReward = action === "water" ? 50 : 30;
    res.json({
      visit,
      guestReward,
      hostBoost: action === "water" ? "mining_boost_10pct_1h" : "repair_speedup",
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Лента визитов к моей ферме (для уведомлений хозяину)
r.get("/visits/:host", async (req, res) => {
  try {
    const host = req.params.host;
    const visits = await db.neighborVisit.findMany({
      where: { host },
      orderBy: { ts: "desc" },
      take: 20,
    });
    res.json({ visits });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});


// Поиск игрока по адресу или title (упрощённо, без миграции БД)
r.get("/search/:query", async (req, res) => {
  try {
    const query = req.params.query.trim();
    
    // Если это адрес (32+ символов) — ищем напрямую
    if (query.length >= 32) {
      const profile = await db.profile.findUnique({ 
        where: { user: query },
        select: { user: true, title: true, avatar: true }
      });
      if (profile) {
        return res.json({
          found: true,
          user: profile.user,
          displayName: profile.title || profile.user.slice(0, 8) + "...",
          avatar: profile.avatar || "👨‍🌾",
        });
      }
      return res.json({ found: false });
    }

    // Ищем по title или user (без case-insensitive — не поддерживается провайдером)
    // Фильтруем регистронезависимо вручную после выборки
    const queryLower = query.toLowerCase();
    const allProfiles = await db.profile.findMany({
      take: 100,
      select: {
        user: true,
        title: true,
        avatar: true,
      },
    });
    const profiles = allProfiles.filter((p) =>
      (p.title && p.title.toLowerCase().includes(queryLower)) ||
      p.user.toLowerCase().includes(queryLower)
    ).slice(0, 10);

    if (profiles.length === 0) {
      return res.json({ found: false, results: [] });
    }

    res.json({
      found: true,
      results: profiles.map((p) => ({
        user: p.user,
        displayName: p.title || p.user.slice(0, 8) + "...",
        avatar: p.avatar || "👨‍🌾",
      })),
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
