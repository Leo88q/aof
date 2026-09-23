/**
 * AOF Watchtower exporter — read-only HTTP service.
 *
 * Boundaries (enforced, not just documented):
 *  - no signer: the process never loads AUTHORITY_SECRET_KEY; if that env var
 *    is present it is deleted from process.env before anything else imports;
 *  - no writes: WATCHTOWER_ENABLE_WRITES is read only to refuse to start when
 *    it is "true" (there is no write code path to enable);
 *  - RPC is used for one thing: getSlot("finalized") to compute finalized lag;
 *  - every player identifier is sha256(WATCHTOWER_PLAYER_HASH_SALT|wallet).
 *
 * Endpoints: see ../README.md. Auth: `Authorization: Bearer <WATCHTOWER_EXPORTER_TOKEN>`
 * on everything except /watchtower/health.
 */
delete process.env.AUTHORITY_SECRET_KEY; // hard guarantee before any import can read it

import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { timingSafeEqual } from "node:crypto";
import { Connection } from "@solana/web3.js";
import { PrismaClient } from "@prisma/client";
import client from "prom-client";
import { PARSER_VERSION, SUPPORTED_DERIVED, SUPPORTED_NATIVE, UNSUPPORTED } from "./event-normalizer";
import * as rm from "./read-model";
import { startHealth } from "./health";
import { initTelemetry, recordRequest } from "./metrics";
import { validateEvents } from "./event-decoder";
import { watchtowerRoot } from "./paths";
import { domainQuality, liveQuality } from "./data-quality";

const env = (k: string, d?: string) => process.env[k] ?? d;
if (env("WATCHTOWER_ENABLE_WRITES", "false") === "true") {
  throw new Error("WATCHTOWER_ENABLE_WRITES=true is not supported: this exporter has no write path and refuses to pretend otherwise");
}
const PORT = Number(env("WATCHTOWER_EXPORTER_PORT", "8790"));
const TOKEN = env("WATCHTOWER_EXPORTER_TOKEN", "") as string;
const CLUSTER = env("WATCHTOWER_CLUSTER", "devnet") as string;
const RPC_URL: string | undefined = env("WATCHTOWER_RPC_URL") ?? env("RPC_URL");
const RPC_FALLBACK = env("WATCHTOWER_RPC_FALLBACK_URL");
const SALT = env("WATCHTOWER_PLAYER_HASH_SALT", "") as string;
const PROVIDER = env("WATCHTOWER_EVENT_PROVIDER", "mock") as string; // mock | indexer
if (env("WATCHTOWER_DATABASE_URL")) process.env.DATABASE_URL = env("WATCHTOWER_DATABASE_URL") as string;
if (!TOKEN && process.env.NODE_ENV === "production") throw new Error("WATCHTOWER_EXPORTER_TOKEN is required in production");
if (!SALT && process.env.NODE_ENV === "production") throw new Error("WATCHTOWER_PLAYER_HASH_SALT is required in production");

const manifest = JSON.parse(readFileSync(join(watchtowerRoot(), "integration-manifest.json"), "utf8"));
const eventTypes = JSON.parse(readFileSync(join(watchtowerRoot(), "events", "event-types.json"), "utf8"));
const db = new PrismaClient();
const deps: rm.ReadModelDeps = { db, salt: SALT, treasury: env("TREASURY_PUBKEY") ?? manifest.treasuryAddresses[0] ?? null, programIds: manifest.programIds };
const rpc = RPC_URL ? new Connection(RPC_URL, "finalized") : null;
const rpcFallback = RPC_FALLBACK ? new Connection(RPC_FALLBACK, "finalized") : null;
const telemetry = initTelemetry("aof-watchtower-exporter");
const health = startHealth({ db, rpc, rpcFallback, providerMode: PROVIDER });

// ------------------------------------------------------------------- helpers

