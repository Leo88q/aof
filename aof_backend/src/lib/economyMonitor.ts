import { db } from "./db";
import { connection } from "./../provider";
import { PublicKey } from "@solana/web3.js";
import { DataQuality, EconomyFieldQuality, ECONOMY_FIELD_QUALITY, worstQuality } from "./dataQuality";
export { ECONOMY_FIELD_QUALITY, worstQuality } from "./dataQuality";
export type { DataQuality, EconomyFieldQuality } from "./dataQuality";

/**
 * OpenClaw Economy Monitor
 * Анализирует экономику POTATO и детектирует аномалии
 */

export interface EconomyMetrics {
  potatoSupply: bigint;
  potatoBurned24h: bigint;
  potatoMinted24h: bigint;
  inflation24h: number;
  activeCrafters24h: number;
  activeTraders24h: number;
  totalTxs24h: number;
  failedTxs24h: number;
  topHolders: { address: string; balance: bigint }[];
  /** Overall quality: the worst of the per-field values below. */
  dataQuality: DataQuality;
  /**
   * Per-field provenance. Consumers MUST NOT render an `unavailable` field as
   * a numeric fact (a zero from an unimplemented indexer is not "0 minted").
   */
  fieldQuality: EconomyFieldQuality;
}


// Константы для алертов
const THRESHOLDS = {
  inflationCritical: 10,    // >10% = critical
  inflationWarning: 5,      // >5% = warning
  whaleMovement: 100_000,   // 100k POTATO за 1 tx
  txSpike: 200,             // >200 failed tx за час
};

/**
 * Главная функция — снимает snapshot экономики
 * Запускается cron'ом каждые 5 минут
 */
export async function takeEconomySnapshot(): Promise<EconomyMetrics> {
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 3600 * 1000);
  const last1h = new Date(now.getTime() - 3600 * 1000);

  // Параллельно собираем все метрики
  const potatoMint = await getPotatoMint();
  const indexer = await getIndexerCoverage(last24h);
  const topHolders = await getTopHolders(potatoMint);
  const [
    supplyData,
    burnEvents,
    mintEvents,
    baselineSnapshot,
    activeCrafters,
    activeTraders,
    totalTxs,
    failedTxs,
  ] = await Promise.all([
    getPOTATOSupply(potatoMint),
    getBurnEvents(last24h, potatoMint),
    getMintEvents(last24h, potatoMint),
    // Compare with a snapshot at least 24h old. The previous implementation
    // compared to the latest five-minute snapshot while labelling the result
    // "24h", which made the alert metric materially wrong.
    db.economySnapshot.findFirst({
      where: { timestamp: { lte: last24h } },
      orderBy: { timestamp: "desc" },
    }),
    countActors(indexer.quality, last24h, CRAFT_EVENTS, ["craft", "tools", "packs", "forge"]),
    countActors(indexer.quality, last24h, TRADE_EVENTS, ["orderbook", "marketplace", "auction", "hot-market", "offer"]),
    countTxs(indexer.quality, last24h, undefined),
    countTxs(indexer.quality, last24h, false),
  ]);

  const supply = supplyData.supply;
  const fieldQuality: EconomyFieldQuality = {
    ...ECONOMY_FIELD_QUALITY,
    potatoSupply: supplyData.ok ? "complete" : "unavailable",
    // Mint/burn come from the chain indexer's per-tx supply deltas. They are
    // complete only when the indexer has a contiguous window covering the
    // whole 24h; while backfill is running or the cursor is stale they are
    // partial; with no indexed data at all they stay unavailable.
    potatoMinted24h: indexer.quality,
    potatoBurned24h: indexer.quality,
    // Activity switches from the off-chain AuditLog to the on-chain ledger as
    // soon as the indexer fully covers the window; until then it is partial.
    activity24h: indexer.quality === "complete" ? "complete" : "partial",
    topHolders: topHolders.length > 0 ? "complete" : "unavailable",
    // Without a 24h-old snapshot the baseline is the current supply and the
    // inflation figure is 0 by construction, not by measurement.
    inflation24h: supplyData.ok && baselineSnapshot ? "partial" : "unavailable",
  };
  const burned = burnEvents.reduce((sum, e) => sum + e.amount, 0n);
  const minted = mintEvents.reduce((sum, e) => sum + e.amount, 0n);

  // Считаем инфляцию
  const baselineSupply = baselineSnapshot
    ? BigInt(baselineSnapshot.potatoSupply.toString())
    : supply;
  const inflation = baselineSupply > 0n
    ? Number((supply - baselineSupply) * 10000n / baselineSupply) / 100
    : 0;


  const metrics: EconomyMetrics = {
    potatoSupply: supply,
    potatoBurned24h: burned,
    potatoMinted24h: minted,
    inflation24h: inflation,
    activeCrafters24h: activeCrafters,
    activeTraders24h: activeTraders,
    totalTxs24h: totalTxs,
    failedTxs24h: failedTxs,
    topHolders,
    dataQuality: worstQuality(fieldQuality),
    fieldQuality,
  };

  // Сохраняем snapshot
  await db.economySnapshot.create({
    data: {
      potatoSupply: supply,
      potatoBurned24h: burned,
      potatoMinted24h: minted,
      inflation24h: inflation,
      activeCrafters24h: activeCrafters,
      activeTraders24h: activeTraders,
      totalTxs24h: totalTxs,
      failedTxs24h: failedTxs,
      topHolders: JSON.stringify(topHolders.slice(0, 10).map(h => ({
        address: h.address,
        balance: h.balance.toString(),
      }))),
      fieldQuality: JSON.stringify(fieldQuality),
    },
  });

  // Проверяем алерты
  await checkAlerts(metrics);

  // [ФИКС] Конвертируем BigInt в string для JSON сериализации
  return {
    ...metrics,
    potatoSupply: metrics.potatoSupply.toString(),
    potatoBurned24h: metrics.potatoBurned24h.toString(),
    potatoMinted24h: metrics.potatoMinted24h.toString(),
    topHolders: metrics.topHolders.map(h => ({
      address: h.address,
      balance: h.balance.toString(),
    })),
  } as any;
}

