import { randomBytes, createHash } from "crypto";
import { prisma } from "./db";
import { Prisma } from "@prisma/client";

const DEFAULT_TTL_SECONDS = 300; // 5 минут

/**
 * Создаёт новый commit: генерирует secret, сохраняет в БД, возвращает hash.
 * Hash — это SHA-256 от secret, который публикуется on-chain.
 */
export async function newCommit(
  key: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<{ secret: Buffer; hash: number[] }> {
  const secret = randomBytes(32);
  const hash = createHash("sha256").update(secret).digest();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

  // Upsert: если такой key уже был (например, retry) — обновляем
  await prisma.commitSecret.upsert({
    where: { key },
    update: {
      secret: secret.toString("hex"),
      expiresAt,
      used: false,
    },
    create: {
      key,
      secret: secret.toString("hex"),
      expiresAt,
      used: false,
    },
  });

  return { secret, hash: Array.from(hash) };
}

/**
 * Забирает секрет для reveal. Помечает как использованный.
 * Защищает от двойного использования (double-spend).
 */
export async function popSecret(key: string): Promise<number[]> {
  return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const record = await tx.commitSecret.findUnique({ where: { key } });

    if (!record) {
      throw new Error(`secret_not_found: ${key}`);
    }
    if (record.used) {
      throw new Error(`secret_already_used: ${key}`);
    }
    if (record.expiresAt < new Date()) {
      throw new Error(`secret_expired: ${key}`);
    }

    await tx.commitSecret.update({
      where: { key },
      data: { used: true },
    });

    return Array.from(Buffer.from(record.secret, "hex"));
  });
}

/**
 * Возвращает все протухшие неиспользованные коммиты для авто-reveal.
 * Используется фоновым воркером.
 */
export async function getExpiredCommits(limit: number = 100) {
  return await prisma.commitSecret.findMany({
    where: {
      used: false,
      expiresAt: { lt: new Date() },
    },
    take: limit,
    orderBy: { expiresAt: "asc" },
  });
}

/**
 * Помечает коммит как использованный (после успешного on-chain reveal).
 */
export async function markUsed(key: string): Promise<void> {
  await prisma.commitSecret.update({
    where: { key },
    data: { used: true },
  });
}

/**
 * Очистка старых использованных записей (старше 7 дней).
 * Вызывается раз в сутки.
 */
export async function cleanupOldCommits(): Promise<number> {
  const cutoff = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const result = await prisma.commitSecret.deleteMany({
    where: {
      used: true,
      createdAt: { lt: cutoff },
    },
  });
  return result.count;
}
