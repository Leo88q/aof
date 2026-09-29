import { walletRuntimeCopy } from "../i18n/walletRuntimeCopy";
import { getApiErrorLanguage } from "../lib/apiErrorLanguage";
import { create } from "zustand";

interface WalletState {
  address: string | null;
  connected: boolean;
  connecting: boolean;
  walletName: string;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

export const useWalletStore = create<WalletState>((set) => ({
  address: null,
  connected: false,
  connecting: false,
  walletName: "",

  connect: async () => {
    set({ connecting: true });
    try {
      // Лениво: lib/wallet тянет @solana/web3.js — в стартовый чанк он
      // попадает только при реальном подключении игрока.
      const { createWalletAdapter } = await import("../lib/wallet");
      const adapter = createWalletAdapter();
      if (!adapter.available) {
        throw new Error(walletRuntimeCopy[getApiErrorLanguage()].notFoundShort);
      }
      const pubkey = await adapter.connect();
      set({
        address: pubkey.toBase58(),
        connected: true,
        connecting: false,
        walletName: adapter.name,
      });
    } catch (e) {
      set({ connecting: false });
      throw e;
    }
  },

  disconnect: async () => {
    const { createWalletAdapter } = await import("../lib/wallet");
    const adapter = createWalletAdapter();
    await adapter.disconnect();
    set({ address: null, connected: false, walletName: "" });
  },
}));
