import { Router } from "express";
import { requireWalletProof } from "../security/walletProof";
import { db } from "../lib/db";

const r = Router();

const MAX_VISITS_PER_DAY = 5;

// Список друзей с превью их участков
r.get("/list/:user", async (_req, res) => {
  return res.status(503).json({
    error: "NEIGHBOR_LIMIT_UNAVAILABLE_UNTIL_CANONICAL_SOCIAL_INDEXING_IS_DEPLOYED",
  });
  /*
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
  */
});

// Посетить ферму друга и выполнить действие (полить / помочь с ремонтом)
r.post("/visit", requireWalletProof("neighbors_visit", "visitor"), async (_req, res) => {
  // The old route charged local energy and returned unimplemented reward/
  // boost promises. Do not acknowledge the action until canonical effects
  // exist on-chain.
  return res.status(503).json({
    error: "NEIGHBOR_ACTIONS_UNAVAILABLE_UNTIL_CANONICAL_SOCIAL_EFFECTS_ARE_DEPLOYED",
  });
  /*
  try {
    const { visitor, host, action } = req.body;
    if (!["water", "help_repair"].includes(action)) {
      return res.status(400).json({ error: "Invalid action" });
    }

    if (visitor === host) {
      return res.status(400).json({ error: "Cannot visit your own farm" });
    }

    // The energy debit, quota check and visit insert must be one transaction.
    // The previous order charged energy before rejecting a duplicate/over-limit
    // visit and allowed concurrent requests to bypass the daily quota.
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const visit = await db.$transaction(async (tx: any) => {
      const energy = await tx.energy.findUnique({ where: { user: visitor } });
      if (!energy || energy.amount < 1) {
        throw new Error("Not enough energy for visit");
      }

      const visitedToday = await tx.neighborVisit.count({
        where: { visitor, ts: { gte: dayStart } },
      });
      if (visitedToday >= MAX_VISITS_PER_DAY) {
        throw new Error("Daily visit limit reached");
      }

      const alreadyVisited = await tx.neighborVisit.findFirst({
        where: { visitor, host, action, ts: { gte: dayStart } },
      });
      if (alreadyVisited) {
        throw new Error("Already did this action for this friend today");
      }

      await tx.energy.update({
        where: { user: visitor },
        data: { amount: { decrement: 1 } },
      });
      return tx.neighborVisit.create({ data: { visitor, host, action } });
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
  */
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
