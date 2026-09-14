import { db } from "./db";
import { connection } from "./../provider";
import { PublicKey } from "@solana/web3.js";

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
  /** Explicitly surfaced because event/holder indexing is not complete yet. */
  dataQuality: "partial" | "complete";
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
    getPOTATOSupply(),
    getBurnEvents(last24h),
    getMintEvents(last24h),
    // Compare with a snapshot at least 24h old. The previous implementation
    // compared to the latest five-minute snapshot while labelling the result
    // "24h", which made the alert metric materially wrong.
    db.economySnapshot.findFirst({
      where: { timestamp: { lte: last24h } },
      orderBy: { timestamp: "desc" },
    }),
    db.auditLog.findMany({
      where: { 
        timestamp: { gte: last24h },
        result: "success",
        OR: [
          { action: { contains: "craft" } },
          { action: { contains: "tools" } },
          { action: { contains: "packs" } },
          { action: { contains: "forge" } },
        ],
      },
      select: { user: true }
    }).then(logs => new Set(logs.map((l: any) => l.user)).size),
    db.auditLog.findMany({
      where: {
        timestamp: { gte: last24h },
        result: "success",
        OR: [
          { action: { contains: "orderbook" } },
          { action: { contains: "marketplace" } },
          { action: { contains: "auction" } },
        ],
      },
      select: { user: true }
    }).then(logs => new Set(logs.map((l: any) => l.user)).size),
    db.auditLog.count({ where: { timestamp: { gte: last24h } } }),
    db.auditLog.count({ where: { timestamp: { gte: last24h }, result: "fail" } }),
  ]);

  const supply = supplyData.supply;
  const burned = burnEvents.reduce((sum, e) => sum + e.amount, 0n);
  const minted = mintEvents.reduce((sum, e) => sum + e.amount, 0n);

  // Считаем инфляцию
  const baselineSupply = baselineSnapshot
    ? BigInt(baselineSnapshot.potatoSupply.toString())
    : supply;
  const inflation = baselineSupply > 0n
    ? Number((supply - baselineSupply) * 10000n / baselineSupply) / 100
    : 0;

  // Топ холдеры (упрощённо — из audit logs)
  const topHolders = await getTopHolders();

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
    // Mint/burn event and holder indexing are still TODO; do not present the
    // zero-valued breakdown as a complete economic accounting.
    dataQuality: "partial",
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

async function getPOTATOSupply(): Promise<{ supply: bigint }> {
  try {
    // Читаем из Config PDA
    const { configPda } = await import("./pda");
    const { fetchOne } = await import("./decode");
    const [config] = configPda();
    const cfg: any = await fetchOne("config", config);
    
    if (!cfg?.potatoMint) {
      return { supply: 0n };
    }

    // Читаем mint account
    const mintInfo = await connection.getParsedAccountInfo(new PublicKey(cfg.potatoMint));
    const supply = BigInt((mintInfo.value?.data as any)?.parsed?.info?.supply || "0");
    
    return { supply };
  } catch (e) {
    return { supply: 0n };
  }
}

async function getBurnEvents(since: Date): Promise<{ amount: bigint }[]> {
  // TODO: парсить events из on-chain (BurnResource events)
  return [];
}

async function getMintEvents(since: Date): Promise<{ amount: bigint }[]> {
  // TODO: парсить events из on-chain (MintResource events)
  return [];
}

async function getTopHolders(): Promise<{ address: string; balance: bigint }[]> {
  // TODO: индексировать top holders через Helius/Shyft
  return [];
}
