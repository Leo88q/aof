import { create } from "zustand";
import { PublicKey } from "@solana/web3.js";
import { createWalletAdapter } from "../lib/wallet";

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
      const adapter = createWalletAdapter();
      if (!adapter.available) {
        throw new Error("Кошелёк не найден. Установите Phantom.");
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
    const adapter = createWalletAdapter();
    await adapter.disconnect();
    set({ address: null, connected: false, walletName: "" });
  },
}));
