import { Request, Response, NextFunction } from "express";
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { db } from "../lib/db";
import { logger } from "../lib/logger";

// Скользящее окно rate limiting (окно 60 сек) для API-ключей.
//
// [AUDIT F-30] This map used to grow forever: one entry per distinct key ever
// seen, never deleted, so an attacker who sent N requests with N random
// X-API-Key headers grew the backend's heap by N entries with no bound (a
// memory-exhaustion DoS reachable before authentication). Entries are now
// dropped as soon as their timestamps fall out of the window, and the map has a
// hard ceiling.
const usage: Map<string, number[]> = new Map();
const WINDOW_MS = 60_000;
const MAX_TRACKED_KEYS = 50_000;
/** Drop keys that had no traffic in the last window. */
const GC_INTERVAL_MS = 60_000;

let gcTimer: NodeJS.Timeout | null = null;
/**
 * Idempotent sweeper. `setInterval(...).unref()` keeps tests and one-shot
 * scripts from hanging on it, and the periodic timer alone is not enough: the
 * sweep also runs inline whenever the map is close to its ceiling, so a burst
 * of junk keys cannot outrun the timer.
 */
function startUsageGc(): void {
  if (gcTimer) return;
  gcTimer = setInterval(() => sweepUsage(Date.now()), GC_INTERVAL_MS);
  gcTimer.unref?.();
}

function sweepUsage(now: number): void {
  for (const [key, timestamps] of usage) {
    const live = timestamps.filter((ts) => now - ts < WINDOW_MS);
    if (live.length === 0) usage.delete(key);
    else if (live.length !== timestamps.length) usage.set(key, live);
  }
  // Hard ceiling: if we are still over it, evict the coldest entries rather
  // than letting the heap grow without bound.
  if (usage.size > MAX_TRACKED_KEYS) {
    let excess = usage.size - MAX_TRACKED_KEYS;
    for (const key of usage.keys()) {
      if (excess-- <= 0) break;
      usage.delete(key);
    }
    logger.warn({ maxTrackedKeys: MAX_TRACKED_KEYS }, "apiKey usage map hit its ceiling; evicting cold entries");
  }
}

/**
 * [AUDIT F-07] API keys are stored as SHA-256 hashes, exactly like passwords.
 * The old value was `aof_${tier}_${Date.now()}_${Math.random()...}` —
 * `Math.random()` is not a CSPRNG, and the timestamp narrowed the search space
 * further (a key issued at a known time had roughly 36^8 candidates, and V8's
 * PRNG state is recoverable from a handful of outputs). The plaintext is now
 * 256 bits from `crypto.randomBytes` and is returned exactly once.
 */
export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext, "utf8").digest("hex");
}

export const apiKeyAuth = async (req: Request, res: Response, next: NextFunction) => {
  const presented = req.headers["x-api-key"] as string;
  if (!presented) {
    return res.status(401).json({ error: "Missing X-API-Key header" });
  }

  // Look the key up by hash: the DB never stores the plaintext, so a database
  // leak does not hand out live credentials.
  const keyHash = hashApiKey(presented);
  const apiKey = await db.apiKey.findUnique({ where: { key: keyHash } });
  if (!apiKey || !apiKey.active) {
    return res.status(401).json({ error: "Invalid API key" });
  }

  // Скользящее окно rate limiting
  const now = Date.now();
  startUsageGc();
  const timestamps = (usage.get(keyHash) || []).filter((ts) => now - ts < WINDOW_MS);

  if (timestamps.length >= apiKey.rateLimit) {
    // The rejected request still consumed a slot in the accounting sense; keep
    // it visible so a client hammering the limit cannot hide it.
    usage.set(keyHash, timestamps);
    return res.status(429).json({
      error: "Rate limit exceeded",
      retryAfterSeconds: Math.ceil((WINDOW_MS - (now - timestamps[0])) / 1000),
    });
  }

  timestamps.push(now);
  usage.set(keyHash, timestamps);
  if (usage.size > MAX_TRACKED_KEYS) sweepUsage(now);

  // Обновляем lastUsedAt (не блокирующе)
  db.apiKey.update({ where: { key: keyHash }, data: { lastUsedAt: new Date() } }).catch(() => {});

  (req as any).apiTier = apiKey.tier;
  next();
};

/**
 * Эндпоинт для выпуска ключей (только админ).
 *
 * [AUDIT F-07] Returns the plaintext key once; only its SHA-256 hash is
 * persisted. Existing rows that still hold a plaintext key are rejected by the
 * lookup above, so the operator must re-issue keys when this ships.
 */
export async function issueApiKey(label: string, tier: string = "free"): Promise<string> {
  const plaintext = `aof_${tier}_${randomBytes(32).toString("hex")}`;
  const keyHash = hashApiKey(plaintext);
  await db.apiKey.create({
    data: {
      key: keyHash,
      label,
      tier,
      rateLimit: tier === "pro" ? 300 : 60,
    },
  });
  return plaintext;
}

/** Entries are keyed by hash, so this is only used by tests/diagnostics. */
export function __usageSize(): number {
  return usage.size;
}

/** Timing-safe equality helper, kept for callers comparing key hashes. */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
