/**
 * Read-model queries for the exporter. Every function here only SELECTs from
 * the chain-indexer ledger (ChainTx / ChainEvent / ChainMintDelta /
 * IndexerCursor) and a few backend tables (FraudCase, AuditLog,
 * EconomySnapshot). There is deliberately no Prisma write call in this
 * file; tests/watchtower-readonly.test.ts greps for that.
 */
import type { PrismaClient } from "@prisma/client";
import { hashPlayer, normalizeChainEvent, normalizeChainTx, type WatchtowerEvent } from "./event-normalizer";

export type ReadModelDeps = { db: PrismaClient; salt: string; treasury: string | null; programIds: string[] };

export type DataQuality = "complete" | "partial" | "unavailable";

const DAY = 86_400_000;
const dayKey = (d: Date | null) => (d ?? new Date(0)).toISOString().slice(0, 10);

// ---------------------------------------------------------------- coverage

export async function coverage(deps: ReadModelDeps) {
  const cursors = await deps.db.indexerCursor.findMany();
  const [oldest, newest] = await Promise.all([
    deps.db.chainTx.findFirst({ orderBy: { slot: "asc" }, select: { slot: true, blockTime: true } }),
    deps.db.chainTx.findFirst({ orderBy: { slot: "desc" }, select: { slot: true, blockTime: true } }),
  ]);
  const backfillComplete = deps.programIds.length > 0 && deps.programIds.every((p) => cursors.find((c) => c.programId === p)?.backfillComplete);
  const tracked = deps.programIds.length > 0 && deps.programIds.every((p) => cursors.some((c) => c.programId === p));
  const fresh = tracked && deps.programIds.every((p) => {
    const c = cursors.find((cursor) => cursor.programId === p);
    const age = c ? Date.now() - new Date(c.updatedAt).getTime() : NaN;
    return c?.newestSlot != null && !c.lastError && age >= 0 && age <= 10 * 60_000;
  });
  const quality: DataQuality = !tracked || !newest || !fresh ? "unavailable" : backfillComplete ? "complete" : "partial";
  return {
    quality, backfillComplete, tracked, fresh,
    oldest: oldest ? { slot: oldest.slot.toString(), blockTime: oldest.blockTime } : null,
    newest: newest ? { slot: newest.slot.toString(), blockTime: newest.blockTime } : null,
    cursors: cursors.map((c) => ({ programId: c.programId, newestSlot: c.newestSlot?.toString() ?? null, backfillComplete: c.backfillComplete, txIndexed: c.txIndexed, lastError: c.lastError, updatedAt: c.updatedAt })),
  };
}

/** Window quality: complete only when the ledger covers the whole window. */
export function windowQuality(cov: Awaited<ReturnType<typeof coverage>>, since: Date): DataQuality {
  if (cov.quality === "unavailable") return "unavailable";
  if (cov.backfillComplete) return "complete";
  const oldest = cov.oldest?.blockTime ? new Date(cov.oldest.blockTime) : null;
  return oldest && oldest <= since ? "complete" : "partial";
}

// ------------------------------------------------------------------ events

export type EventCursor = { slot: bigint; signature: string; eventIndex: number };

export function encodeCursor(c: EventCursor): string {
  return Buffer.from(`${c.slot}:${c.signature}:${c.eventIndex}`).toString("base64url");
}
export function decodeCursor(s: string | undefined): EventCursor | null {
  if (!s) return null;
  const [slot, signature, idx] = Buffer.from(s, "base64url").toString().split(":");
  if (!slot || !signature || idx === undefined || !/^\d+$/.test(slot) || !/^-?\d+$/.test(idx)) throw new Error("invalid cursor");
  return { slot: BigInt(slot), signature, eventIndex: Number(idx) };
}

/**
 * Forward-only event stream, ordered (slot, signature, eventIndex), so a
 * consumer can resume exactly where it stopped and replay a range
 * deterministically. Tx-level reliability events are interleaved with
 * eventIndex = -1 (before that tx's own events).
 */
