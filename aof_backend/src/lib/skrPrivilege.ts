import { Connection, PublicKey } from "@solana/web3.js";
import { getAccount, getAssociatedTokenAddress } from "@solana/spl-token";

// [ФИКС] Используем валидные placeholder-адреса (System Program = 32 нуля в base58)
// Реальные адреса минтов нужно будет подставить при деплое
const PLACEHOLDER_MINT = "11111111111111111111111111111111";

export const SKR_MINT = new PublicKey(PLACEHOLDER_MINT);
export const SAGA_COLLECTION = new PublicKey(PLACEHOLDER_MINT);

// Порог владения SKR для получения привилегии (100 токенов с учётом decimals=6)
const MIN_SKR_BALANCE = 3000 * 1e9; // 3000 SKR (с 9 decimals)

export interface PrivilegeStatus {
  hasPrivilege: boolean;
  source: "NONE" | "SKR_HOLDER" | "SAGA_NFT" | "PLACEHOLDER";
  craftDiscountBps: number; // 1500 = 15%
  repairDiscountBps: number;
  dailyFreeFlask: boolean;
}

// Если минт не настроен (равен placeholder) — привилегия отключена
function isPlaceholder(pk: PublicKey): boolean {
  return pk.toBase58() === PLACEHOLDER_MINT;
}

export async function checkSkrPrivilege(
  connection: Connection,
  userPubkey: PublicKey
): Promise<PrivilegeStatus> {
  const none: PrivilegeStatus = {
    hasPrivilege: false,
    source: "NONE",
    craftDiscountBps: 0,
    repairDiscountBps: 0,
    dailyFreeFlask: false,
  };

  try {
    // 1. Проверяем, настроены ли минты
    if (isPlaceholder(SKR_MINT) && isPlaceholder(SAGA_COLLECTION)) {
      return { ...none, source: "PLACEHOLDER" };
    }

    // 2. Проверяем баланс SKR
    if (!isPlaceholder(SKR_MINT)) {
      const skrAta = await getAssociatedTokenAddress(SKR_MINT, userPubkey);
      try {
        const account = await getAccount(connection, skrAta);
        if (Number(account.amount) >= MIN_SKR_BALANCE) {
          return {
            hasPrivilege: true,
            source: "SKR_HOLDER",
            craftDiscountBps: 1500,
            repairDiscountBps: 1500,
            dailyFreeFlask: true,
          };
        }
      } catch (e) {
        // ATA не существует — нет SKR
      }
    }

    // 3. TODO: проверка владения NFT Saga/Seeker через Metaplex DAS API
    // Для MVP пока достаточно проверки токена SKR

    return none;
  } catch (e) {
    console.error("Error checking SKR privilege:", e);
    return none;
  }
}
