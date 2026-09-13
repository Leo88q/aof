import { Request, Response, NextFunction } from "express";
import { db } from "../lib/db";
import { logger } from "../lib/logger";

// Простая in-memory корзина для скользящего окна (окно 60 сек)
const usage: Map<string, number[]> = new Map();

export const apiKeyAuth = async (req: Request, res: Response, next: NextFunction) => {
  const key = req.headers["x-api-key"] as string;
  if (!key) {
    return res.status(401).json({ error: "Missing X-API-Key header" });
  }

  const apiKey = await db.apiKey.findUnique({ where: { key } });
  if (!apiKey || !apiKey.active) {
    return res.status(401).json({ error: "Invalid API key" });
  }

  // Скользящее окно rate limiting
  const now = Date.now();
  const windowMs = 60_000;
  const timestamps = (usage.get(key) || []).filter((ts) => now - ts < windowMs);

  if (timestamps.length >= apiKey.rateLimit) {
    return res.status(429).json({
      error: "Rate limit exceeded",
      retryAfterSeconds: Math.ceil((windowMs - (now - timestamps[0])) / 1000),
    });
  }

  timestamps.push(now);
  usage.set(key, timestamps);

  // Обновляем lastUsedAt (не блокирующе)
  db.apiKey.update({ where: { key }, data: { lastUsedAt: new Date() } }).catch(() => {});

  (req as any).apiTier = apiKey.tier;
  next();
};

// Эндпоинт для выпуска ключей (только админ)
export async function issueApiKey(label: string, tier: string = "free"): Promise<string> {
  const key = `aof_${tier}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  await db.apiKey.create({
    data: {
      key,
      label,
      tier,
      rateLimit: tier === "pro" ? 300 : 60,
    },
  });
  return key;
}