export async function events(deps: ReadModelDeps, q: { after?: EventCursor | null; sinceSlot?: bigint; limit: number; types?: string[]; includeTx?: boolean }) {
  const fromSlot = q.after?.slot ?? q.sinceSlot ?? 0n;
  const txs = await deps.db.chainTx.findMany({
    where: q.after ? { OR: [
      { slot: { gt: q.after.slot } },
      { slot: q.after.slot, signature: { gte: q.after.signature } },
    ] } : { slot: { gte: fromSlot } },
    orderBy: [{ slot: "asc" }, { signature: "asc" }],
    take: Math.min(q.limit, 500) + 1,
    include: { events: { orderBy: { eventIndex: "asc" } } },
  });
  const out: WatchtowerEvent[] = [];
  let last: EventCursor | null = q.after ?? null;
  for (const tx of txs) {
    const rows: { idx: number; evs: WatchtowerEvent[] }[] = [];
    // Even an empty/ignored transaction must advance the source cursor.
    rows.push({ idx: -1, evs: q.includeTx !== false ? normalizeChainTx(tx, deps.salt) : [] });
    for (const ev of tx.events) rows.push({ idx: ev.eventIndex, evs: normalizeChainEvent(ev, deps.salt, { treasury: deps.treasury }) });
    for (const r of rows) {
      const pos: EventCursor = { slot: tx.slot, signature: tx.signature, eventIndex: r.idx };
      if (q.after && compareCursor(pos, q.after) <= 0) continue;
      for (const e of r.evs) if (!q.types || q.types.includes(e.type)) out.push(e);
      last = pos;
      if (out.length >= q.limit) break;
    }
    if (out.length >= q.limit) break;
  }
  return { events: out, nextCursor: last ? encodeCursor(last) : null, hasMore: out.length >= q.limit || txs.length > q.limit };
}

function compareCursor(a: EventCursor, b: EventCursor): number {
  if (a.slot !== b.slot) return a.slot < b.slot ? -1 : 1;
  if (a.signature !== b.signature) return a.signature < b.signature ? -1 : 1;
  return a.eventIndex - b.eventIndex;
}

// ------------------------------------------------------------- daily metrics

export async function dailyMetrics(deps: ReadModelDeps, days: number) {
  const since = new Date(Date.now() - days * DAY);
  const [txs, evs] = await Promise.all([
    deps.db.chainTx.findMany({ where: { blockTime: { gte: since } }, select: { blockTime: true, success: true, feePayer: true } }),
    deps.db.chainEvent.findMany({ where: { blockTime: { gte: since }, success: true }, select: { blockTime: true, eventType: true, wallet: true, signature: true, eventIndex: true, slot: true, programId: true, mint: true, amount: true, success: true, data: true } }),
  ]);
  const byDay = new Map<string, { txOk: number; txFailed: number; payers: Set<string>; actors: Set<string>; byType: Record<string, number>; byCategory: Record<string, number> }>();
  const bucket = (k: string) => byDay.get(k) ?? byDay.set(k, { txOk: 0, txFailed: 0, payers: new Set(), actors: new Set(), byType: {}, byCategory: {} }).get(k)!;
  for (const t of txs) { const b = bucket(dayKey(t.blockTime)); t.success ? b.txOk++ : b.txFailed++; if (t.feePayer) b.payers.add(t.feePayer); }
  for (const e of evs) {
    const b = bucket(dayKey(e.blockTime));
    if (e.wallet) b.actors.add(e.wallet);
    for (const w of normalizeChainEvent(e, deps.salt)) { b.byType[w.type] = (b.byType[w.type] ?? 0) + 1; b.byCategory[w.category] = (b.byCategory[w.category] ?? 0) + 1; }
  }
  return [...byDay].sort(([a], [b]) => a.localeCompare(b)).map(([day, b]) => ({
    day, transactions: { ok: b.txOk, failed: b.txFailed, failureRate: b.txOk + b.txFailed ? b.txFailed / (b.txOk + b.txFailed) : 0 },
    uniqueFeePayers: b.payers.size, activePlayers: b.actors.size, eventsByType: b.byType, eventsByCategory: b.byCategory,
  }));
}

// ---------------------------------------------------------- players/cohorts

/** First-seen per wallet from the ledger — the basis for cohorts, retention and PlayerJoined. */
async function firstSeenByWallet(deps: ReadModelDeps): Promise<Map<string, Date>> {
  // groupBy _min on blockTime; SQLite and PG both support it through Prisma.
  const rows = await deps.db.chainEvent.groupBy({ by: ["wallet"], where: { wallet: { not: null }, blockTime: { not: null } }, _min: { blockTime: true } });
  const m = new Map<string, Date>();
  for (const r of rows) if (r.wallet && r._min.blockTime) m.set(r.wallet, r._min.blockTime);
  return m;
}

export async function cohorts(deps: ReadModelDeps, weeks: number) {
  const first = await firstSeenByWallet(deps);
  const since = Date.now() - weeks * 7 * DAY;
  const byWeek = new Map<string, number>();
  for (const d of first.values()) {
    if (d.getTime() < since) continue;
    const monday = new Date(d); monday.setUTCHours(0, 0, 0, 0); monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
    const k = monday.toISOString().slice(0, 10);
    byWeek.set(k, (byWeek.get(k) ?? 0) + 1);
  }
  return [...byWeek].sort(([a], [b]) => a.localeCompare(b)).map(([weekStart, newPlayers]) => ({ weekStart, newPlayers }));
}

