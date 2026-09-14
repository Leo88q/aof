import { Router } from "express";
import { db } from "../lib/db";

const r = Router();

// Формула тиров из ТЗ
function getReferralRate(directCount: number): number {
  if (directCount < 10) return 0.02;       // 2%
  if (directCount < 100) return 0.005;     // 0.5%
  if (directCount < 1000) return 0.001;    // 0.1%
  return 0.000025;                          // 0.0025%
}

// Получить статистику рефералов с тирами
r.get("/:user", async (req, res) => {
  try {
    const user = req.params.user;
    let stats = await db.referralStatsDb.findUnique({ where: { user } });
    if (!stats) {
      stats = await db.referralStatsDb.create({ data: { user } });
    }
    const rate = getReferralRate(stats.directCount);
    const nextTier =
      stats.directCount < 10 ? { count: 10, rate: 0.005 } :
      stats.directCount < 100 ? { count: 100, rate: 0.001 } :
      stats.directCount < 1000 ? { count: 1000, rate: 0.000025 } :
      null;

    res.json({
      directCount: stats.directCount,
      l2Count: stats.l2Count,
      currentRate: rate,
      currentRateBps: Math.round(rate * 10000),
      l2Rate: 0.025, // 2.5% второй уровень
      nextTier,
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// The old endpoint incremented a referrer's count without recording a
// canonical referred-wallet binding, so it could be called repeatedly to
// inflate tiers. Use the on-chain /referral/bind flow instead.
r.post("/bind", (_req, res) => {
  res.status(503).json({ error: "REFERRAL_TIERS_BIND_DISABLED_USE_CANONICAL_REFERRAL_BIND" });
});

export default r;
