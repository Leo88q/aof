import { startCronJobs } from "./lib/cron";
import express from "express";
import pinoHttp from "pino-http";
import { logger } from "./lib/logger";
import { generalLimiter, txLimiter, readLimiter } from "./middleware/rateLimit";
import { errorHandler } from "./middleware/errorHandler";
import cors from "cors";
import { PORT, TRUST_PROXY_HOPS } from "./config";
import { connection } from "./provider";
import admin from "./routes/admin";
import gastank from "./routes/gastank";
import resources from "./routes/resources";
import tools from "./routes/tools";
import collectors from "./routes/collectors";
import packs from "./routes/packs";
import reroll from "./routes/reroll";
import exploration from "./routes/exploration";
import referral from "./routes/referral";
import forge from "./routes/forge";
import lottery from "./routes/lottery";
import marketplace from "./routes/marketplace";
import auction from "./routes/auction";
import offer from "./routes/offer";
import rental from "./routes/rental";
import orderbook from "./routes/orderbook";
import craftOrder from "./routes/craftOrder";
import season from "./routes/season";
import query from "./routes/query";
import security from "./routes/security";
import hotMarket from "./routes/hotMarket";
import session from "./routes/session";
import quests from "./routes/quests";
import challenges from "./routes/challenges";
import drum from "./routes/drum";
import rebirth from "./routes/rebirth";
import liquidity from "./routes/liquidity";
import trust from "./routes/trust";
import farm from "./routes/farm";
import energy from "./routes/energy";
import neighbors from "./routes/neighbors";
import weather from "./routes/weather";
import streaks from "./routes/streaks";
import inbox from "./routes/inbox";
import compendium from "./routes/compendium";
import profile from "./routes/profile";
import lore from "./routes/lore";
import onboarding from "./routes/onboarding";
import guild from "./routes/guild";
import alerts from "./routes/alerts";
import portfolio from "./routes/portfolio";
import daily from "./routes/daily";
import npc from "./routes/npc";
import sandbox from "./routes/sandbox";
import whaleAlerts from "./routes/whaleAlerts";
import referralTiers from "./routes/referralTiers";
import marketData from "./routes/marketData";
import comeback from "./routes/comeback";
import traderRules from "./routes/traderRules";
import vipStatus from "./routes/vipStatus";
import guildWars from "./routes/guildWars";
import seasonalCompendium from "./routes/seasonalCompendium";
import leaderboard from "./routes/leaderboard";
import antifraud from "./routes/antifraud";
import apiKeys from "./routes/apiKeys";
import publicApi from "./routes/public";
import notifications from "./routes/notifications";
import privileges from "./routes/privileges";
import friend from "./routes/friend";
import chain from "./routes/chain";
import adminAudit from "./routes/admin-audit";
import adminEconomy from "./routes/admin-economy";
import adminChain from "./routes/admin-chain";
import rating from "./routes/rating";
import { sentinelAutoAudit } from "./middleware/audit";
import { adminByMethod } from "./middleware/adminAuth";
import { startCommitRevealer } from "./lib/commitRevealer";
import { requireMappedWalletProof } from "./security/walletProof";