/**
 * Проверка порогов и создание алертов
 */
async function checkAlerts(metrics: EconomyMetrics) {
  // 1. Инфляция
  if (metrics.inflation24h > THRESHOLDS.inflationCritical) {
    await createAlert({
      type: "inflation",
      severity: "critical",
      message: `🚨 Критическая инфляция POTATO: ${metrics.inflation24h.toFixed(2)}% за 24ч`,
      metadata: { inflation: metrics.inflation24h, supply: metrics.potatoSupply.toString() },
    });
    // Automatic economic parameter changes are deliberately not performed:
    // this monitor has no authority-signed, reviewed set_craft_economy path.
  } else if (metrics.inflation24h > THRESHOLDS.inflationWarning) {
    await createAlert({
      type: "inflation",
      severity: "warning",
      message: `⚠️ Высокая инфляция POTATO: ${metrics.inflation24h.toFixed(2)}% за 24ч`,
      metadata: { inflation: metrics.inflation24h },
    });
  }

  // 2. Spike failed transactions
  const failedRatio = metrics.totalTxs24h > 0 
    ? metrics.failedTxs24h / metrics.totalTxs24h 
    : 0;
  
  if (metrics.failedTxs24h > THRESHOLDS.txSpike && failedRatio > 0.1) {
    await createAlert({
      type: "tx_spike",
      severity: "warning",
      message: `⚠️ Spike failed транзакций: ${metrics.failedTxs24h}/${metrics.totalTxs24h} (${(failedRatio * 100).toFixed(1)}%)`,
      metadata: { 
        failed: metrics.failedTxs24h, 
        total: metrics.totalTxs24h,
        ratio: failedRatio 
      },
    });
  }
}

/**
 * Создаёт алерт
 */
async function createAlert(data: {
  type: string;
  severity: string;
  message: string;
  metadata?: any;
}) {
  await db.economyAlert.create({
    data: {
      type: data.type,
      severity: data.severity,
      message: data.message,
      metadata: JSON.stringify(data.metadata || {}),
    },
  });

  console.log(`🚨 [OpenClaw] ${data.severity.toUpperCase()}: ${data.message}`);
  
  // TODO: отправка в Telegram
  // await sendTelegramAlert(data);
}

// === Вспомогательные функции ===

async function getPotatoMint(): Promise<PublicKey | null> {
  try {
    const { configPda } = await import("./pda");
    const { fetchOne } = await import("./decode");
    const [config] = configPda();
    const cfg: any = await fetchOne("config", config);
    return cfg?.potatoMint ? new PublicKey(cfg.potatoMint.toString()) : null;
  } catch {
    return null;
  }
}

async function getPOTATOSupply(potatoMint: PublicKey | null): Promise<{ supply: bigint; ok: boolean }> {
  try {
    if (!potatoMint) return { supply: 0n, ok: false };
    const mintInfo = await connection.getParsedAccountInfo(potatoMint);
    const rawSupply = (mintInfo.value?.data as any)?.parsed?.info?.supply;
    if (rawSupply === undefined || rawSupply === null) return { supply: 0n, ok: false };
    return { supply: BigInt(rawSupply), ok: true };
  } catch (e) {
    return { supply: 0n, ok: false };
  }
}

/**
 * How much of the last 24h the chain indexer actually covers for aof_core.
 *   complete   — cursor fresh (< 10 min) and backfill done or oldest indexed
 *                tx is older than the window start
 *   partial    — some data but the window is not fully covered
 *   unavailable— no indexer rows at all
 */
