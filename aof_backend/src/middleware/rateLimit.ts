import rateLimit from "express-rate-limit";

/**
 * Per-IP throttles (express-rate-limit, in-memory store).
 *
 * Capacity review 2026-09-28 (docs/REVIEW_DB_TESTS_LOAD_AI_2026-09-28.md):
 *  - the game client polls: MillPanel/OvenPanel every 5 s (180 req / 15 min on
 *    their own), PlantingPanel 10 s, WellPanel 15 s, plus profile/inbox/weather
 *    loads. The former 300 req / 15 min default was exhausted by ONE active
 *    player after ~12 minutes on the farm tab, and by two players behind one
 *    NAT (family, office, mobile CGNAT) almost immediately -> 429s that look
 *    like an outage. The defaults below are still conservative (60 req / min)
 *    but no longer below the client's own polling rate.
 *  - the limits are env-tunable so operators can react without a redeploy
 *    (RATE_LIMIT_GENERAL_MAX / RATE_LIMIT_TX_MAX / RATE_LIMIT_READ_MAX).
 *  - /health and /ready are exempt: liveness probes from the orchestrator and
 *    external monitors used to burn the general budget of the probe's IP and
 *    could flap the instance to "unhealthy" with a 429.
 *  - the store is per process. With more than one backend replica the limit
 *    is effectively multiplied by the replica count; use a shared store
 *    (rate-limit-redis) before scaling horizontally.
 */
function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`${name} must be a positive integer (got ${JSON.stringify(raw)})`);
  }
  return n;
}

const PROBE_PATHS = new Set(["/health", "/ready"]);
const skipProbes = (req: { path: string }) => PROBE_PATHS.has(req.path);

export const RATE_LIMITS = {
  general: { windowMs: 15 * 60 * 1000, max: envInt("RATE_LIMIT_GENERAL_MAX", 900) },
  tx: { windowMs: 60 * 1000, max: envInt("RATE_LIMIT_TX_MAX", 120) },
  read: { windowMs: 15 * 60 * 1000, max: envInt("RATE_LIMIT_READ_MAX", 1500) },
} as const;

// Общий лимит: 900 запросов / 15 мин (60/мин) на IP
export const generalLimiter = rateLimit({
  windowMs: RATE_LIMITS.general.windowMs,
  max: RATE_LIMITS.general.max,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipProbes,
  message: { error: "Too many requests, slow down" },
});

// Строгий лимит для транзакционных эндпоинтов: 120 / мин на IP
export const txLimiter = rateLimit({
  windowMs: RATE_LIMITS.tx.windowMs,
  max: RATE_LIMITS.tx.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many transactions, wait a minute" },
});

// Лимит для чтения (RPC/DB-скан прокси): 1500 / 15 мин на IP
export const readLimiter = rateLimit({
  windowMs: RATE_LIMITS.read.windowMs,
  max: RATE_LIMITS.read.max,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipProbes,
  message: { error: "Read limit exceeded" },
});
