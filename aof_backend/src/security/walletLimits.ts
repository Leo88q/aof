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
  const windowStart = new Date(Date.now() - WINDOW_MS);

  // Количество операций за период
  const opCount = await db.walletOperation.count({
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

  // Суммарный объём за период
  const volumeResult = await db.walletOperation.aggregate({
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

  // Записываем операцию
  await db.walletOperation.create({
    data: {
      wallet: walletAddress,
      operationType,
      volumeLamports,
      createdAt: new Date(),
    },
  });
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
