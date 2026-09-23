/**
 * Liveness / readiness / finalized-lag for the exporter.
 * Readiness = DB reachable + indexer cursor fresh + (if RPC configured) lag known.
 */
import type { PrismaClient } from "@prisma/client";
import type { Connection } from "@solana/web3.js";
import { lagGauge } from "./metrics";

const STALE_CURSOR_MS = Number(process.env.WATCHTOWER_STALE_CURSOR_MS ?? 10 * 60_000);
const LAG_CACHE_MS = 5_000;

export function startHealth(o: { db: PrismaClient; rpc: Connection | null; rpcFallback: Connection | null; providerMode: string }) {
  const startedAt = Date.now();
  let cached: { at: number; value: FinalizedLag } | null = null;

  async function finalizedSlot(): Promise<{ slot: bigint; via: "primary" | "fallback" } | null> {
    for (const [conn, via] of [[o.rpc, "primary"], [o.rpcFallback, "fallback"]] as const) {
      if (!conn) continue;
      try { return { slot: BigInt(await conn.getSlot("finalized")), via }; } catch { /* try next */ }
    }
    return null;
  }

  async function finalizedLag(): Promise<FinalizedLag> {
    if (cached && Date.now() - cached.at < LAG_CACHE_MS) return cached.value;
    const cursors = await o.db.indexerCursor.findMany({ select: { programId: true, newestSlot: true, updatedAt: true } });
    const indexedSlot = (cursors as any[]).reduce((m: bigint | null, c: any) => (c.newestSlot !== null && (m === null || c.newestSlot < m) ? c.newestSlot : m), null);
    const oldestUpdate = (cursors as any[]).reduce((m: Date | null, c: any) => (m === null || c.updatedAt < m ? c.updatedAt : m), null);
    const head = await finalizedSlot();
    const value: FinalizedLag = {
      commitment: "finalized",
      indexedSlot: indexedSlot?.toString() ?? null,
      chainFinalizedSlot: head?.slot.toString() ?? null,
      lagSlots: head && indexedSlot !== null ? (head.slot - indexedSlot).toString() : null,
      lagSeconds: head && indexedSlot !== null ? Number(head.slot - indexedSlot) * 0.4 : null,
      rpc: head?.via ?? (o.rpc ? "unreachable" : "not_configured"),
      cursorAgeMs: oldestUpdate ? Date.now() - oldestUpdate.getTime() : null,
      cursorStale: oldestUpdate ? Date.now() - oldestUpdate.getTime() > STALE_CURSOR_MS : true,
    };
    if (value.lagSlots !== null) lagGauge.set(Number(value.lagSlots));
    cached = { at: Date.now(), value };
    return value;
  }

  return {
    finalizedLag,
    liveness: () => ({ status: "ok", service: "aof-watchtower-exporter", uptimeSec: Math.floor((Date.now() - startedAt) / 1000), writes: false, signerCapability: false }),
    readiness: async () => {
      const checks: Record<string, { ok: boolean; detail?: unknown }> = {};
      try { await o.db.$queryRaw`SELECT 1`; checks.database = { ok: true }; } catch (e: any) { checks.database = { ok: false, detail: e.message }; }
      let lag: FinalizedLag | null = null;
      try { lag = await finalizedLag(); } catch (e: any) { checks.indexer = { ok: false, detail: e.message }; }
      if (lag) {
        checks.indexer = { ok: lag.indexedSlot !== null && !lag.cursorStale, detail: { indexedSlot: lag.indexedSlot, cursorAgeMs: lag.cursorAgeMs, providerMode: o.providerMode } };
        checks.rpc = { ok: !o.rpc || lag.rpc !== "unreachable", detail: lag.rpc };
      }
      // Liveness remains available in mock mode; readiness must not certify it.
      const ready = checks.database?.ok === true && o.providerMode === "indexer" && checks.indexer?.ok === true && checks.rpc?.ok !== false;
      return { ready, writes: false, signerCapability: false, providerMode: o.providerMode, checks, finalizedLag: lag };
    },
  };
}

export type FinalizedLag = {
  commitment: "finalized"; indexedSlot: string | null; chainFinalizedSlot: string | null; lagSlots: string | null; lagSeconds: number | null;
  rpc: "primary" | "fallback" | "unreachable" | "not_configured"; cursorAgeMs: number | null; cursorStale: boolean;
};
