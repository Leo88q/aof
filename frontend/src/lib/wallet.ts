import {
  Connection,
  PublicKey,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";

export const RPC = "http://127.0.0.1:8899";
export const connection = new Connection(RPC, "confirmed");

// Определяем доступный кошелёк в браузере
function detectWallet(): any {
  const w = window as any;
  if (w.phantom?.solana?.isPhantom) return w.phantom.solana;
  if (w.backpack) return w.backpack;
  if (w.solflare) return w.solflare;
  return null;
}

export interface WalletAdapter {
  available: boolean;
  name: string;
  connect: () => Promise<PublicKey>;
  disconnect: () => Promise<void>;
  signAndSend: (txBase64: string) => Promise<string>;
}

/**
 * Адаптер кошелька.
 * Если есть Phantom/Backpack — подписываем через него.
 * Если нет — фоллбэк (для разработки без кошелька).
 */
export function createWalletAdapter(): WalletAdapter {
  const provider = detectWallet();

  if (!provider) {
    return {
      available: false,
      name: "none",
      connect: async () => {
        throw new Error(
          "Кошелёк не найден. Установите Phantom или Backpack."
        );
      },
      disconnect: async () => {},
      signAndSend: async () => {
        throw new Error("Кошелёк недоступен");
      },
    };
  }

  return {
    available: true,
    name: provider.isPhantom ? "Phantom" : "Backpack",
    connect: async () => {
      const resp = await provider.connect();
      return new PublicKey(resp.publicKey.toString());
    },
    disconnect: async () => {
      await provider.disconnect();
    },
    signAndSend: async (txBase64: string) => {
      const raw = Uint8Array.from(atob(txBase64), (c) => c.charCodeAt(0));
      const tx = Transaction.from(raw);
      const { signature } = await provider.signAndSendTransaction(tx);
      return signature;
    },
  };
}

/**
 * Главная функция: получить транзакцию от бэкенда (coSign),
 * подписать своим кошельком и отправить.
 */
export async function signAndSendTx(txBase64: string): Promise<string> {
  const adapter = createWalletAdapter();
  if (!adapter.available) {
    throw new Error("NEED_WALLET");
  }
  return adapter.signAndSend(txBase64);
}
