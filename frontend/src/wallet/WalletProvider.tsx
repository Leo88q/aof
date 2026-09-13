import React, { useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
} from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";

const RPC_URL = (import.meta as any).env?.VITE_RPC_URL || "http://127.0.0.1:8899";

export function AppWalletProvider({ children }: { children: React.ReactNode }) {
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );
  return (
    <ConnectionProvider endpoint={RPC_URL}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        {children}
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}
