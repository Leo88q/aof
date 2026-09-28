#!/usr/bin/env node
/**
 * nf-load — zero-dependency HTTP load generator for the NeuroForge backend.
 *
 *   node scripts/loadtest/nf-load.mjs --scenario farm --vus 100 --duration 60
 *
 * Why a custom tool instead of k6/autocannon: nothing to install (Node >= 18
 * only), the scenarios mirror the real client's polling profile
 * (frontend/src/pages/farm/*Panel.tsx), and every virtual user can present
 * its own X-Forwarded-For so the per-IP throttle sees N players instead of
 * one hammering IP. Start the backend with TRUST_PROXY_HOPS=1 for that
 * (docs/LOAD_TESTING.md); with TRUST_PROXY_HOPS=0 all VUs share one IP and you
 * are measuring src/middleware/rateLimit.ts, not the server.
 *
 * Scenarios
 *   health     GET /health only — Node/Express ceiling, no DB, no RPC.
 *   db         Prisma-only endpoints (inbox, streaks, quests, price, profile).
 *   chain      /query/* — every request is a Solana RPC call (getAccountInfo /
 *              getProgramAccounts). This is normally the real bottleneck.
 *   farm       "N players on the farm tab": each VU follows the client's timers
 *              (mill 5 s, tiles 10 s, energy+weather 15 s, balances 30 s, ...).
 *              Open-loop; reports latency at that player count.
 *   mixed      closed loop over db + chain.
 *   ratelimit  single IP as fast as possible: finds the request index of the
 *              first 429 and prints the RateLimit-* headers.
 *
 * Modes
 *   closed   each VU sends the next request as soon as the previous finished
 *            (maximum throughput; default for every scenario except farm).
 *   players  each VU replays the polling profile (default for farm).
 *
 * Output: per-endpoint table (count, errors, p50/p95/p99), status histogram,
 * a PASS/FAIL verdict against --p95-target / --max-error-rate, and a capacity
 * estimate (closed loop RPS ÷ requests per player per second of the farm
 * profile). Optional --json / --md reports.
 */
import http from "node:http";
import https from "node:https";
import { randomBytes } from "node:crypto";
import { writeFileSync, appendFileSync } from "node:fs";

// ---------------------------------------------------------------- args ----
const args = parseArgs(process.argv.slice(2));
if (args.help || args.h) {
  console.log(usage());
  process.exit(0);
}
const BASE = String(args.url || process.env.NF_LOAD_URL || "http://localhost:8080").replace(/\/+$/, "");
const SCENARIO = String(args.scenario || "mixed");
const VUS = int(args.vus, 20);
const DURATION_S = int(args.duration, 20);
const WALLETS = int(args.wallets, VUS);
const IP_MODE = String(args.ip || "per-vu"); // per-vu | single
const TIMEOUT_MS = int(args.timeout, 10_000);
const P95_TARGET = int(args["p95-target"], 500);
const MAX_ERR = Number(args["max-error-rate"] ?? 1); // percent
const MODE = String(args.mode || (SCENARIO === "farm" ? "players" : "closed"));
const STRICT = Boolean(args.strict);

// ------------------------------------------------------------ profiles ----
const wallets = Array.from({ length: Math.max(1, WALLETS) }, () => base58(randomBytes(32)));
const w = (i) => wallets[i % wallets.length];

/** Client polling profile of one player sitting on the farm tab (ms). */
const FARM_PROFILE = [
  { name: "mill-state", every: 5_000, path: (i) => `/query/mill-state/${w(i)}` },      // MillPanel: 5 s
  { name: "farm-tiles", every: 10_000, path: (i) => `/query/farm-tiles/${w(i)}` },     // PlantingPanel: 10 s
  { name: "energy", every: 15_000, path: (i) => `/energy/balance/${w(i)}` },           // header widget
  { name: "weather", every: 15_000, path: () => `/weather/current` },                  // WellPanel: 15 s
  { name: "balances", every: 30_000, path: (i) => `/query/balances/${w(i)}` },
  { name: "player", every: 30_000, path: (i) => `/query/player/${w(i)}` },
  { name: "inbox", every: 30_000, path: (i) => `/inbox/${w(i)}` },
  { name: "quests-daily", every: 60_000, path: (i) => `/quests/daily/${w(i)}` },
  { name: "vip-status", every: 60_000, path: (i) => `/season/vip-status/${w(i)}` },
];
const RPS_PER_PLAYER = FARM_PROFILE.reduce((s, e) => s + 1000 / e.every, 0);

