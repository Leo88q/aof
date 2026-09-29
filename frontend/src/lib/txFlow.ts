import { walletRuntimeCopy } from "../i18n/walletRuntimeCopy";
import { txResponseFeedback, txExceptionFeedback } from "./txResponseFeedback";
import { getApiErrorLanguage } from "./apiErrorLanguage";
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
  const language = getApiErrorLanguage();
  const copy = walletRuntimeCopy[language];
  if (!response || typeof response !== "object") return { success: false, error: copy.invalidResponse };
  if (intent && !response.tx) return { success: false, error: copy.expectedTransaction };
  if (response.pending) return { success: false, signature: response.signature, error: copy.pending };
  if (response.sig && !intent) {
    try {
      await confirmSignature(connection, response.sig);
      return { success: true, signature: response.sig };
    } catch (e: any) {
      return { success: false, signature: response.sig, error: txExceptionFeedback(e, language, copy.unconfirmedResponse) };
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
      if (e?.message === "NEED_WALLET") {
        return {
          success: false,
          error: copy.connectWallet,
        };
      }
      return { success: false, signature: typeof e?.signature === 'string' ? e.signature : undefined, error: txExceptionFeedback(e, language, copy.unconfirmedResponse) };
    }
  }

  if (response.error) {
    return { success: false, error: txResponseFeedback(response.error, language, copy.unconfirmedResponse) };
  }

  return { success: true };
}

export function requireWallet(): boolean {
  const { connected } = useWalletStore.getState();
  return connected;
}
