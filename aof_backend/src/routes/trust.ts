import { Router } from "express";
import { SystemProgram } from "@solana/web3.js";
import { AUTHORITY } from "../config";
import { marketProgram } from "../provider";
import { trustSnapshotPda } from "../lib/pda";
import { authorityOnly, pk } from "../lib/tx";
import { db } from "../lib/db";
import { computeTrustIndex, getTraderLimit, getFeeDiscount, getHoldingPeriod } from "../lib/trustFormula";

const r = Router();

// Получить полный траст-профиль пользователя (брэйкдаун по 9 компонентам)
r.get("/:user", async (req, res) => {
  try {
    const user = req.params.user;

    // Берём сохранённый скор или пересчитываем на лету
    let saved = await db.trustScore.findUnique({ where: { user } });
    if (!saved) {
      const result = await computeTrustIndex(user);
      saved = await db.trustScore.create({
        data: {
          user,
          score: result.score,
          tier: result.tier,
          ageScore: result.breakdown.ageScore,
          referralScore: result.breakdown.referralScore,
          traderScore: result.breakdown.traderScore,
          stakingScore: result.breakdown.stakingScore,
          rebirthScore: result.breakdown.rebirthScore,
          guildScore: result.breakdown.guildScore,
          compendiumScore: result.breakdown.compendiumScore,
          questScore: result.breakdown.questScore,
          craftRepScore: result.breakdown.craftRepScore,
          antiBotScore: result.breakdown.antiBotScore,
          penaltyMult: result.breakdown.penaltyMult,
        },
      });
    }

    res.json({
      score: saved.score,
      tier: saved.tier,
      breakdown: {
        age: { score: saved.ageScore, max: 100, hint: "Заходите в игру регулярно" },
        referral: { score: saved.referralScore, max: 150, hint: "Приглашайте реальных друзей" },
        trader: { score: saved.traderScore, max: 150, hint: "Используйте Farm-Trader без инцидентов" },
        staking: { score: saved.stakingScore, max: 100, hint: "Держите инструменты в стейке дольше" },
        rebirth: { score: saved.rebirthScore, max: 100, hint: "Совершайте rebirth для постоянного бонуса" },
        guild: { score: saved.guildScore, max: 100, hint: "Вносите ресурсы в общий склад" },
        compendium: { score: saved.compendiumScore, max: 100, hint: "Заполняйте компендиум" },
        quests: { score: saved.questScore, max: 100, hint: "Выполняйте задания каждый день" },
        craftRep: { score: saved.craftRepScore, max: 100, hint: "Выполняйте CraftOrder без отмен" },
        antiBot: { score: saved.antiBotScore, max: 100, hint: "Естественное поведение — без ботов и скриптов" },
      },
      penaltyMult: saved.penaltyMult,
      privileges: {
        traderLimitSolPerDay: getTraderLimit(saved.tier),
        feeDiscountPct: getFeeDiscount(saved.tier),
        holdingPeriodHours: getHoldingPeriod(saved.tier),
      },
      computedAt: saved.computedAt,
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Обновление ончейн-снапшота (вызывается воркером от имени authority)
r.post("/snapshot/update", async (req, res) => {
  try {
    const user = pk(req.body.user);
    const score = Number(req.body.score);
    const tier = Number(req.body.tier);

    const [trustSnapshot] = trustSnapshotPda(user);

    const ix = await (marketProgram.methods as any)
      .trustSnapshotUpdate(score, tier)
      .accounts({
        trustSnapshot,
        oracleAuthority: AUTHORITY.publicKey,
        user,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    const sig = await authorityOnly([ix]);
    res.json({ sig });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});


// Таблица лидеров — топ-100 по trust score
r.get("/leaderboard", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 100), 500);
    const leaderboard = await db.trustScore.findMany({
      orderBy: { score: "desc" },
      take: limit,
      select: {
        user: true,
        score: true,
        tier: true,
        computedAt: true,
      },
    });

    // Добавляю ранг
    const ranked = leaderboard.map((entry, i) => ({
      ...entry,
      rank: i + 1,
    }));

    res.json({ leaderboard: ranked, total: await db.trustScore.count() });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
