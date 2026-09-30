/**
 * Чтения событийного рынка: параметры пула, его инвентарь и оценка цены.
 *
 * Всё, что показывает панель, приходит из сети: параметры пула — из
 * `/query/hot-market-pool/:rarity`, инвентарь — из `/query/hot-market-inventory/:rarity`
 * (бэкенд читает ATA пула и оставляет только канонические ToolData с
 * владельцем-пулом). Локально считается только *оценка* цены по той же формуле,
 * что и on-chain (`programs/aof-market/src/pricing.rs` + горячее окно); она нужна,
 * чтобы подставить ориентир в поле границы цены. Настоящую цену считает
 * программа, поэтому обе стороны сделки подписывают потолок (покупка) или
 * минимум (продажа).
 */

const isAddress = (value: unknown): value is string =>
  typeof value === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);

export type HotPool = {
  rarity: number;
  targetPriceCore: number;
  targetPriceGem: number;
  growthBpsPerSale: number;
  decayBpsPerHour: number;
  feeBps: number;
  soldSinceStart: number;
  purchasesInWindow: number;
  lastTradeTs: number | null;
  hotWindowEndTs: number | null;
  hotMultiplierBps: number;
  coreDecimals: number | null;
  gemDecimals: number | null;
  paused: boolean;
};

export type HotInventoryItem = {
  mint: string;
  toolType: string | null;
  rarity: string | null;
  durability: number | null;
};

export type HotTool = { mint: string; toolType: string | null; rarity: string | null };

const num = (value: unknown): number | null => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/** Параметры пула или null: панель не рисует цены по неполным данным. */
export function readHotPool(raw: unknown): HotPool | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const fields = ['targetPriceCore', 'targetPriceGem', 'growthBpsPerSale', 'decayBpsPerHour', 'feeBps'] as const;
  const parsed: Record<string, number> = {};
  for (const field of fields) {
    const value = num(row[field]);
    if (value === null) return null;
    parsed[field] = value;
  }
  if (parsed.targetPriceCore <= 0 || parsed.targetPriceGem <= 0) return null;
  const decimals = (value: unknown): number | null => {
    const n = num(value);
    return n !== null && Number.isInteger(n) && n <= 18 ? n : null;
  };
  return {
    rarity: num(row.rarity) ?? 0,
    targetPriceCore: parsed.targetPriceCore,
    targetPriceGem: parsed.targetPriceGem,
    growthBpsPerSale: parsed.growthBpsPerSale,
    decayBpsPerHour: parsed.decayBpsPerHour,
    feeBps: parsed.feeBps,
    soldSinceStart: num(row.soldSinceStart) ?? 0,
    purchasesInWindow: num(row.purchasesInWindow) ?? 0,
    lastTradeTs: num(row.lastTradeTs),
    hotWindowEndTs: num(row.hotWindowEndTs),
    hotMultiplierBps: num(row.hotMultiplierBps) ?? 0,
    coreDecimals: decimals(row.coreDecimals),
    gemDecimals: decimals(row.gemDecimals),
    paused: Boolean(row.paused),
  };
}

/** Инвентарь пула: только канонические инструменты, иначе null (не пустой список). */
export function readHotInventory(raw: unknown): HotInventoryItem[] | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const items = (raw as Record<string, unknown>).items;
  if (!Array.isArray(items)) return null;
  const out: HotInventoryItem[] = [];
  for (const entry of items) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
    const row = entry as Record<string, unknown>;
    if (!isAddress(row.mint)) return null;
    out.push({
      mint: row.mint,
      toolType: typeof row.toolType === 'string' ? row.toolType : null,
      rarity: typeof row.rarity === 'string' ? row.rarity : null,
      durability: num(row.durability),
    });
  }
  return out;
}

/**
 * Инструменты игрока, которые рынок примет в продажу: владелец и оператор — сам
 * игрок, инструмент не в стейке и не в майнинге (иначе aof_core::transfer_tool
 * отклонит сделку).
 */
export function readHotSellableTools(raw: unknown, owner: string): HotTool[] | null {
  const rows = Array.isArray(raw) ? raw : null;
  if (!rows) return null;
  const out: HotTool[] = [];
  for (const entry of rows) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
    const row = entry as Record<string, unknown>;
    if (!isAddress(row.mint)) return null;
    if (row.owner !== owner) continue;
    if (row.operator != null && row.operator !== owner) continue;
    if (row.staked === true || row.isMining === true || row.mining === true) continue;
    out.push({
      mint: row.mint,
      toolType: typeof row.toolType === 'string' ? row.toolType : null,
      rarity: typeof row.rarity === 'string' ? row.rarity : null,
    });
  }
  return out;
}

/**
 * Оценка цены пула — та же арифметика, что в `pricing::current_price` и
 * `pool_price`: рост на `growthBpsPerSale` за покупку (не больше 200 шагов и
 * ×100 к базе), затухание на `decayBpsPerHour` за час простоя (не больше 72),
 * затем множитель горячего окна. Оценка нужна только как ориентир в форме.
 */
export function estimateHotPrice(pool: HotPool, base: number, nowMs: number): number {
  let price = base;
  const growth = Math.min(Math.floor(pool.purchasesInWindow), 200);
  for (let i = 0; i < growth; i += 1) {
    price = Math.round((price * (10_000 + pool.growthBpsPerSale)) / 10_000);
    if (price >= base * 100) { price = base * 100; break; }
  }
  if (pool.lastTradeTs !== null) {
    const idleHours = Math.min(Math.floor(Math.max(0, nowMs / 1000 - pool.lastTradeTs) / 3600), 72);
    for (let i = 0; i < idleHours; i += 1) {
      price = Math.round((price * Math.max(1, 10_000 - pool.decayBpsPerHour)) / 10_000);
      if (price <= base) { price = base; break; }
    }
  }
  const hot = pool.hotWindowEndTs !== null && nowMs / 1000 < pool.hotWindowEndTs ? pool.hotMultiplierBps : 0;
  if (hot > 0) price = Math.round((price * (10_000 + hot)) / 10_000);
  return Math.max(1, price);
}

/** «1.25» → атомы строкой. Возвращает null для мусора, нуля и лишних знаков. */
export function parseUnits(input: string, decimals: number | null): string | null {
  const digits = decimals === null || decimals < 0 || decimals > 18 ? 9 : decimals;
  const text = input.trim().replace(/\s+/g, '');
  if (!/^\d+(\.\d*)?$/.test(text)) return null;
  const [whole, fraction = ''] = text.split('.');
  if (fraction.length > digits) return null;
  const padded = (fraction + '0'.repeat(digits)).slice(0, digits);
  const raw = BigInt(whole) * 10n ** BigInt(digits) + BigInt(padded || '0');
  return raw > 0n ? raw.toString() : null;
}

/** Атомы → «1.25» без экспоненты и лишних нулей. */
export function formatUnits(raw: unknown, decimals: number | null): string {
  const digits = decimals === null || decimals < 0 || decimals > 18 ? 9 : decimals;
  let value: bigint;
  try {
    value = BigInt(String(raw ?? '0'));
  } catch {
    return '0';
  }
  if (value < 0n) value = -value;
  const factor = 10n ** BigInt(digits);
  const whole = value / factor;
  const fraction = (value % factor).toString().padStart(digits, '0').replace(/0+$/, '');
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return fraction ? `${grouped}.${fraction}` : grouped;
}
