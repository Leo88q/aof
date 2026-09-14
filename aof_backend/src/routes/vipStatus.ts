import { Router } from "express";
import { seasonPassPda, seasonPda } from "../lib/pda";
import { program } from "../provider";
import { pk } from "../lib/tx";

const r = Router();

/**
 * VIP-статус пользователя — единая точка правды для всего фронта.
 * По ТЗ: premium_track = true && сезон активен = VIP.
 *
 * Все гейты (Farm-Trader, алерты, пропуск рекламы, расширенный кап энергии)
 * должны спрашивать этот эндпоинт, а не хранить флаг локально.
 */
r.get("/:user", async (req, res) => {
  try {
    const user = pk(req.params.user);
    const seasonId = Number(req.query.seasonId || 1);

    const [seasonPass] = seasonPassPda(user, seasonId);
    const [season] = seasonPda(seasonId);

    // Читаем ончейн сезонный пасс и сам сезон (если контракты задеплоены)
    let seasonPassData: any = null;
    let seasonData: any = null;
    let isVip = false;

    try {
      seasonPassData = await (program.account as any)["seasonPass"].fetch(seasonPass);
      seasonData = await (program.account as any)["season"].fetch(season);
      // SeasonPass stores `premium`; the pass is useful only while the
      // canonical 42-day on-chain season is active.
      const startedAt = Number(seasonData.startTime || 0);
      const active = startedAt > 0 && Math.floor(Date.now() / 1000) < startedAt + 42 * 86400;
      isVip = Boolean(seasonPassData.premium) && active;
    } catch {
      // A profile title is not proof of a premium pass. Never grant VIP from
      // a database fallback when canonical season accounts are unavailable.
      return res.status(503).json({
        error: "VIP_STATUS_UNAVAILABLE_FROM_CANONICAL_SEASON_ACCOUNTS",
      });
    }

    // Что открывает этот статус (единый справочник для фронта)
    res.json({
      user: req.params.user,
      seasonId,
      isVip,
      source: "onchain",
      privileges: {
        farmTrader: isVip
          ? { enabled: true, maxRules: 10, maxSpendPerDaySol: 4.0 }
          : { enabled: false, hint: "Доступно с VIP-пассом" },
        priceAlerts: isVip
          ? { limit: 999, fullOptions: true }
          : { limit: 1, fullOptions: false },
        skipAdsInQuests: isVip,
        energyCap: isVip ? 30 : 20,
        energyRegenMinutes: isVip ? 8 : 10,
        feeDiscountPct: isVip ? 15 : 0,
      },
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
