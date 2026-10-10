/**
 * Цена пула горячего рынка. Целая арифметика совпадает с
 * `programs/aof-market/src/pricing.rs` и `pool_price`: деление отбрасывает
 * дробь, а не округляет. Это оценка для графика. Сделку считает программа.
 */

const MAX_GROWTH_ITER = 200n;
const MAX_DECAY_HOURS = 72n;
const PRICE_CAP_MULT = 100n;

type IntLike = { toString(): string } | bigint | number;

function asBig(value: IntLike): bigint {
  return typeof value === "bigint" ? value : BigInt(value.toString());
}

export function applyGrowth(base: bigint, growthBps: bigint, purchases: bigint): bigint {
  let price = base;
  const factor = 10_000n + growthBps;
  const steps = purchases < MAX_GROWTH_ITER ? purchases : MAX_GROWTH_ITER;
  const cap = base * PRICE_CAP_MULT;
  for (let i = 0n; i < steps; i += 1n) {
    price = (price * factor) / 10_000n;
    if (price >= cap) return cap;
  }
  return price;
}

export function applyDecay(current: bigint, base: bigint, decayBps: bigint, hoursIdle: bigint): bigint {
  if (hoursIdle <= 0n) return current;
  let price = current;
  const rawFactor = 10_000n - decayBps;
  const factor = rawFactor > 1n ? rawFactor : 1n;
  const steps = hoursIdle < MAX_DECAY_HOURS ? hoursIdle : MAX_DECAY_HOURS;
  for (let i = 0n; i < steps; i += 1n) {
    price = (price * factor) / 10_000n;
    if (price <= base) return base;
  }
  return price > 1n ? price : 1n;
}

export function currentPrice(
  base: bigint,
  growthBps: bigint,
  decayBps: bigint,
  purchases: bigint,
  lastTradeTs: bigint,
  now: bigint,
): bigint {
  const grown = applyGrowth(base, growthBps, purchases);
  const hoursIdle = now > lastTradeTs ? (now - lastTradeTs) / 3600n : 0n;
  return applyDecay(grown, base, decayBps, hoursIdle);
}

export type HotPoolQuote = {
  targetPriceCore: IntLike;
  targetPriceGem: IntLike;
  growthBpsPerSale: IntLike;
  decayBpsPerHour: IntLike;
  purchasesInWindow: IntLike;
  lastTradeTs: IntLike;
  hotWindowEndTs: IntLike;
  hotMultiplierBps: IntLike;
};

/** Цена сделки: рост, затухание и множитель горячего окна. Не меньше 1 атома. */
export function poolTradePrice(pool: HotPoolQuote, currency: "core" | "gem", now: bigint): bigint {
  const base = asBig(currency === "core" ? pool.targetPriceCore : pool.targetPriceGem);
  if (base <= 0n) throw new Error("HOT_MARKET_ZERO_PRICE");
  let price = currentPrice(
    base,
    asBig(pool.growthBpsPerSale),
    asBig(pool.decayBpsPerHour),
    asBig(pool.purchasesInWindow),
    asBig(pool.lastTradeTs),
    now,
  );
  const hotBps = asBig(pool.hotMultiplierBps);
  const hotEnd = asBig(pool.hotWindowEndTs);
  if (hotBps > 0n && now < hotEnd) price = (price * (10_000n + hotBps)) / 10_000n;
  return price > 1n ? price : 1n;
}

/** Атомы в число графика. Не для расчёта платежа. */
export function scaleAtoms(atoms: bigint, decimals: number): number {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) throw new Error("HOT_MARKET_DECIMALS_UNREAD");
  const factor = 10n ** BigInt(decimals);
  const whole = atoms / factor;
  const fraction = atoms % factor;
  return Number(whole) + Number(fraction) / Number(factor);
}