const RETENTION_DAYS = [1, 3, 7, 14, 30] as const;

export async function retention(deps: ReadModelDeps) {
  const first = await firstSeenByWallet(deps);
  if (first.size === 0) return { players: 0, days: RETENTION_DAYS.map((d) => ({ day: d, eligible: 0, retained: 0, rate: null })) };
  // Activity days per wallet, as day offsets from first-seen.
  const rows = await deps.db.chainEvent.findMany({ where: { wallet: { not: null }, blockTime: { not: null } }, select: { wallet: true, blockTime: true }, distinct: ["wallet", "blockTime"] });
  const active = new Map<string, Set<number>>();
  for (const r of rows) {
    const f = first.get(r.wallet!); if (!f || !r.blockTime) continue;
    const off = Math.floor((r.blockTime.getTime() - f.getTime()) / DAY);
    (active.get(r.wallet!) ?? active.set(r.wallet!, new Set()).get(r.wallet!)!).add(off);
  }
  const now = Date.now();
  const days = RETENTION_DAYS.map((d) => {
    let eligible = 0, retained = 0;
    for (const [w, f] of first) {
      if (now - f.getTime() < (d + 1) * DAY) continue; // not old enough to be measured
      eligible++;
      if (active.get(w)?.has(d)) retained++;
    }
    return { day: d, eligible, retained, rate: eligible ? retained / eligible : null };
  });
  return { players: first.size, days };
}

export async function crossGame(deps: ReadModelDeps, limit: number) {
  // Cross-game identity = the shared-salt hash. This endpoint exposes the
  // hashed roster so Watchtower can join it with other games' rosters.
  const first = await firstSeenByWallet(deps);
  const roster = [...first].sort((a, b) => a[1].getTime() - b[1].getTime()).slice(0, limit)
    .map(([w, f]) => ({ playerId: hashPlayer(w, deps.salt), firstSeen: f.toISOString() }));
  return { hashAlgorithm: "sha256(salt|wallet)", players: first.size, roster };
}

// ------------------------------------------------------------------ economy

export async function economy(deps: ReadModelDeps, days: number) {
  const since = new Date(Date.now() - days * DAY);
  const deltas = await deps.db.chainMintDelta.findMany({ where: { blockTime: { gte: since } }, select: { mint: true, delta: true, blockTime: true } });
  const perMint = new Map<string, { minted: bigint; burned: bigint; daily: Map<string, { minted: bigint; burned: bigint }> }>();
  for (const r of deltas) {
    const m = perMint.get(r.mint) ?? perMint.set(r.mint, { minted: 0n, burned: 0n, daily: new Map() }).get(r.mint)!;
    const d = BigInt(r.delta); const k = dayKey(r.blockTime);
    const day = m.daily.get(k) ?? m.daily.set(k, { minted: 0n, burned: 0n }).get(k)!;
    if (d > 0n) { m.minted += d; day.minted += d; } else { m.burned -= d; day.burned -= d; }
  }
  const snapshot = await deps.db.economySnapshot.findFirst({ orderBy: { timestamp: "desc" } });
  return {
    mints: [...perMint].map(([mint, m]) => ({ mint, minted: m.minted.toString(), burned: m.burned.toString(), net: (m.minted - m.burned).toString(),
      daily: [...m.daily].sort(([a], [b]) => a.localeCompare(b)).map(([day, v]) => ({ day, minted: v.minted.toString(), burned: v.burned.toString() })) })),
    latestSnapshot: snapshot ? {
      timestamp: snapshot.timestamp, potatoSupply: snapshot.potatoSupply.toString(), potatoMinted24h: snapshot.potatoMinted24h.toString(), potatoBurned24h: snapshot.potatoBurned24h.toString(),
      inflation24h: snapshot.inflation24h, activeCrafters24h: snapshot.activeCrafters24h, activeTraders24h: snapshot.activeTraders24h, totalTxs24h: snapshot.totalTxs24h, failedTxs24h: snapshot.failedTxs24h,
      fieldQuality: snapshot.fieldQuality ? JSON.parse(snapshot.fieldQuality) : null,
    } : null,
  };
}

