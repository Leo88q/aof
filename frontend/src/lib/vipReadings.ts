export type VipPrivileges = {
  farmTrader: { enabled: boolean; maxRules?: number; maxSpendPerDaySol?: number };
  priceAlerts: { limit: number; fullOptions: boolean };
  skipAdsInQuests: boolean;
  feeDiscountPct: number;
};

export type VipSnapshot = {
  seasonActive: boolean;
  passPremium: boolean;
  isVip: boolean;
  pass: { xp: number; claimedRewards: number } | null;
  privileges: VipPrivileges;
};

/** A failed read, a partial response and an absent pass are distinct states.
 * Never grant VIP or offer a second payment from an unverified API payload. */
export function readVipSnapshot(raw: unknown, owner: string, seasonId: number): VipSnapshot | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const data = raw as Record<string, any>;
  if (data.source !== 'onchain' || data.user !== owner || data.seasonId !== seasonId ||
      typeof data.seasonActive !== 'boolean' || typeof data.passPremium !== 'boolean' ||
      typeof data.isVip !== 'boolean' || data.isVip !== (data.passPremium && data.seasonActive)) return null;
  let pass: VipSnapshot['pass'] = null;
  if (data.pass !== null) {
    if (!data.pass || typeof data.pass !== 'object' || Array.isArray(data.pass) ||
        data.pass.premium !== data.passPremium || !Number.isSafeInteger(data.pass.xp) || data.pass.xp < 0 ||
        typeof data.pass.claimedBitmap !== 'string' || !/^\d{1,13}$/.test(data.pass.claimedBitmap)) return null;
    const bitmap = BigInt(data.pass.claimedBitmap);
    if (bitmap >= 1n << 42n) return null;
    pass = { xp: data.pass.xp, claimedRewards: bitmap.toString(2).replace(/0/g, '').length };
  } else if (data.passPremium) return null;
  const p = data.privileges;
  if (!p || typeof p !== 'object' || !p.farmTrader || !p.priceAlerts ||
      typeof p.farmTrader.enabled !== 'boolean' || typeof p.priceAlerts.fullOptions !== 'boolean' ||
      !Number.isSafeInteger(p.priceAlerts.limit) || p.priceAlerts.limit < 0 ||
      typeof p.skipAdsInQuests !== 'boolean' || !Number.isFinite(p.feeDiscountPct) ||
      p.feeDiscountPct < 0 || p.feeDiscountPct > 100) return null;
  // Premium ownership does not activate benefits that have no enforced path.
  if (p.farmTrader.enabled || p.priceAlerts.fullOptions || p.skipAdsInQuests ||
      p.feeDiscountPct !== 0 || p.priceAlerts.limit !== 1) return null;
  return {
    seasonActive: data.seasonActive, passPremium: data.passPremium, isVip: data.isVip, pass,
    privileges: {
      farmTrader: { enabled: false },
      priceAlerts: { limit: p.priceAlerts.limit, fullOptions: p.priceAlerts.fullOptions },
      skipAdsInQuests: p.skipAdsInQuests, feeDiscountPct: p.feeDiscountPct,
    },
  };
}
