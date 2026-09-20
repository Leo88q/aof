/**
 * Read-only view over the chain indexer ledger. All GET → ADMIN_READ_TOKEN
 * suffices. Raw wallets are exposed here because this is an operator surface;
 * any public/aggregate endpoint must use ChainEvent.walletHash instead.
 */
import { Router } from "express";
import { db } from "../lib/db";
import { adminByMethod } from "../middleware/adminAuth";

const r = Router();
r.use(adminByMethod);

function clampLimit(raw: unknown, dflt: number, max: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), max) : dflt;
}

function sinceFrom(raw: unknown, dfltHours: number): Date {
  const h = Number(raw);
  return new Date(Date.now() - (Number.isFinite(h) && h > 0 ? Math.min(h, 24 * 90) : dfltHours) * 3600_000);
}

const serialize = (row: any) => ({ ...row, slot: row.slot?.toString?.() ?? row.slot, newestSlot: row.newestSlot?.toString?.() ?? row.newestSlot });

/** GET /admin/chain/status — cursors + coverage per program. */
r.get("/status", async (_req, res) => {
  try {
    const [cursors, txCount, eventCount, oldest, newest] = await Promise.all([
      db.indexerCursor.findMany(),
      db.chainTx.count(),
      db.chainEvent.count(),
      db.chainTx.findFirst({ orderBy: { slot: "asc" }, select: { slot: true, blockTime: true } }),
      db.chainTx.findFirst({ orderBy: { slot: "desc" }, select: { slot: true, blockTime: true } }),
    ]);
    res.json({
      cursors: cursors.map(serialize),
      txCount, eventCount,
      window: { oldest: oldest ? serialize(oldest) : null, newest: newest ? serialize(newest) : null },
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/** GET /admin/chain/events?type=&wallet=&mint=&hours=&limit= */
r.get("/events", async (req, res) => {
  try {
    const where: any = { blockTime: { gte: sinceFrom(req.query.hours, 24) } };
    if (typeof req.query.type === "string") where.eventType = req.query.type;
    if (typeof req.query.wallet === "string") where.wallet = req.query.wallet;
    if (typeof req.query.mint === "string") where.mint = req.query.mint;
    if (typeof req.query.program === "string") where.programId = req.query.program;
    const rows = await db.chainEvent.findMany({ where, orderBy: [{ slot: "desc" }, { eventIndex: "asc" }], take: clampLimit(req.query.limit, 100, 1000) });
    res.json(rows.map((e) => ({ ...serialize(e), data: JSON.parse(e.data) })));
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/** GET /admin/chain/events/summary?hours= — counts per eventType, distinct wallets. */
r.get("/events/summary", async (req, res) => {
  try {
    const since = sinceFrom(req.query.hours, 24);
    const rows = await db.chainEvent.groupBy({ by: ["eventType", "programId"], where: { blockTime: { gte: since } }, _count: { _all: true } });
    const wallets = await db.chainEvent.findMany({ where: { blockTime: { gte: since }, wallet: { not: null } }, distinct: ["wallet"], select: { wallet: true } });
    const txs = await db.chainTx.groupBy({ by: ["success"], where: { blockTime: { gte: since } }, _count: { _all: true } });
    res.json({
      since,
      byType: rows.map((x) => ({ programId: x.programId, eventType: x.eventType, count: x._count._all })).sort((a, b) => b.count - a.count),
      activeWallets: wallets.length,
      txs: { ok: txs.find((t) => t.success)?._count._all ?? 0, failed: txs.find((t) => !t.success)?._count._all ?? 0 },
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/** GET /admin/chain/supply?mint=&hours= — minted/burned totals + daily buckets. */
r.get("/supply", async (req, res) => {
  try {
    if (typeof req.query.mint !== "string") return res.status(400).json({ error: "mint required" });
    const since = sinceFrom(req.query.hours, 24 * 7);
    const rows = await db.chainMintDelta.findMany({ where: { mint: req.query.mint, blockTime: { gte: since } }, select: { delta: true, blockTime: true }, orderBy: { blockTime: "asc" } });
    let minted = 0n, burned = 0n;
    const daily = new Map<string, { minted: bigint; burned: bigint }>();
    for (const row of rows) {
      const d = BigInt(row.delta);
      const day = (row.blockTime ?? new Date(0)).toISOString().slice(0, 10);
      const b = daily.get(day) ?? { minted: 0n, burned: 0n };
      if (d > 0n) { minted += d; b.minted += d; } else { burned += -d; b.burned += -d; }
      daily.set(day, b);
    }
    res.json({
      mint: req.query.mint, since, minted: minted.toString(), burned: burned.toString(), net: (minted - burned).toString(),
      daily: [...daily].map(([day, v]) => ({ day, minted: v.minted.toString(), burned: v.burned.toString() })),
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/** GET /admin/chain/wallet/:wallet?hours= — activity profile for anti-fraud review. */
r.get("/wallet/:wallet", async (req, res) => {
  try {
    const wallet = req.params.wallet;
    const since = sinceFrom(req.query.hours, 24 * 30);
    const [first, byType, asPayer] = await Promise.all([
      db.chainEvent.findFirst({ where: { wallet }, orderBy: { slot: "asc" }, select: { blockTime: true, slot: true, signature: true } }),
      db.chainEvent.groupBy({ by: ["eventType"], where: { wallet, blockTime: { gte: since } }, _count: { _all: true } }),
      db.chainTx.groupBy({ by: ["success"], where: { feePayer: wallet, blockTime: { gte: since } }, _count: { _all: true } }),
    ]);
    res.json({
      wallet, since,
      firstSeen: first ? serialize(first) : null,
      byType: byType.map((x) => ({ eventType: x.eventType, count: x._count._all })),
      txsAsPayer: { ok: asPayer.find((t) => t.success)?._count._all ?? 0, failed: asPayer.find((t) => !t.success)?._count._all ?? 0 },
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
