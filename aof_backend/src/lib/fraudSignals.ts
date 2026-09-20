/**
 * Anti-fraud signals derived from the chain indexer ledger (ChainEvent /
 * ChainTx) and the device registry. Pure detectors operate on plain rows so
 * they are unit-testable without a database; `scanFraudSignals` loads the
 * inputs through Prisma and upserts FraudCase rows for a human review queue.
 *
 * Design rules (docs/PRODUCTION_READINESS_ROADMAP.md §2.4):
 *   - signals never enforce anything by themselves: no auto-ban, no trust
 *     multiplier changes; they only open/refresh review cases;
 *   - one open case per (wallet, signal); repeated hits bump `hits`/`lastSeen`
 *     and refresh evidence instead of flooding the queue;
 *   - every threshold is an env-tunable constant listed in SIGNAL_CONFIG so
 *     calibration is auditable.
 */
import { db } from "./db";
import { logger } from "./logger";

export type SignalName =
  | "fresh_wallet_reward"
  | "reward_velocity"
  | "shared_funding"
  | "device_cluster"
  | "wash_trade_pair";

export type Finding = {
  wallet: string;
  signal: SignalName;
  severity: 1 | 2 | 3;
  score: number;
  evidence: Record<string, unknown>;
};

const num = (name: string, dflt: number) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : dflt;
};

export const SIGNAL_CONFIG = {
  /** Events that represent value leaving the treasury towards a player. */
  REWARD_EVENTS: ["ResourceIssued", "RewardMinted", "QuestRewardClaimed", "MiningCollected", "ReferralRewardPaid"],
  /** Wallet is "fresh" if its first indexed event is younger than this. */
  FRESH_WALLET_HOURS: num("FRAUD_FRESH_WALLET_HOURS", 24),
  /** ...and it has already collected at least this many rewards. */
  FRESH_WALLET_MIN_REWARDS: num("FRAUD_FRESH_WALLET_MIN_REWARDS", 5),
  /** Rewards per hour (over the scan window) above which a wallet is flagged. */
  VELOCITY_PER_HOUR: num("FRAUD_REWARD_VELOCITY_PER_HOUR", 12),
  /** Distinct reward recipients sharing one fee payer that is not the backend authority. */
  SHARED_PAYER_MIN_WALLETS: num("FRAUD_SHARED_PAYER_MIN_WALLETS", 4),
  /** Distinct users on one device fingerprint. */
  DEVICE_CLUSTER_MIN_USERS: num("FRAUD_DEVICE_CLUSTER_MIN_USERS", 3),
  /** A↔B trades in both directions, at least this many round trips. */
  WASH_MIN_ROUND_TRIPS: num("FRAUD_WASH_MIN_ROUND_TRIPS", 3),
} as const;

const TRADE_EVENTS = ["ListingSold", "AuctionSettled", "OfferAccepted", "OrderMatched", "HotMarketSold", "LimitOrderMatched"];

// ---------------------------------------------------------------- pure detectors

export type RewardRow = { wallet: string; blockTime: Date; signature: string; feePayer: string };
export type FirstSeenRow = { wallet: string; firstSeen: Date };
export type DeviceRow = { fingerprint: string; user: string };
export type TradeRow = { signature: string; buyer: string; seller: string; blockTime: Date };

/** Fresh wallet already harvesting rewards: classic sybil farm pattern. */
export function detectFreshWalletRewards(rewards: RewardRow[], firstSeen: FirstSeenRow[], now = new Date()): Finding[] {
  const first = new Map(firstSeen.map((r) => [r.wallet, r.firstSeen]));
  const byWallet = groupBy(rewards, (r) => r.wallet);
  const out: Finding[] = [];
  for (const [wallet, rows] of byWallet) {
    const fs = first.get(wallet);
    if (!fs) continue;
    const ageH = (now.getTime() - fs.getTime()) / 3600_000;
    if (ageH > SIGNAL_CONFIG.FRESH_WALLET_HOURS || rows.length < SIGNAL_CONFIG.FRESH_WALLET_MIN_REWARDS) continue;
    out.push({
      wallet, signal: "fresh_wallet_reward",
      severity: rows.length >= SIGNAL_CONFIG.FRESH_WALLET_MIN_REWARDS * 3 ? 3 : 2,
      score: rows.length,
      evidence: { walletAgeHours: round(ageH), rewards: rows.length, firstSeen: fs.toISOString(), signatures: sigs(rows) },
    });
  }
  return out;
}

