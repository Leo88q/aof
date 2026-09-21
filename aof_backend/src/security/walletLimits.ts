/**
 * Лимиты по кошелькам — защита от бот-фарминга и массовых операций.
 * Два уровня:
 * 1. Лимит на количество операций за период
 * 2. Лимит на суммарный объём операций за период
 *
 * Использовать перед каждой критичной операцией.
 */
import { db } from "../lib/db";

const WINDOW_MS = 15 * 60 * 1000; // 15 минут

// Лимиты по умолчанию (можно переопределить через БД)
const DEFAULT_LIMITS = {
  maxOperations: 300, // максимум 300 операций за 15 минут (dev-лимит)
  maxVolumeLamports: 1000 * 1_000_000_000, // максимум 1000 SOL за 15 минут (dev-лимит)
};

/**
 * Проверить лимиты кошелька перед операцией.
 * Бросает исключение если лимит превышен.
 */
export async function checkWalletLimits(
  walletAddress: string,
  operationType: string,
  volumeLamports: number = 0
): Promise<void> {
  if (!walletAddress || !operationType || !Number.isSafeInteger(volumeLamports) || volumeLamports < 0) {
    throw new Error("Invalid wallet limit input");
  }

  const windowStart = new Date(Date.now() - WINDOW_MS);

  // Read/check/write must be one atomic unit. On SQLite the single writer
  // lock already serialises this; on PostgreSQL the default READ COMMITTED
  // level lets two concurrent requests both observe the old count and both
  // insert, exceeding the cap. Run SERIALIZABLE and retry on serialization
  // failure (P2034) so the guarantee holds on both providers.
  await withSerializableRetry(() => db.$transaction(async (tx: any) => {
    const opCount = await tx.walletOperation.count({
      where: {
        wallet: walletAddress,
        createdAt: { gte: windowStart },
      },
    });

    if (opCount >= DEFAULT_LIMITS.maxOperations) {
      throw new Error(
        `RATE_LIMIT_EXCEEDED: кошелек ${walletAddress} превысил лимит операций (${opCount}/${DEFAULT_LIMITS.maxOperations})`
      );
    }

    const volumeResult = await tx.walletOperation.aggregate({
      where: {
        wallet: walletAddress,
        createdAt: { gte: windowStart },
      },
      _sum: { volumeLamports: true },
    });

    const currentVolume = volumeResult._sum.volumeLamports || 0;
    if (currentVolume + volumeLamports > DEFAULT_LIMITS.maxVolumeLamports) {
      throw new Error(
        `VOLUME_LIMIT_EXCEEDED: кошелек ${walletAddress} превысил лимит объёма (${currentVolume} + ${volumeLamports} > ${DEFAULT_LIMITS.maxVolumeLamports})`
      );
    }

    await tx.walletOperation.create({
      data: {
        wallet: walletAddress,
        operationType,
        volumeLamports,
        createdAt: new Date(),
      },
    });
  }, { isolationLevel: "Serializable" }));
}

const SERIALIZATION_RETRIES = 5;

/**
 * Prisma raises P2034 when a Serializable transaction conflicts (PostgreSQL
 * 40001) and P2028/SQLITE_BUSY-flavoured errors when SQLite cannot acquire the
 * write lock. Both are transient: back off briefly and retry a bounded number
 * of times, then surface the error.
 */
async function withSerializableRetry<T>(fn: () => Promise<T>): Promise<T> {
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (e: any) {
      const transient = e?.code === "P2034" || /SQLITE_BUSY|database is locked|deadlock detected|could not serialize/i.test(String(e?.message ?? ""));
      if (!transient || attempt >= SERIALIZATION_RETRIES) throw e;
      attempt += 1;
      await new Promise((r) => setTimeout(r, 10 * 2 ** attempt + Math.floor(Math.random() * 20)));
    }
  }
}

/**
 * Обёртка для операций с автоматической проверкой лимитов.
 */
export async function withWalletLimits<T>(
  walletAddress: string,
  operationType: string,
  volumeLamports: number,
  fn: () => Promise<T>
): Promise<T> {
  await checkWalletLimits(walletAddress, operationType, volumeLamports);
  return fn();
}
