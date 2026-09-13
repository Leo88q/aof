/**
 * Проверка минтов — защита от подмены токенов.
 * Атакующий не может подсунуть свой токен с тем же именем.
 *
 * Механизм:
 * 1. Разрешённые минты хранятся в БД/конфиге (не принимаются от клиента)
 * 2. Перед построением транзакции проверяем что минт в списке разрешённых
 * 3. Проверяем что минт существует на чейне
 * 4. Проверяем что у минта правильные характеристики (если нужно)
 */
import { PublicKey } from "@solana/web3.js";
import { db } from "../lib/db";
import { connection } from "../provider";

// Кэш разрешённых минтов (обновляется раз в 5 минут)
let allowedMintsCache: Map<string, boolean> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function getAllowedMints(): Promise<Map<string, boolean>> {
  const now = Date.now();
  if (allowedMintsCache && now - cacheTimestamp < CACHE_TTL_MS) {
    return allowedMintsCache;
  }

  const mints = await db.allowedMint.findMany({
    where: { active: true },
  });

  allowedMintsCache = new Map(mints.map((m) => [m.mint, true]));
  cacheTimestamp = now;
  return allowedMintsCache;
}

/**
 * Проверить что минт разрешён.
 * Бросает исключение если минт не в списке разрешённых.
 */
export async function assertMintAllowed(mintAddress: string): Promise<void> {
  // Валидация формата
  try {
    new PublicKey(mintAddress);
  } catch {
    throw new Error(`INVALID_MINT_FORMAT: ${mintAddress}`);
  }

  const allowed = await getAllowedMints();
  if (!allowed.has(mintAddress)) {
    throw new Error(`MINT_NOT_ALLOWED: ${mintAddress} не в списке разрешённых минтов`);
  }
}

/**
 * Проверить что минт существует на чейне и является валидным SPL-минтом.
 */
export async function assertMintExistsOnChain(mintAddress: string): Promise<void> {
  try {
    const mintPk = new PublicKey(mintAddress);
    const accountInfo = await connection.getAccountInfo(mintPk);

    if (!accountInfo) {
      throw new Error(`MINT_NOT_FOUND: аккаунт не существует на чейне`);
    }

    // Проверяем что это токен-программа (не системный аккаунт)
    const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
    if (accountInfo.owner.toBase58() !== TOKEN_PROGRAM_ID) {
      throw new Error(`MINT_NOT_TOKEN: аккаунт не является SPL-минтом`);
    }
  } catch (e: any) {
    throw new Error(`MINT_VALIDATION_FAILED: ${e.message}`);
  }
}

/**
 * Полная проверка минта перед использованием в транзакции.
 * Использовать перед каждым построением транзакции с минтом.
 */
export async function validateMintForTransaction(mintAddress: string): Promise<void> {
  await assertMintAllowed(mintAddress);
  await assertMintExistsOnChain(mintAddress);
}

/**
 * Добавить минт в список разрешённых (только админ).
 */
export async function addAllowedMint(
  mintAddress: string,
  label: string
): Promise<void> {
  new PublicKey(mintAddress); // Валидация формата

  await db.allowedMint.upsert({
    where: { mint: mintAddress },
    update: { active: true, label },
    create: { mint: mintAddress, label, active: true },
  });

  // Инвалидация кэша
  allowedMintsCache = null;
}

/**
 * Удалить минт из списка разрешённых (только админ).
 */
export async function removeAllowedMint(mintAddress: string): Promise<void> {
  await db.allowedMint.update({
    where: { mint: mintAddress },
    data: { active: false },
  });
  allowedMintsCache = null;
}

/**
 * Получить список разрешённых минтов (для админки/документации).
 */
export async function listAllowedMints(): Promise<any[]> {
  return db.allowedMint.findMany({ where: { active: true } });
}
