import { getAofGuardConfig, guardTransaction } from "./txGuard";
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
export async function handleTxResponse(response: any): Promise<{
  success: boolean;
  signature?: string;
  error?: string;
}> {
  if (response.sig) {
    return { success: true, signature: response.sig };
  }

  if (response.tx) {
    try {
      const user = useWalletStore.getState().address;
      if (user) {
        console.log("🛡️ txGuard: начинаем симуляцию транзакции...");
        const decoded = decodeTransaction(response.tx);
        const guard = await guardTransaction(
          decoded,
          new PublicKey(user),
          getAofGuardConfig()
        );

        if (!guard.safe) {
          console.error("🛡️ ТРАНЗАКЦИЯ ЗАБЛОКИРОВАНА:", guard.reason);
          return {
            success: false,
            error: `🛡️ Защита: ${guard.reason}`,
          };
        }

        if (guard.warnings.length > 0) {
          console.warn("⚠️ txGuard предупреждения:", guard.warnings);
        }
      }

      const signature = await signAndSendTx(response.tx);
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
