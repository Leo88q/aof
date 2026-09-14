import { Router } from "express";
import { db } from "../lib/db";
import { requireWalletProof } from "../security/walletProof";

const r = Router();

/**
 * POST /rating/submit
 * Отправить оценку другому игроку
 */
r.post("/submit", requireWalletProof("rating_submit", "fromUser"), async (req, res) => {
  try {
    const { fromUser, toUser, context, referenceId, rating, comment } = req.body;
    
    if (!fromUser || !toUser || !rating) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be 1-5" });
    }
    
    if (fromUser === toUser) {
      return res.status(400).json({ error: "Cannot rate yourself" });
    }
    
    // Проверяем что уже не оценивали в этом контексте
    const existing = referenceId 
      ? await db.playerRating.findUnique({
          where: {
            fromUser_toUser_context_referenceId: {
              fromUser,
              toUser,
              context,
              referenceId,
            }
          }
        })
      : null;
    
    if (existing) {
      return res.status(400).json({ error: "Already rated in this context" });
    }
    
    // TODO: расчёт stakeWeight на основе TrustScore или staked amount
    const stakeWeight = 1.0;
    
    const record = await db.playerRating.create({
      data: {
        fromUser,
        toUser,
        context,
        referenceId,
        rating,
        comment,
        stakeWeight,
      },
    });
    
    res.json({ success: true, id: record.id });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * GET /rating/player/:user
 * Получить рейтинг игрока
 */
r.get("/player/:user", async (req, res) => {
  try {
    const user = req.params.user;
    
    const ratings = await db.playerRating.findMany({
      where: { toUser: user },
      orderBy: { timestamp: "desc" },
    });
    
    if (ratings.length === 0) {
      return res.json({
        user,
        average: 0,
        count: 0,
        ratings: [],
        verified: false,
      });
    }
    
    // Weighted average
    const totalWeight = ratings.reduce((sum, r) => sum + r.stakeWeight, 0);
    const weightedSum = ratings.reduce((sum, r) => sum + r.rating * r.stakeWeight, 0);
    const average = totalWeight > 0 ? weightedSum / totalWeight : 0;
    
    // Распределение по звёздам
    const distribution = [0, 0, 0, 0, 0];
    for (const r of ratings) {
      distribution[r.rating - 1]++;
    }
    
    res.json({
      user,
      average: Number(average.toFixed(2)),
      count: ratings.length,
      distribution,
      verified: ratings.length >= 10 && average >= 4.0,
      recentRatings: ratings.slice(0, 10).map(r => ({
        fromUser: r.fromUser,
        rating: r.rating,
        context: r.context,
        comment: r.comment,
        timestamp: r.timestamp,
      })),
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * GET /rating/leaderboard
 * Топ игроков по рейтингу
 */
r.get("/leaderboard", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    
    // Группируем по toUser и считаем weighted average
    const ratings = await db.playerRating.findMany({
      orderBy: { timestamp: "desc" },
      take: 10000, // берём много и фильтруем в коде
    });
    
    const userRatings: Record<string, { sum: number; weight: number; count: number }> = {};
    
    for (const r of ratings) {
      if (!userRatings[r.toUser]) {
        userRatings[r.toUser] = { sum: 0, weight: 0, count: 0 };
      }
      userRatings[r.toUser].sum += r.rating * r.stakeWeight;
      userRatings[r.toUser].weight += r.stakeWeight;
      userRatings[r.toUser].count++;
    }
    
    const leaderboard = Object.entries(userRatings)
      .filter(([_, data]) => data.count >= 5) // минимум 5 оценок
      .map(([user, data]) => ({
        user,
        average: data.sum / data.weight,
        count: data.count,
      }))
      .sort((a, b) => b.average - a.average)
      .slice(0, limit)
      .map((entry, i) => ({ ...entry, rank: i + 1 }));
    
    res.json({ leaderboard });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
