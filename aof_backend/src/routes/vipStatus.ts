import { Router } from "express";
import { seasonPassPda, seasonPda } from "../lib/pda";
import { program } from "../provider";
import { pk } from "../lib/tx";
import { db } from "../lib/db";

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

    // Читаем ончейн сезонный пасс (если контракты задеплоены)
    let seasonPassData: any = null;
    let isVip = false;
    let source = "fallback";

    try {
      seasonPassData = await (program.account as any)["seasonPass"].fetch(seasonPass);
      isVip = Boolean(seasonPassData.premiumTrack) && Boolean(seasonPassData.active);
      source = "onchain";
    } catch {
      // Контракты не задеплоены — читаем из БД как фоллбэк
      const profile = await db.profile.findUnique({ where: { user: req.params.user } });
      isVip = Boolean(profile?.title?.includes("VIP"));
      source = "db_fallback";
    }

    // Что открывает этот статус (единый справочник для фронта)
    res.json({
      user: req.params.user,
      seasonId,
      isVip,
      source,
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
