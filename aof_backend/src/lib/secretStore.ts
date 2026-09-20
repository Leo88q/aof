import { randomBytes, createHash } from "crypto";
import { prisma } from "./db";

const DEFAULT_TTL_SECONDS = 300; // 5 минут

/**
 * Создаёт commit-secret. An active secret is never silently overwritten: doing
 * so would make the on-chain hash unrevealable and would permanently lock the
 * user's commit account.
 */
export async function newCommit(
  key: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<{ secret: Buffer; hash: number[] }> {
  const secret = randomBytes(32);
  const hash = createHash("sha256").update(secret).digest();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  const data = {
    secret: secret.toString("hex"),
    expiresAt,
    used: false,
  };

  // Claim a previously consumed key atomically. A read-then-update sequence
  // allowed two concurrent retries to overwrite each other's secret, leaving
  // one already-published on-chain hash unrevealable.
  const reclaimed = await prisma.commitSecret.updateMany({
    where: { key, used: true },
    data,
  });
  if (reclaimed.count === 0) {
    const existing = await prisma.commitSecret.findUnique({ where: { key } });
    if (existing) {
      throw new Error(
        existing.expiresAt < new Date()
          ? `commit_expired_unresolved: ${key}`
          : `commit_in_progress: ${key}`
      );
    }

    if (!existing) {
      try {
        await prisma.commitSecret.create({ data: { key, ...data } });
      } catch (error: any) {
        // Another request won the create race. Never overwrite its secret.
        if (error?.code === "P2002") throw new Error(`commit_in_progress: ${key}`);
        throw error;
      }
    }
  }

  return { secret, hash: Array.from(hash) };
}

/**
 * Reads a secret without consuming it. The database record is marked used only
 * after the corresponding on-chain reveal succeeds.
 */
export async function peekSecret(key: string): Promise<number[]> {
  const record = await prisma.commitSecret.findUnique({ where: { key } });

  if (!record) {
    throw new Error(`secret_not_found: ${key}`);
  }
  if (record.used) {
    throw new Error(`secret_already_used: ${key}`);
  }
  if (record.expiresAt < new Date()) {
    throw new Error(`secret_expired: ${key}`);
  }

  return Array.from(Buffer.from(record.secret, "hex"));
}

/**
 * Backwards-compatible name for callers that have not migrated yet. It no
 * longer consumes the secret; callers must call markUsed after a confirmed
 * successful reveal transaction.
 */
export async function popSecret(key: string): Promise<number[]> {
  return peekSecret(key);
}

/** Marks a secret consumed after the chain accepted its reveal. */
export async function markUsed(key: string): Promise<void> {
  await prisma.commitSecret.update({
    where: { key },
    data: { used: true },
  });
}

/**
 * Возвращает все протухшие неиспользованные коммиты для авто-reveal.
 * The generic worker must not mark these as revealed: it has no program,
 * account, or user context with which to submit the actual reveal.
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

/** Очистка старых использованных записей (старше 7 дней). */
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
