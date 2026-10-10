/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RPC_URL?: string;
  readonly VITE_CLUSTER?: string;
  readonly VITE_API_URL?: string;
  readonly VITE_WALLET_PROOF_DOMAIN?: string;
  readonly VITE_MINING_ENABLED?: string;
}