async function getIndexerCoverage(since: Date): Promise<{ quality: "complete" | "partial" | "unavailable" }> {
  try {
    const { PROGRAM_ID } = await import("../provider");
    const cursor = await db.indexerCursor.findUnique({ where: { programId: PROGRAM_ID.toBase58() } });
    if (!cursor || !cursor.newestSignature) return { quality: "unavailable" };
    const fresh = Date.now() - cursor.updatedAt.getTime() < 10 * 60 * 1000;
    if (!fresh) return { quality: "partial" };
    if (cursor.backfillComplete) return { quality: "complete" };
    const oldest = await db.chainTx.findFirst({ orderBy: { slot: "asc" }, select: { blockTime: true } });
    if (oldest?.blockTime && oldest.blockTime <= since) return { quality: "complete" };
    return { quality: "partial" };
  } catch {
    return { quality: "unavailable" };
  }
}

/** Sum of positive / negative supply deltas for one mint in the window. */
async function sumMintDeltas(since: Date, mint: PublicKey | null, sign: 1 | -1): Promise<{ amount: bigint }[]> {
  if (!mint) return [];
  const rows = await db.chainMintDelta.findMany({
    where: { mint: mint.toBase58(), blockTime: { gte: since } },
    select: { delta: true },
  });
  let total = 0n;
  for (const r of rows) {
    const d = BigInt(r.delta);
    if (sign === 1 && d > 0n) total += d;
    if (sign === -1 && d < 0n) total += -d;
  }
  return total > 0n ? [{ amount: total }] : [];
}

async function getBurnEvents(since: Date, potatoMint: PublicKey | null): Promise<{ amount: bigint }[]> {
  return sumMintDeltas(since, potatoMint, -1);
}

async function getMintEvents(since: Date, potatoMint: PublicKey | null): Promise<{ amount: bigint }[]> {
  return sumMintDeltas(since, potatoMint, 1);
}

// Event types that count as "crafting" / "trading" activity on-chain.
const CRAFT_EVENTS = ["CraftEvent", "ToolCrafted", "ToolMinted", "PackOpened", "ForgeAttempted", "ToolRepaired", "RerollResult", "MiningCollected"];
const TRADE_EVENTS = ["ListingSold", "ListingCreated", "AuctionBid", "AuctionSettled", "OfferAccepted", "OrderPlaced", "OrderMatched", "HotMarketBought", "HotMarketSold", "LimitOrderPlaced", "LimitOrderMatched"];

/** Distinct actors: on-chain events when the ledger is complete, AuditLog otherwise. */
async function countActors(quality: "complete" | "partial" | "unavailable", since: Date, eventTypes: string[], auditFragments: string[]): Promise<number> {
  if (quality === "complete") {
    const rows = await db.chainEvent.findMany({
      where: { blockTime: { gte: since }, eventType: { in: eventTypes }, wallet: { not: null } },
      distinct: ["wallet"], select: { wallet: true },
    });
    return rows.length;
  }
  const logs = await db.auditLog.findMany({
    where: { timestamp: { gte: since }, result: "success", OR: auditFragments.map((f) => ({ action: { contains: f } })) },
    select: { user: true },
  });
  return new Set(logs.map((l: any) => l.user)).size;
}

/** Tx count (all or failed only) from the same source selection as countActors. */
async function countTxs(quality: "complete" | "partial" | "unavailable", since: Date, success: boolean | undefined): Promise<number> {
  if (quality === "complete") {
    return db.chainTx.count({ where: { blockTime: { gte: since }, ...(success === undefined ? {} : { success }) } });
  }
  return db.auditLog.count({ where: { timestamp: { gte: since }, ...(success === undefined ? {} : { result: success ? "success" : "fail" }) } });
}

/**
 * Top-20 holders straight from the RPC (getTokenLargestAccounts). Enough for
 * whale/concentration alerts; a full holder census needs a DAS provider.
 */
async function getTopHolders(potatoMint: PublicKey | null): Promise<{ address: string; balance: bigint }[]> {
  if (!potatoMint) return [];
  try {
    const largest = await connection.getTokenLargestAccounts(potatoMint, "confirmed");
    const accounts = largest.value.slice(0, 20);
    if (accounts.length === 0) return [];
    const infos = await connection.getMultipleParsedAccounts(accounts.map((a) => a.address), { commitment: "confirmed" });
    return accounts.map((a, i) => {
      const owner = (infos.value[i]?.data as any)?.parsed?.info?.owner;
      return { address: typeof owner === "string" ? owner : a.address.toBase58(), balance: BigInt(a.amount) };
    });
  } catch {
    return [];
  }
}
