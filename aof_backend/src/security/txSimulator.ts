/**
 * Симуляция транзакций перед реальной отправкой.
 * Защита от:
 * - Недостатка баланса
 * - Неверных параметров
 * - Невалидных аккаунтов
 *
 * Если симуляция падает — транзакция не отправляется.
 */
import { Transaction, Connection } from "@solana/web3.js";
import { simulationTransaction } from "../lib/transactionLifecycle";
import { connection } from "../provider";

export interface SimulationResult {
  success: boolean;
  error?: string;
  logs?: string[];
  computeUnitsUsed?: number;
}

/**
 * Симулировать транзакцию перед отправкой.
 * Возвращает результат симуляции без отправки в сеть.
 */
export async function simulateTransaction(tx: Transaction): Promise<SimulationResult> {
  try {
    const result = await connection.simulateTransaction(simulationTransaction(tx), {
      sigVerify: false,
      replaceRecentBlockhash: false,
      commitment: "confirmed",
    });

    if (result.value.err) {
      return {
        success: false,
        error: JSON.stringify(result.value.err),
        logs: result.value.logs || [],
      };
    }

    return {
      success: true,
      logs: result.value.logs || [],
      computeUnitsUsed: result.value.unitsConsumed,
    };
  } catch (e: any) {
    return {
      success: false,
      error: e.message,
    };
  }
}

/**
 * Проверить что баланс кошелька достаточен для операции.
 */
export async function checkWalletBalance(
  walletAddress: string,
  requiredLamports: number
): Promise<boolean> {
  try {
    const { PublicKey } = await import("@solana/web3.js");
    const pk = new PublicKey(walletAddress);
    const balance = await connection.getBalance(pk);
    return balance >= requiredLamports;
  } catch {
    return false;
  }
}

/**
 * Проверить что у кошелька есть достаточно токенов.
 */
export async function checkTokenBalance(
  tokenAccountAddress: string,
  requiredAmount: bigint
): Promise<boolean> {
  try {
    const { PublicKey } = await import("@solana/web3.js");
    const pk = new PublicKey(tokenAccountAddress);
    const accountInfo = await connection.getParsedAccountInfo(pk);
    const parsed = (accountInfo.value?.data as any)?.parsed;
    if (!parsed) return false;
    const balance = BigInt(parsed.info.tokenAmount.amount);
    return balance >= requiredAmount;
  } catch {
    return false;
  }
}
