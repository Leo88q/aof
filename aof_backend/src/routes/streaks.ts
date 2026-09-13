import { Router } from "express";
import { db } from "../lib/db";

const r = Router();

// Ежедневный чек-ин (обновляет стрик)
r.post("/check-in", async (req, res) => {
  try {
    const { user } = req.body;
    let streak = await db.streak.findUnique({ where: { user } });
    if (!streak) {
      streak = await db.streak.create({ data: { user, current: 1, longest: 1, lastLogin: new Date() } });
      return res.json({ current: 1, longest: 1, reward: null, isNew: true });
    }

    const last = streak.lastLogin ? new Date(streak.lastLogin) : null;
    const today = new Date().toDateString();

    if (last && last.toDateString() === today) {
      return res.json({ current: streak.current, longest: streak.longest, reward: null, alreadyCheckedIn: true });
    }

    const yesterday = new Date(Date.now() - 86400000).toDateString();
    const isConsecutive = last && last.toDateString() === yesterday;

    const newCurrent = isConsecutive ? streak.current + 1 : 1;
    const newLongest = Math.max(streak.longest, newCurrent);

    // Награды за 7/30/100 дней подряд
    let reward = null;
    if ([7, 30, 100].includes(newCurrent)) {
      reward = { type: "streak_milestone", days: newCurrent, bonus: newCurrent * 100 };
    }

    const updated = await db.streak.update({
      where: { user },
      data: { current: newCurrent, longest: newLongest, lastLogin: new Date() },
    });

    res.json({ current: updated.current, longest: updated.longest, reward });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Получить текущий стрик
r.get("/:user", async (req, res) => {
  try {
    const user = req.params.user;
    const streak = await db.streak.findUnique({ where: { user } });
    res.json({
      current: streak?.current ?? 0,
      longest: streak?.longest ?? 0,
      lastLogin: streak?.lastLogin ?? null,
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