/** Too many rewards per hour for one wallet inside the scan window. */
export function detectRewardVelocity(rewards: RewardRow[], windowHours: number): Finding[] {
  const out: Finding[] = [];
  for (const [wallet, rows] of groupBy(rewards, (r) => r.wallet)) {
    const perHour = rows.length / Math.max(windowHours, 1 / 60);
    if (perHour < SIGNAL_CONFIG.VELOCITY_PER_HOUR) continue;
    out.push({
      wallet, signal: "reward_velocity",
      severity: perHour >= SIGNAL_CONFIG.VELOCITY_PER_HOUR * 3 ? 3 : 2,
      score: round(perHour),
      evidence: { rewards: rows.length, windowHours, rewardsPerHour: round(perHour), signatures: sigs(rows) },
    });
  }
  return out;
}

/**
 * Many distinct recipients whose reward txs were paid for by the same wallet
 * that is not the backend authority: one operator funding a farm. Each
 * recipient gets a case (the payer is in the evidence) so review can act per
 * wallet.
 */
export function detectSharedFunding(rewards: RewardRow[], authorityPayers: Set<string>): Finding[] {
  const out: Finding[] = [];
  for (const [payer, rows] of groupBy(rewards, (r) => r.feePayer)) {
    if (authorityPayers.has(payer)) continue;
    const recipients = [...new Set(rows.map((r) => r.wallet).filter((w) => w !== payer))];
    if (recipients.length < SIGNAL_CONFIG.SHARED_PAYER_MIN_WALLETS) continue;
    for (const wallet of recipients) {
      out.push({
        wallet, signal: "shared_funding",
        severity: recipients.length >= SIGNAL_CONFIG.SHARED_PAYER_MIN_WALLETS * 3 ? 3 : 2,
        score: recipients.length,
        evidence: { feePayer: payer, clusterSize: recipients.length, cluster: recipients.slice(0, 50), signatures: sigs(rows.filter((r) => r.wallet === wallet)) },
      });
    }
  }
  return out;
}

/** Several users registered from the same device fingerprint. */
export function detectDeviceClusters(devices: DeviceRow[]): Finding[] {
  const out: Finding[] = [];
  for (const [fingerprint, rows] of groupBy(devices, (r) => r.fingerprint)) {
    const users = [...new Set(rows.map((r) => r.user))];
    if (users.length < SIGNAL_CONFIG.DEVICE_CLUSTER_MIN_USERS) continue;
    for (const wallet of users) {
      out.push({
        wallet, signal: "device_cluster",
        severity: users.length >= SIGNAL_CONFIG.DEVICE_CLUSTER_MIN_USERS * 3 ? 3 : 2,
        score: users.length,
        evidence: { fingerprint: fingerprint.slice(0, 12), clusterSize: users.length, cluster: users.slice(0, 50) },
      });
    }
  }
  return out;
}

/** A sells to B and B sells to A repeatedly: wash trading / volume farming. */
export function detectWashTrades(trades: TradeRow[]): Finding[] {
  const dir = new Map<string, TradeRow[]>();
  for (const t of trades) {
    if (t.buyer === t.seller) continue;
    const k = `${t.seller}>${t.buyer}`;
    dir.set(k, [...(dir.get(k) ?? []), t]);
  }
  const out: Finding[] = [];
  const seen = new Set<string>();
  for (const [k, ab] of dir) {
    const [a, b] = k.split(">");
    const pair = [a, b].sort().join("|");
    if (seen.has(pair)) continue;
    const ba = dir.get(`${b}>${a}`) ?? [];
    const roundTrips = Math.min(ab.length, ba.length);
    if (roundTrips < SIGNAL_CONFIG.WASH_MIN_ROUND_TRIPS) continue;
    seen.add(pair);
    for (const wallet of [a, b]) {
      out.push({
        wallet, signal: "wash_trade_pair",
        severity: roundTrips >= SIGNAL_CONFIG.WASH_MIN_ROUND_TRIPS * 3 ? 3 : 2,
        score: roundTrips,
        evidence: { counterparty: wallet === a ? b : a, roundTrips, aToB: ab.length, bToA: ba.length, signatures: sigs([...ab, ...ba]) },
      });
    }
  }
  return out;
}

