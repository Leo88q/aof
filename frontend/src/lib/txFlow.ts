import { guardTransaction } from "./txGuard";
import { PublicKey } from "@solana/web3.js";
import { signAndSendTx } from "./wallet";
import { useWalletStore } from "../store/walletStore";

/**
 * Универсальный обработчик ответа бэкенда.
 * - Если пришёл `sig` (authorityOnly) — транзакция уже отправлена, показываем успех
 * - Если пришёл `tx` (coSign) — нужно подписать кошельком и отправить
 * 
 * [НОВОЕ] Перед подписанием вызывается guardTransaction для симуляции и проверки рисков
 */
export async function handleTxResponse(response: any): Promise<{
  success: boolean;
  signature?: string;
  error?: string;
}> {
  // authorityOnly: сервер уже отправил
  if (response.sig) {
    return { success: true, signature: response.sig };
  }

  // coSign: подписываем кошельком
  if (response.tx) {
    try {
      // === [НОВОЕ] PRE-SIGN GUARD ===
      const user = useWalletStore.getState().address;
      if (user) {
        console.log("🛡️ txGuard: начинаем симуляцию транзакции...");
        const guard = await guardTransaction(
          response.tx,
          new PublicKey(user),
          { 
            maxLamportsSpent: 500_000, // 0.0005 SOL максимум
          }
        );
        
        if (!guard.safe) {
          console.error("🛡️ ТРАНЗАКЦИЯ ЗАБЛОКИРОВАНА:", guard.reason);
          return { 
            success: false, 
            error: `🛡️ Защита: ${guard.reason}` 
          };
        }
        
        if (guard.warnings.length > 0) {
          console.warn("⚠️ txGuard предупреждения:", guard.warnings);
          // Можно показать toast, но не блокируем
        }
        
        console.log("✅ txGuard: транзакция безопасна, продолжаем");
      }
      // === КОНЕЦ GUARD ===

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

/**
 * Обёртка: проверяет подключение кошелька перед действием
 */
export function requireWallet(): boolean {
  const { connected } = useWalletStore.getState();
  return connected;
}