const SCENARIOS = {
  health: [{ name: "health", path: () => "/health" }],
  db: [
    { name: "inbox", path: (i) => `/inbox/${w(i)}` },
    { name: "streaks", path: (i) => `/streaks/${w(i)}` },
    { name: "quests-daily", path: (i) => `/quests/daily/${w(i)}` },
    { name: "price", path: (i) => `/market-data/price/${(i % 5) + 1}` },
    { name: "username", path: (i) => `/profile/username/${w(i)}` },
  ],
  chain: [
    { name: "config", path: () => "/query/config" },
    { name: "weather-state", path: () => "/query/weather-state" },
    { name: "player", path: (i) => `/query/player/${w(i)}` },
    { name: "mill-state", path: (i) => `/query/mill-state/${w(i)}` },
    { name: "balances", path: (i) => `/query/balances/${w(i)}` },
    { name: "farm-tiles", path: (i) => `/query/farm-tiles/${w(i)}` },
    { name: "my-tools(gPA)", path: (i) => `/query/my-tools/${w(i)}` }, // getProgramAccounts scan
  ],
  farm: FARM_PROFILE,
  ratelimit: [{ name: "weather", path: () => "/weather/current" }],
};
SCENARIOS.mixed = [...SCENARIOS.db, ...SCENARIOS.chain];
const endpoints = SCENARIOS[SCENARIO];
if (!endpoints) {
  console.error(`unknown scenario "${SCENARIO}". Known: ${Object.keys(SCENARIOS).join(", ")}`);
  process.exit(2);
}

// --------------------------------------------------------------- http -----
const base = new URL(BASE);
const isTls = base.protocol === "https:";
const agent = new (isTls ? https.Agent : http.Agent)({ keepAlive: true, maxSockets: Math.max(VUS, 8) });
const client = isTls ? https : http;

function vuIp(vu) {
  // 10.x.y.z, deterministic per VU. Honoured only when the backend trusts one proxy hop.
  return `10.${(vu >> 16) & 255}.${(vu >> 8) & 255}.${(vu & 254) + 1}`;
}

function request(path, vu) {
  return new Promise((resolve) => {
    const started = process.hrtime.bigint();
    const headers = { accept: "application/json", "user-agent": "nf-load/1.0" };
    if (IP_MODE === "per-vu") headers["x-forwarded-for"] = vuIp(vu);
    const req = client.request(
      base.origin + path,
      { method: "GET", agent, headers, timeout: TIMEOUT_MS },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const ms = Number(process.hrtime.bigint() - started) / 1e6;
          resolve({ status: res.statusCode || 0, ms, headers: res.headers, bytes: Buffer.concat(chunks).length });
        });
      },
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", (e) => {
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      resolve({ status: 0, ms, error: e.code || e.message });
    });
    req.end();
  });
}