// ------------------------------------------------------------------ persistence

/** Upsert findings as review cases: one open case per (wallet, signal). */
export async function persistFindings(findings: Finding[], now = new Date()): Promise<{ opened: number; refreshed: number }> {
  let opened = 0, refreshed = 0;
  for (const f of findings) {
    const openKey = `${f.wallet}|${f.signal}`;
    const existing = await db.fraudCase.findUnique({ where: { openKey } });
    if (existing) {
      await db.fraudCase.update({
        where: { id: existing.id },
        data: { lastSeen: now, hits: { increment: 1 }, score: Math.max(existing.score, f.score), severity: Math.max(existing.severity, f.severity), evidence: JSON.stringify(f.evidence) },
      });
      refreshed++;
    } else {
      await db.fraudCase.create({
        data: { wallet: f.wallet, signal: f.signal, severity: f.severity, score: f.score, evidence: JSON.stringify(f.evidence), openKey, firstSeen: now, lastSeen: now },
      });
      opened++;
    }
  }
  return { opened, refreshed };
}

/** Load inputs from the indexer + device registry and run every detector. */
export async function scanFraudSignals(opts: { windowHours?: number; authorityPayers?: string[] } = {}): Promise<{ findings: Finding[]; opened: number; refreshed: number; windowHours: number }> {
  const windowHours = opts.windowHours ?? num("FRAUD_SCAN_WINDOW_HOURS", 24);
  const since = new Date(Date.now() - windowHours * 3600_000);
  const authority = new Set(opts.authorityPayers ?? []);

  const rewardEvents = await db.chainEvent.findMany({
    where: { blockTime: { gte: since }, success: true, eventType: { in: [...SIGNAL_CONFIG.REWARD_EVENTS] }, wallet: { not: null } },
    select: { wallet: true, blockTime: true, signature: true, tx: { select: { feePayer: true } } },
  });
  const rewards: RewardRow[] = rewardEvents.map((e) => ({ wallet: e.wallet as string, blockTime: e.blockTime ?? since, signature: e.signature, feePayer: e.tx.feePayer }));

  const wallets = [...new Set(rewards.map((r) => r.wallet))];
  const firstSeen: FirstSeenRow[] = [];
  for (const wallet of wallets) {
    const first = await db.chainEvent.findFirst({ where: { wallet }, orderBy: { slot: "asc" }, select: { blockTime: true } });
    if (first?.blockTime) firstSeen.push({ wallet, firstSeen: first.blockTime });
  }

  const deviceRows = await db.deviceFingerprint.findMany({ select: { fingerprint: true, user: true } });

  const tradeEvents = await db.chainEvent.findMany({
    where: { blockTime: { gte: since }, success: true, eventType: { in: TRADE_EVENTS } },
    select: { signature: true, blockTime: true, data: true },
  });
  const trades: TradeRow[] = [];
  for (const e of tradeEvents) {
    const d = JSON.parse(e.data) as Record<string, unknown>;
    const buyer = str(d.buyer ?? d.winner ?? d.taker), seller = str(d.seller ?? d.maker ?? d.owner);
    if (buyer && seller) trades.push({ signature: e.signature, buyer, seller, blockTime: e.blockTime ?? since });
  }

  const findings = [
    ...detectFreshWalletRewards(rewards, firstSeen),
    ...detectRewardVelocity(rewards, windowHours),
    ...detectSharedFunding(rewards, authority),
    ...detectDeviceClusters(deviceRows),
    ...detectWashTrades(trades),
  ];
  const { opened, refreshed } = await persistFindings(findings);
  logger.info({ windowHours, rewards: rewards.length, trades: trades.length, findings: findings.length, opened, refreshed }, "fraud signal scan complete");
  return { findings, opened, refreshed, windowHours };
}

// ---------------------------------------------------------------------- helpers

function groupBy<T>(rows: T[], key: (r: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    m.set(k, [...(m.get(k) ?? []), r]);
  }
  return m;
}
const sigs = (rows: { signature: string }[]) => [...new Set(rows.map((r) => r.signature))].slice(0, 20);
const round = (n: number) => Math.round(n * 100) / 100;
const str = (v: unknown) => (typeof v === "string" && v ? v : null);