const app = express();
// Must be set before any middleware reads req.ip (rate limiter, audit log).
// A fixed hop count, never `true`: trusting every X-Forwarded-For would let
// clients spoof their IP and bypass per-IP limits.
app.set("trust proxy", TRUST_PROXY_HOPS);
const configuredOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
if (process.env.NODE_ENV === "production" && configuredOrigins.length === 0) {
  throw new Error("CORS_ORIGIN is required in production");
}
app.use(cors({
  origin: configuredOrigins.length > 0 ? configuredOrigins : true,
  credentials: true,
}));
app.disable("x-powered-by");
// Rate-limit before signature verification / durable nonce writes, not after.
app.use(generalLimiter);
app.use(express.json({ limit: "32kb" }));
// Every mapped business mutation must carry a fresh wallet signature before
// reaching a router. Admin routes and route-specific guards remain explicit.
app.use(requireMappedWalletProof());
app.use(sentinelAutoAudit());
app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === "/health" } }));
app.use("/admin", txLimiter);
// Read-heavy public endpoints proxy RPC / DB scans; they get the read limiter
// on top of the general one so a single client cannot saturate the RPC quota.
app.use("/query", readLimiter);
app.use("/whale-alerts", readLimiter);
app.use("/market-data", readLimiter);
app.use("/public", readLimiter);
app.use("/hot-market", txLimiter);
app.use("/orderbook", txLimiter);
app.use("/marketplace", txLimiter);
app.use("/auction", txLimiter);
app.use("/offer", txLimiter);
app.use("/rental", txLimiter);
app.use("/tools", txLimiter);
app.use("/packs", txLimiter);
app.use("/craft-order", txLimiter);
app.use("/season", txLimiter);
app.use("/forge", txLimiter);
app.use("/lottery", txLimiter);
app.use("/reroll", txLimiter);
app.use("/exploration", txLimiter);
app.use("/admin", admin);
app.use("/admin/audit", adminAudit);
app.use("/admin/economy", adminEconomy);
app.use("/admin/chain", adminChain);
app.use("/rating", rating);
app.use("/gastank", gastank);
app.use("/resources", resources);
app.use("/tools", tools);
app.use("/collectors", collectors);
app.use("/packs", packs);
app.use("/reroll", reroll);
app.use("/exploration", exploration);
app.use("/referral", referral);
app.use("/forge", forge);
app.use("/lottery", lottery);
app.use("/marketplace", marketplace);
app.use("/auction", auction);
app.use("/offer", offer);
app.use("/rental", rental);
app.use("/orderbook", orderbook);
app.use("/craft-order", craftOrder);
app.use("/season", season);
app.use("/query", query);
app.use("/security", adminByMethod, security);
app.use("/hot-market", hotMarket);
app.use("/session", session);
app.use("/quests", quests);
app.use("/challenges", challenges);
app.use("/drum", drum);
app.use("/rebirth", rebirth);
app.use("/liquidity", liquidity);
app.use("/trust", trust);
app.use("/farm", farm);
app.use("/energy", energy);
app.use("/neighbors", neighbors);
app.use("/weather", weather);
app.use("/streaks", streaks);
app.use("/inbox", inbox);
app.use("/compendium", compendium);
app.use("/profile", profile);
app.use("/lore", lore);
app.use("/onboarding", onboarding);
app.use("/guild", guild);
app.use("/alerts", alerts);
app.use("/portfolio", portfolio);
app.use("/daily", daily);
app.use("/npc", npc);
app.use("/sandbox", sandbox);
app.use("/whale-alerts", whaleAlerts);
app.use("/referral-tiers", referralTiers);
app.use("/market-data", marketData);
app.use("/comeback", comeback);
app.use("/trader-rules", traderRules);
app.use("/season", vipStatus);
app.use("/guild-wars", guildWars);
app.use("/seasonal-compendium", seasonalCompendium);
app.use("/leaderboard", leaderboard);
app.use("/antifraud", antifraud);
app.use("/api-keys", apiKeys);
app.use("/public", publicApi);
app.use("/friend", friend);
app.use("/chain", chain);
app.use("/notifications", notifications);
app.use("/privileges", txLimiter);
app.use("/privileges", privileges);
app.use(errorHandler);
// Liveness: process is up. Never touches DB/RPC so a dependency outage does
// not make the orchestrator restart-loop the API.
app.get("/health", (_req, res) => res.json({ ok: true }));
// Readiness: can this instance serve real traffic right now? Checks the DB
// and the RPC with short timeouts; 503 on any failure so a load balancer
// drains the instance instead of routing users into errors.
app.get("/ready", async (_req, res) => {
  const withTimeout = <T,>(p: Promise<T>, ms: number) =>
    Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
  const checks: Record<string, { ok: boolean; ms: number; error?: string }> = {};
  const run = async (name: string, fn: () => Promise<unknown>) => {
    const t = Date.now();
    try { await withTimeout(fn(), 3000); checks[name] = { ok: true, ms: Date.now() - t }; }
    catch (e: any) { checks[name] = { ok: false, ms: Date.now() - t, error: String(e?.message || e) }; }
  };
  await Promise.all([
    run("db", async () => { const { db } = await import("./lib/db"); await db.$queryRaw`SELECT 1`; }),
    run("rpc", () => connection.getSlot("processed")),
  ]);
  const ok = Object.values(checks).every((c) => c.ok);
  res.status(ok ? 200 : 503).json({ ok, checks });
});
// Validate the actual cluster before any signing worker can start. URL names
// are not proof of network identity (a custom RPC can point at any cluster).
async function start(): Promise<void> {
  const expected = process.env.EXPECTED_GENESIS_HASH;
  if (expected && await connection.getGenesisHash() !== expected) {
    throw new Error("RPC genesis hash does not match EXPECTED_GENESIS_HASH");
  }
  startCronJobs();
  startCommitRevealer(60_000);
  app.listen(PORT, "0.0.0.0", () => logger.info({ port: PORT }, "aof-backend started"));
}
start().catch((error) => { logger.fatal({ err: error }, "Startup verification failed"); process.exitCode = 1; });
