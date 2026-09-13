import { Router } from "express";
import { db } from "../lib/db";

const r = Router();

// Награды по дням стрика (POTATO в base units, 9 decimals)
const STREAK_REWARDS = [
  { day: 1,  potato: 50,    bonus: "Начало пути" },
  { day: 2,  potato: 75,    bonus: "+50%" },
  { day: 3,  potato: 100,   bonus: "x2 от базы" },
  { day: 4,  potato: 125,   bonus: "Стабильность" },
  { day: 5,  potato: 150,   bonus: "x3 от базы" },
  { day: 6,  potato: 200,   bonus: "Бонус недели" },
  { day: 7,  potato: 500,   bonus: "🏆 Недельный джекпот!" },
];

/**
 * GET /daily/status/:user
 * Статус ежедневной награды
 */
r.get("/status/:user", async (req, res) => {
  try {
    const { user } = req.params;
    
    let streak = await db.streak.findUnique({ where: { user } });
    
    if (!streak) {
      streak = await db.streak.create({
        data: { user, current: 0, longest: 0 },
      });
    }
    
    const now = new Date();
    const lastLogin = streak.lastLogin;
    
    // Проверяем можно ли забрать награду сегодня
    let canClaim = false;
    let daysSinceLast = 999;
    
    if (lastLogin) {
      const lastDate = new Date(lastLogin);
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const lastDay = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate());
      daysSinceLast = Math.floor((today.getTime() - lastDay.getTime()) / 86400000);
      canClaim = daysSinceLast >= 1;
    } else {
      canClaim = true;
    }
    
    const currentStreak = streak.current;
    const nextReward = STREAK_REWARDS[Math.min(currentStreak % 7, 6)];
    
    res.json({
      canClaim,
      currentStreak,
      longestStreak: streak.longest,
      daysSinceLast,
      nextReward,
      lastLogin,
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * POST /daily/claim
 * Забрать ежедневную награду
 */
r.post("/claim", async (req, res) => {
  try {
    const { user } = req.body;
    if (!user) return res.status(400).json({ error: "user required" });
    
    const status = await checkStatus(user);
    if (!status.canClaim) {
      return res.status(400).json({ 
        error: "Уже забрали сегодня. Приходите завтра!",
        daysSinceLast: status.daysSinceLast,
      });
    }
    
    // Обновляем стрик
    const now = new Date();
    let newStreak = status.currentStreak + 1;
    
    // Если пропуск > 1 дня — сбрасываем стрик
    if (status.daysSinceLast > 1 && status.lastLogin) {
      newStreak = 1;
    }
    
    const reward = STREAK_REWARDS[Math.min((newStreak - 1) % 7, 6)];
    
    await db.streak.update({
      where: { user },
      data: {
        current: newStreak,
        longest: Math.max(newStreak, status.longestStreak),
        lastLogin: now,
      },
    });
    
    // TODO: тут была бы on-chain транзакция с mint POTATO
    // Пока что просто логируем
    console.log(`🎁 [DailyReward] ${user}: day ${newStreak}, +${reward.potato} POTATO (${reward.bonus})`);
    
    res.json({
      success: true,
      streak: newStreak,
      reward,
      message: `+${reward.potato} POTATO! ${reward.bonus}`,
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

async function checkStatus(user: string) {
  const streak = await db.streak.findUnique({ where: { user } });
  if (!streak) {
    return { canClaim: true, currentStreak: 0, longestStreak: 0, daysSinceLast: 999, lastLogin: null };
  }
  
  const now = new Date();
  let daysSinceLast = 999;
  
  if (streak.lastLogin) {
    const lastDate = new Date(streak.lastLogin);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastDay = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate());
    daysSinceLast = Math.floor((today.getTime() - lastDay.getTime()) / 86400000);
  }
  
  return {
    canClaim: daysSinceLast >= 1 || !streak.lastLogin,
    currentStreak: streak.current,
    longestStreak: streak.longest,
    daysSinceLast,
    lastLogin: streak.lastLogin,
  };
}

export default r;