type Handler = (url: URL, req: IncomingMessage) => Promise<unknown>;
const json = (res: ServerResponse, code: number, body: unknown) => {
  res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body, (_k, v) => (typeof v === "bigint" ? v.toString() : v)));
};
const num = (v: string | null, d: number, max: number) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.min(n, max) : d; };
function authorized(req: IncomingMessage): boolean {
  if (!TOKEN) return process.env.NODE_ENV !== "production"; // dev convenience only
  const h = req.headers.authorization ?? "";
  const given = h.startsWith("Bearer ") ? h.slice(7) : "";
  const a = Buffer.from(given), b = Buffer.from(TOKEN);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function envelope(payload: unknown, extra: { dataQuality: rm.DataQuality; confidence?: string; window?: unknown }) {
  const lag = await health.finalizedLag();
  return {
    gameId: manifest.gameId, network: CLUSTER, parserVersion: PARSER_VERSION, generatedAt: new Date().toISOString(),
    writes: false, commitment: "finalized", finalizedLag: lag, dataQuality: liveQuality(extra.dataQuality, PROVIDER),
    dataQualityByDomain: domainQuality(extra.dataQuality, PROVIDER, !!SALT), confidence: extra.confidence ?? "finalized",
    window: extra.window ?? null, data: payload,
  };
}

// ------------------------------------------------------------------- routes

const routes: Partial<Record<string, Handler>> = {
  "/watchtower/health": async () => health.liveness(),
  "/watchtower/readyz": async () => health.readiness(),
  "/watchtower/config": async () => {
    const cov = await rm.coverage(deps);
    return {
      ...manifest,
      network: CLUSTER, parserVersion: PARSER_VERSION, dataQuality: liveQuality(cov.quality, PROVIDER), dataQualityByDomain: domainQuality(cov.quality, PROVIDER, !!SALT), writes: false, signerCapability: false,
      eventProvider: PROVIDER, playerIdScheme: "sha256(WATCHTOWER_PLAYER_HASH_SALT|wallet)", saltConfigured: !!SALT,
      coverage: cov, eventTypes: { supportedNative: Object.keys(SUPPORTED_NATIVE), supportedDerived: SUPPORTED_DERIVED, unsupported: UNSUPPORTED, catalog: eventTypes.version },
      lastVerifiedAt: manifest.lastVerifiedAt,
    };
  },
  "/watchtower/events": async (url) => {
    const after = rm.decodeCursor(url.searchParams.get("cursor") ?? undefined);
    const sinceSlot = url.searchParams.get("sinceSlot");
    const types = url.searchParams.get("types")?.split(",").filter(Boolean);
    const page = await rm.events(deps, { after, sinceSlot: sinceSlot ? BigInt(sinceSlot) : undefined, limit: num(url.searchParams.get("limit"), 200, 500), types, includeTx: url.searchParams.get("includeTx") !== "false" });
    const invalid = validateEvents(page.events);
    if (invalid.length) throw Object.assign(new Error("normalizer produced events violating events/schema.json"), { status: 500, details: invalid.slice(0, 5) });
    const cov = await rm.coverage(deps);
    return envelope(page, { dataQuality: cov.quality });
  },
  "/watchtower/metrics/daily": async (url) => {
    const days = num(url.searchParams.get("days"), 30, 365);
    const cov = await rm.coverage(deps);
    const since = new Date(Date.now() - days * 86_400_000);
    return envelope(await rm.dailyMetrics(deps, days), { dataQuality: rm.windowQuality(cov, since), window: { days, since } });
  },
  "/watchtower/players/cohorts": async (url) => {
    const weeks = num(url.searchParams.get("weeks"), 12, 104);
    const cov = await rm.coverage(deps);
    return envelope(await rm.cohorts(deps, weeks), { dataQuality: cov.quality, confidence: "derived", window: { weeks } });
  },
  "/watchtower/players/retention": async () => {
    const cov = await rm.coverage(deps);
    return envelope(await rm.retention(deps), { dataQuality: cov.quality, confidence: "derived" });
  },
  "/watchtower/players/cross-game": async (url) => {
    const cov = await rm.coverage(deps);
    return envelope(await rm.crossGame(deps, num(url.searchParams.get("limit"), 1000, 10_000)), { dataQuality: SALT ? (cov.quality) : "unavailable", confidence: "derived" });
  },
  "/watchtower/economy": async (url) => {
    const days = num(url.searchParams.get("days"), 30, 365);
    const cov = await rm.coverage(deps);
    const since = new Date(Date.now() - days * 86_400_000);
    return envelope(await rm.economy(deps, days), { dataQuality: rm.windowQuality(cov, since), window: { days, since } });
  },
  "/watchtower/treasury": async (url) => {
    const days = num(url.searchParams.get("days"), 30, 365);
    const cov = await rm.coverage(deps);
    const since = new Date(Date.now() - days * 86_400_000);
    return envelope(await rm.treasury(deps, days), { dataQuality: rm.windowQuality(cov, since), window: { days, since } });
  },
  "/watchtower/security": async (url) => {
    const days = num(url.searchParams.get("days"), 30, 365);
    const cov = await rm.coverage(deps);
    return envelope(await rm.security(deps, days), { dataQuality: cov.quality, window: { days } });
  },
  "/watchtower/alerts": async (url) => {
    const days = num(url.searchParams.get("days"), 30, 365);
    const cov = await rm.coverage(deps);
    return envelope(await rm.alerts(deps, days), { dataQuality: cov.quality, confidence: "derived", window: { days } });
  },
  "/watchtower/funnels": async (url) => {
    const days = num(url.searchParams.get("days"), 30, 365);
    const cov = await rm.coverage(deps);
    const since = new Date(Date.now() - days * 86_400_000);
    return envelope(await rm.funnels(deps, days), { dataQuality: rm.windowQuality(cov, since), confidence: "derived", window: { days, since } });
  },
  "/watchtower/metrics": async () => ({ __raw: await client.register.metrics(), contentType: client.register.contentType }),
};

const server = createServer(async (req, res) => {
  const started = Date.now();
  const url = new URL(req.url ?? "/", "http://localhost");
  const route = routes[url.pathname];
  try {
    if (req.method !== "GET" && req.method !== "HEAD") return json(res, 405, { error: "read-only exporter: GET only" });
    if (!route) return json(res, 404, { error: "not found" });
    if (url.pathname !== "/watchtower/health" && !authorized(req)) return json(res, 401, { error: "unauthorized" });
    const body: any = await route(url, req);
    if (body && body.__raw !== undefined) { res.writeHead(200, { "content-type": body.contentType }); return res.end(body.__raw); }
    json(res, url.pathname === "/watchtower/readyz" && !body.ready ? 503 : 200, body);
  } catch (e: any) {
    telemetry.captureException(e);
    json(res, e.status ?? (String(e.message).includes("cursor") ? 400 : 500), { error: e.message, details: e.details });
  } finally {
    recordRequest(route ? url.pathname : "unmatched", res.statusCode, Date.now() - started);
  }
});

server.listen(PORT, "0.0.0.0", () => console.log(`[watchtower-exporter] aof read-only exporter on :${PORT} (cluster=${CLUSTER}, provider=${PROVIDER}, parser=${PARSER_VERSION})`));

for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, async () => { server.close(); await db.$disconnect(); await telemetry.shutdown(); process.exit(0); });