// ------------------------------------------------------------ metrics -----
const stats = new Map(); // name -> { lat: number[], status: Map, errors, bytes }
const statusTotal = new Map();
let firstRateLimited = null; // { index, headers }
let sent = 0;
function record(name, r) {
  let s = stats.get(name);
  if (!s) stats.set(name, (s = { lat: [], status: new Map(), errors: 0, bytes: 0 }));
  s.lat.push(r.ms);
  s.bytes += r.bytes || 0;
  const key = r.status === 0 ? `ERR:${r.error}` : String(r.status);
  s.status.set(key, (s.status.get(key) || 0) + 1);
  statusTotal.set(key, (statusTotal.get(key) || 0) + 1);
  if (r.status === 0 || r.status >= 500 || r.status === 429) s.errors++;
  if (r.status === 429 && !firstRateLimited) {
    firstRateLimited = { index: sent, headers: pick(r.headers, ["ratelimit-limit", "ratelimit-remaining", "ratelimit-reset", "retry-after"]) };
  }
}
function pct(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

// --------------------------------------------------------------- run ------
const deadline = Date.now() + DURATION_S * 1000;
const t0 = Date.now();
console.log(`nf-load  →  ${BASE}`);
console.log(`scenario=${SCENARIO} mode=${MODE} vus=${VUS} duration=${DURATION_S}s wallets=${wallets.length} ip=${IP_MODE}`);
if (MODE === "players") console.log(`profile: ${FARM_PROFILE.length} timers, ${RPS_PER_PLAYER.toFixed(3)} req/s per player`);
console.log("");

const progress = setInterval(() => {
  const el = (Date.now() - t0) / 1000;
  process.stdout.write(`  ${el.toFixed(0).padStart(3)}s  sent=${sent}  rps=${(sent / el).toFixed(1)}  429=${statusTotal.get("429") || 0}  5xx=${count5xx()}  err=${countErr()}\r`);
}, 1000);

async function closedLoopVU(vu) {
  let i = vu;
  while (Date.now() < deadline) {
    const ep = endpoints[i % endpoints.length];
    sent++;
    record(ep.name, await request(ep.path(i), vu));
    i += VUS;
    if (SCENARIO === "ratelimit" && firstRateLimited && sent - firstRateLimited.index > 50) break;
  }
}

async function playerVU(vu) {
  // Stagger start so timers of N players do not align.
  await sleep(Math.random() * 5_000);
  const next = endpoints.map((e) => Date.now() + Math.random() * e.every);
  while (Date.now() < deadline) {
    const now = Date.now();
    const due = [];
    endpoints.forEach((e, k) => {
      if (now >= next[k]) {
        due.push(e);
        next[k] = now + e.every;
      }
    });
    if (due.length) {
      sent += due.length;
      const results = await Promise.all(due.map((e) => request(e.path(vu), vu)));
      results.forEach((r, k) => record(due[k].name, r));
    }
    const wait = Math.max(50, Math.min(...next) - Date.now());
    await sleep(wait);
  }
}

const vus = Array.from({ length: MODE === "players" ? VUS : Math.min(VUS, 2000) }, (_, k) => k + 1);
await Promise.all(vus.map((vu) => (MODE === "players" ? playerVU(vu) : closedLoopVU(vu))));
clearInterval(progress);
agent.destroy();
const elapsed = (Date.now() - t0) / 1000;

// ------------------------------------------------------------- report -----
const rows = [];
let allLat = [];
let totalErrors = 0;
for (const [name, s] of stats) {
  const sorted = s.lat.slice().sort((a, b) => a - b);
  allLat = allLat.concat(sorted);
  totalErrors += s.errors;
  rows.push({
    endpoint: name,
    count: sorted.length,
    errors: s.errors,
    p50: pct(sorted, 50),
    p95: pct(sorted, 95),
    p99: pct(sorted, 99),
    max: sorted[sorted.length - 1] || 0,
    status: Object.fromEntries([...s.status.entries()].sort()),
  });
}
allLat.sort((a, b) => a - b);
const total = allLat.length;
const rps = total / elapsed;
const errRate = total ? (100 * totalErrors) / total : 0;
const p95 = pct(allLat, 95);
// The ratelimit scenario is expected to be throttled: it is informational, never a failure.
const verdict = SCENARIO === "ratelimit" ? "INFO" : total > 0 && p95 <= P95_TARGET && errRate <= MAX_ERR ? "PASS" : "FAIL";

console.log("\n");
console.log(pad("endpoint", 16) + pad("count", 8) + pad("err", 6) + pad("p50", 9) + pad("p95", 9) + pad("p99", 9) + pad("max", 9) + "status");
for (const r of rows) {
  console.log(
    pad(r.endpoint, 16) + pad(r.count, 8) + pad(r.errors, 6) + pad(ms(r.p50), 9) + pad(ms(r.p95), 9) + pad(ms(r.p99), 9) + pad(ms(r.max), 9) +
      Object.entries(r.status).map(([k, v]) => `${k}×${v}`).join(" "),
  );
}
console.log("");
console.log(`total: ${total} requests in ${elapsed.toFixed(1)}s  →  ${rps.toFixed(1)} req/s   p50=${ms(pct(allLat, 50))} p95=${ms(p95)} p99=${ms(pct(allLat, 99))}   errors=${totalErrors} (${errRate.toFixed(2)}%)`);
console.log(`status: ${[...statusTotal.entries()].sort().map(([k, v]) => `${k}×${v}`).join("  ")}`);
if (firstRateLimited) {
  console.log(`rate limit: first 429 at request #${firstRateLimited.index}  ${JSON.stringify(firstRateLimited.headers)}`);
  if (IP_MODE === "per-vu") console.log("  (per-vu IPs were sent — if 429 came early, the backend runs with TRUST_PROXY_HOPS=0 and ignores X-Forwarded-For)");
}
if (MODE === "closed" && total > 0 && SCENARIO !== "ratelimit") {
  const players = rps / RPS_PER_PLAYER;
  console.log(`capacity estimate: ${rps.toFixed(0)} req/s ÷ ${RPS_PER_PLAYER.toFixed(3)} req/s per farm-tab player ≈ ${Math.floor(players)} concurrent players` +
    (p95 > P95_TARGET ? `  (at p95=${ms(p95)} — above target ${P95_TARGET} ms, so the real ceiling is lower)` : ` at p95 ≤ ${P95_TARGET} ms`));
}
if (MODE === "players") {
  console.log(`players mode: ${VUS} players generated ${rps.toFixed(1)} req/s (steady state ≈ ${(VUS * RPS_PER_PLAYER).toFixed(1)} req/s once every timer has fired; runs < 60 s under-count the 30/60 s timers); p95=${ms(p95)} errors=${errRate.toFixed(2)}%`);
}
console.log(`verdict: ${verdict}  (targets: p95 ≤ ${P95_TARGET} ms, errors ≤ ${MAX_ERR}%)`);

const report = {
  tool: "nf-load/1.0", at: new Date().toISOString(), base: BASE, scenario: SCENARIO, mode: MODE, vus: VUS, durationS: DURATION_S,
  ipMode: IP_MODE, elapsedS: elapsed, total, rps, p50: pct(allLat, 50), p95, p99: pct(allLat, 99), errors: totalErrors, errorRatePct: errRate,
  rpsPerPlayer: RPS_PER_PLAYER, estimatedPlayers: MODE === "closed" ? rps / RPS_PER_PLAYER : null, firstRateLimited, endpoints: rows,
  status: Object.fromEntries([...statusTotal.entries()].sort()), verdict,
};
if (args.json) writeFileSync(String(args.json), JSON.stringify(report, null, 2));
if (args.md) {
  const md = [
    `### nf-load ${report.at} — ${SCENARIO}/${MODE}, ${VUS} VUs, ${DURATION_S}s → **${verdict}**`,
    "",
    `- base: \`${BASE}\`, ip mode: ${IP_MODE}`,
    `- ${total} requests, **${rps.toFixed(1)} req/s**, p50 ${ms(report.p50)}, p95 ${ms(p95)}, p99 ${ms(report.p99)}, errors ${totalErrors} (${errRate.toFixed(2)}%)`,
    report.estimatedPlayers != null ? `- capacity estimate: ≈ ${Math.floor(report.estimatedPlayers)} concurrent farm-tab players` : "",
    "",
    "| endpoint | count | err | p50 | p95 | p99 | status |",
    "|---|---:|---:|---:|---:|---:|---|",
    ...rows.map((r) => `| ${r.endpoint} | ${r.count} | ${r.errors} | ${ms(r.p50)} | ${ms(r.p95)} | ${ms(r.p99)} | ${Object.entries(r.status).map(([k, v]) => `${k}×${v}`).join(" ")} |`),
    "",
  ].join("\n");
  appendFileSync(String(args.md), md + "\n");
}
process.exit(STRICT && verdict === "FAIL" ? 1 : 0);

// ------------------------------------------------------------ helpers -----
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const [k, inline] = a.slice(2).split("=");
    if (inline !== undefined) out[k] = inline;
    else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith("--")) out[k] = argv[++i];
    else out[k] = true;
  }
  return out;
}
function int(v, d) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : d;
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function pad(v, n) {
  return String(v).padEnd(n);
}
function ms(v) {
  return `${v.toFixed(v < 10 ? 2 : 0)}ms`;
}
function pick(h, keys) {
  const o = {};
  for (const k of keys) if (h && h[k] !== undefined) o[k] = h[k];
  return o;
}
function count5xx() {
  let n = 0;
  for (const [k, v] of statusTotal) if (/^5\d\d$/.test(k)) n += v;
  return n;
}
function countErr() {
  let n = 0;
  for (const [k, v] of statusTotal) if (k.startsWith("ERR")) n += v;
  return n;
}
function base58(bytes) {
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let x = 0n;
  for (const b of bytes) x = (x << 8n) | BigInt(b);
  let out = "";
  while (x > 0n) {
    out = ALPHABET[Number(x % 58n)] + out;
    x /= 58n;
  }
  for (const b of bytes) {
    if (b !== 0) break;
    out = "1" + out;
  }
  return out;
}
function usage() {
  return `nf-load — zero-dependency load generator for aof_backend

  node scripts/loadtest/nf-load.mjs [--url http://localhost:8080] [--scenario health|db|chain|farm|mixed|ratelimit]
        [--mode closed|players] [--vus 20] [--duration 20] [--wallets N] [--ip per-vu|single]
        [--timeout 10000] [--p95-target 500] [--max-error-rate 1] [--json out.json] [--md out.md] [--strict]

  Start the backend with TRUST_PROXY_HOPS=1 so --ip per-vu (default) is honoured; otherwise every VU
  shares one IP and the per-IP throttle (RATE_LIMIT_GENERAL_MAX) ends the test with 429s.`;
}
