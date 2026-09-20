import type { TransactionIntent } from "./transactionIntent";
import { confirmSignature } from "./confirmation";
import { connection } from "./wallet";
import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { signAndSendTx } from "./wallet";
import { useWalletStore } from "../store/walletStore";

/** Decode a backend base64 transaction before it reaches guards or wallets. */
export function decodeTransaction(base64: string): Transaction | VersionedTransaction {
  const raw = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  try {
    return Transaction.from(raw);
  } catch {
    return VersionedTransaction.deserialize(raw);
  }
}

/**
 * Универсальный обработчик ответа бэкенда.
 * - Если пришёл `sig` (authorityOnly) — транзакция уже отправлена, показываем успех
 * - Если пришёл `tx` (coSign) — декодируем, проверяем и подписываем кошельком
 */
export async function handleTxResponse(response: any, intent?: TransactionIntent): Promise<{
  success: boolean;
  signature?: string;
  error?: string;
}> {
  if (!response || typeof response !== "object") return { success: false, error: "Invalid API response" };
  if (intent && !response.tx) return { success: false, error: "Expected a wallet transaction matching the purchase intent" };
  if (response.pending) return { success: false, signature: response.signature, error: response.reason || "Операция ожидает подтверждения" };
  if (response.sig && !intent) {
    try {
      await confirmSignature(connection, response.sig);
      return { success: true, signature: response.sig };
    } catch (e: any) {
      return { success: false, signature: response.sig, error: e.message };
    }
  }

  if (response.tx) {
    try {
      if (!useWalletStore.getState().address) throw new Error("NEED_WALLET");
      // The last signing boundary in wallet.ts checks the actual provider key,
      // decodes and guards the very same transaction, then awaits confirmation.
      const signature = await signAndSendTx(response.tx, intent);
      return { success: true, signature };
    } catch (e: any) {
      if (e.message === "NEED_WALLET") {
        return {
          success: false,
          error: "Подключите кошелёк (кнопка вверху экрана)",
        };
      }
      return { success: false, error: e.message };
    }
  }

  if (response.error) {
    return { success: false, error: response.error };
  }

  return { success: true };
}

export function requireWallet(): boolean {
  const { connected } = useWalletStore.getState();
  return connected;
}