export async function treasury(deps: ReadModelDeps, days: number) {
  const since = new Date(Date.now() - days * DAY);
  const rows = await deps.db.chainEvent.findMany({ where: { blockTime: { gte: since }, success: true, eventType: { in: ["ResourceIssued", "GasFeesSwept", "PaidOut"] } } });
  let feesIn = 0n, gasIn = 0n, paidOut = 0n; const byKind: Record<string, bigint> = {};
  for (const r of rows) {
    const d = JSON.parse(r.data);
    if (r.eventType === "ResourceIssued") { const fee = BigInt(d.fee ?? 0); feesIn += fee; byKind[String(d.kind)] = (byKind[String(d.kind)] ?? 0n) + fee; }
    else if (r.eventType === "GasFeesSwept") gasIn += BigInt(d.amountLamports ?? 0);
    else paidOut += BigInt(d.amount ?? 0);
  }
  return {
    address: deps.treasury, window: { days, since },
    inflows: { issuanceFeesResourceUnits: feesIn.toString(), issuanceFeesByKind: Object.fromEntries(Object.entries(byKind).map(([k, v]) => [k, v.toString()])), gasFeesLamports: gasIn.toString() },
    outflows: { vaultPayoutsLamports: paidOut.toString() },
    note: "On-chain balances are not read by the exporter (no RPC writes, RPC reads limited to slot lag); Watchtower should fetch treasury balances itself.",
  };
}

// ------------------------------------------------------------ security/alerts

export async function security(deps: ReadModelDeps, days: number) {
  const since = new Date(Date.now() - days * DAY);
  const [configEvents, adminActions, fraud] = await Promise.all([
    deps.db.chainEvent.findMany({ where: { blockTime: { gte: since }, eventType: { in: ["IssuanceCapChanged", "QuestConfigInitialized", "HotMarketEventStarted"] } }, orderBy: { slot: "desc" }, take: 200 }),
    deps.db.auditLog.findMany({ where: { timestamp: { gte: since }, user: { startsWith: "admin:" } }, orderBy: { timestamp: "desc" }, take: 200, select: { timestamp: true, user: true, action: true, result: true, txSig: true } }),
    deps.db.fraudCase.groupBy({ by: ["status", "signal", "severity"], _count: { _all: true } }),
  ]);
  return {
    configChanges: configEvents.flatMap((e) => normalizeChainEvent(e, deps.salt)).filter((w) => w.type === "ConfigUpdated"),
    adminActions: adminActions.map((a) => ({ at: a.timestamp, actor: a.user, action: a.action, result: a.result, txSig: a.txSig })),
    fraudCases: fraud.map((f) => ({ status: f.status, signal: f.signal, severity: f.severity, count: f._count._all })),
    multisig: { enabled: false, note: "authority is a single hot key today; AdminProposal* events unsupported until Squads is adopted" },
  };
}

export async function alerts(deps: ReadModelDeps, days: number) {
  const since = new Date(Date.now() - days * DAY);
  const cases = await deps.db.fraudCase.findMany({ where: { OR: [{ status: "open" }, { resolvedAt: { gte: since } }] }, orderBy: [{ severity: "desc" }, { lastSeen: "desc" }], take: 500 });
  return cases.map((c) => ({
    eventId: `fraud:${c.id}`, gameId: "aof", type: c.status === "confirmed" ? "PlayerQuarantined" : "FraudSignalCreated", category: "security",
    occurredAt: c.firstSeen.toISOString(), playerId: hashPlayer(c.wallet, deps.salt), confidence: "derived", severity: c.severity, score: c.score,
    signal: c.signal, status: c.status, hits: c.hits, lastSeen: c.lastSeen, resolvedAt: c.resolvedAt, resolvedBy: c.resolvedBy ? "admin" : null,
    note: c.status === "confirmed" ? "human-confirmed review case; no automatic enforcement is applied by AOF" : "open review case; no enforcement",
  }));
}

// ------------------------------------------------------------------- funnels

export async function funnels(deps: ReadModelDeps, days: number) {
  const since = new Date(Date.now() - days * DAY);
  const rows = await deps.db.chainEvent.findMany({ where: { blockTime: { gte: since }, success: true, wallet: { not: null } }, select: { wallet: true, eventType: true } });
  const per = new Map<string, Set<string>>();
  for (const r of rows) (per.get(r.wallet!) ?? per.set(r.wallet!, new Set()).get(r.wallet!)!).add(r.eventType);
  const step = (name: string, types: string[]) => ({ step: name, players: [...per.values()].filter((s) => types.some((t) => s.has(t))).length });
  return {
    window: { days, since },
    onboarding: [
      { step: "any_onchain_action", players: per.size },
      step("first_asset", ["ToolMinted", "PackOpened", "ToolCrafted"]),
      step("first_reward", ["MiningCollected", "ExplorationCompleted", "ResourceIssued"]),
      step("first_trade", ["ListingSold", "OfferAccepted", "AuctionSettled", "HotMarketBought", "OrderMatched"]),
      step("staked", ["Staked", "CollectorStaked"]),
    ],
    monetization: [
      step("purchased", ["PackOpened", "HotMarketBought", "SeasonPassPurchased", "LotteryTicketBought"]),
      step("repeat_purchase_proxy", ["SeasonPassPurchased"]),
    ],
  };
}
