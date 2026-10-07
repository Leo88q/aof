import { Router } from "express";
import { seasonPassPda, seasonPremiumClaimsPda, seasonPda } from "../lib/pda";
import { program, connection, assertExpectedCluster } from "../provider";
import { pk } from "../lib/tx";
import { activeSeasonId, seasonWindow } from "../lib/activeSeason";

const r = Router();

async function currentSeason() {
  const seasonId = activeSeasonId(process.env.ACTIVE_SEASON_ID);
  // Without an expected genesis, a localnet/mock account could be mistaken
  // for a paid devnet/mainnet entitlement. Unlike generic public queries,
  // seasonal cosmetics require an explicitly pinned cluster.
  if (seasonId === null || !process.env.EXPECTED_GENESIS_HASH) return null;
  await assertExpectedCluster();
  const [season] = seasonPda(seasonId);
  const data: any = await (program.account as any)["season"].fetch(season);
  const window = seasonWindow(data.seasonId, data.startTime, seasonId, Math.floor(Date.now() / 1000));
  return window ? { seasonId, ...window } : null;
}

// An operator-configured ID is NOT proof of an active season. Validate the
// Season PDA and on-chain start before returning a current-season pointer.
r.get("/current", async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const current = await currentSeason();
    if (!current) return res.status(503).json({ error: "ACTIVE_SEASON_UNAVAILABLE" });
    return res.json({ ...current, source: "onchain" });
  } catch { return res.status(503).json({ error: "ACTIVE_SEASON_UNAVAILABLE" }); }
});

/**
 * VIP-статус пользователя — единая точка правды для всего фронта.
 * По ТЗ: premium_track = true && сезон активен = VIP.
 *
 * Любой будущий гейт должен читать этот статус, а не хранить локальный флаг.
 * Приведённые ниже настройки сервиса сами по себе не доказывают, что
 * соответствующие игровые механики уже развёрнуты.
 */
r.get("/:user", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const user = pk(req.params.user);
    // Refuse old or forged season IDs: expired passes must never grant active
    // cosmetics, even if an operator rotates ACTIVE_SEASON_ID during a read.
    const current = await currentSeason().catch(() => null);
    if (!current || (req.query.seasonId !== undefined && String(req.query.seasonId) !== String(current.seasonId))) {
      return res.status(503).json({ error: "ACTIVE_SEASON_UNAVAILABLE" });
    }
    const { seasonId } = current;
    const [seasonPass] = seasonPassPda(user, seasonId);

    // Missing pass is normal for a new player; unreadable pass is NOT proof
    // that buying is possible. Never turn an RPC error into "no pass".
    let seasonPassData: any = null;
    const seasonActive = true; // currentSeason() checked the on-chain window
    try {
      const account = await connection.getAccountInfo(seasonPass);
      if (account) {
        seasonPassData = await (program.account as any)["seasonPass"].fetch(seasonPass);
        if (!seasonPassData.owner.equals(user) || Number(seasonPassData.seasonId) !== seasonId ||
            typeof seasonPassData.premium !== "boolean") throw new Error("Invalid pass");
      }
    } catch {
      return res.status(503).json({ error: "VIP_STATUS_UNAVAILABLE_FROM_CANONICAL_SEASON_ACCOUNTS" });
    }
    const passPremium = seasonPassData?.premium === true;
    let premiumClaimsData: any = null;
    if (passPremium) {
      const [premiumClaims] = seasonPremiumClaimsPda(user, seasonId);
      try {
        const account = await connection.getAccountInfo(premiumClaims);
        if (account) {
          premiumClaimsData = await (program.account as any).seasonPremiumClaims.fetch(premiumClaims);
          if (!premiumClaimsData.owner.equals(user) || Number(premiumClaimsData.seasonId) !== seasonId ||
              typeof premiumClaimsData.claimedBitmap?.toString !== "function") throw new Error("Invalid premium claims ledger");
        }
      } catch {
        return res.status(503).json({ error: "VIP_STATUS_UNAVAILABLE_FROM_CANONICAL_SEASON_ACCOUNTS" });
      }
    }
    const isVip = passPremium && seasonActive;

    // Canonical status and pass progress are returned together. The client may
    // offer payment only after this read confirms an active, non-premium season.
    res.json({
      user: req.params.user,
      seasonId,
      seasonActive,
      passPremium,
      pass: seasonPassData ? {
        xp: Number(seasonPassData.xp),
        claimedBitmap: seasonPassData.claimedBitmap.toString(),
        premium: passPremium,
      } : null,
      premiumClaims: premiumClaimsData ? {
        claimedBitmap: premiumClaimsData.claimedBitmap.toString(),
      } : null,
      isVip,
      source: "onchain",
      privileges: {
        // These perks have no enforced implementation yet. A paid flag is
        // not evidence that a worker, fee discount or alert tier exists.
        farmTrader: { enabled: false },
        priceAlerts: { limit: 1, fullOptions: false },
        skipAdsInQuests: false,
        // Запас и возврат энергии заданы цепью (ENERGY_CAP = 20, +1 за 30 минут)
        // и от пропуска не зависят: расширенный запас остаётся планом, пока
        // механики нет в aof-core. Отдаём факт и отдельно — план.
        energyCap: 20,
        energyCapPlanned: isVip ? 30 : null,
        energyRegenMinutes: 30,
        energyRegenMinutesPlanned: isVip ? 8 : null,
        feeDiscountPct: 0,
      },
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
