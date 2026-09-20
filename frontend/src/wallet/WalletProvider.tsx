import React, { useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
} from "@solana/wallet-adapter-react";

const RPC_URL = (import.meta as any).env?.VITE_RPC_URL || "https://api.devnet.solana.com";

// wallet-adapter currently ships a nested React 19 type package while this
// app intentionally stays on React 18. Runtime behavior is unchanged; this
// cast prevents the duplicate React type identities from breaking tsc.
const SafeConnectionProvider: any = ConnectionProvider;
const SafeWalletProvider: any = SolanaWalletProvider;

export function AppWalletProvider({ children }: { children: React.ReactNode }) {
  // Standard wallets (Phantom, Solflare, Backpack, etc.) are registered automatically
  // by @solana/wallet-adapter-react via the Solana Wallet Standard.
  const wallets = useMemo(() => [], []);
  return (
    <SafeConnectionProvider endpoint={RPC_URL}>
      <SafeWalletProvider wallets={wallets} autoConnect>
        {children}
      </SafeWalletProvider>
    </SafeConnectionProvider>
  );
}
