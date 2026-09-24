import type { TransactionIntent } from "./transactionIntent";
import { confirmSignature } from "./confirmation";
import {
  Connection,
  PublicKey,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";

const configuredRpc = (import.meta as any).env?.VITE_RPC_URL as string | undefined;

// Safe fallback to public Solana RPC if VITE_RPC_URL is not explicitly configured
export const RPC = configuredRpc || "https://api.devnet.solana.com";
export const connection = new Connection(RPC, "confirmed");

function decodeTransaction(txBase64: string): Transaction | VersionedTransaction {
  const raw = Uint8Array.from(atob(txBase64), (c) => c.charCodeAt(0));
  try {
    return Transaction.from(raw);
  } catch {
    return VersionedTransaction.deserialize(raw);
  }
}

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
  signMessage: (message: string) => Promise<string>;
  signAndSend: (txBase64: string, intent?: TransactionIntent) => Promise<string>;
}

export function createWalletAdapter(): WalletAdapter {
  const provider = detectWallet();

  if (!provider) {
    return {
      available: false,
      name: "none",
      connect: async () => {
        throw new Error("Кошелёк не найден. Установите Phantom или Backpack.");
      },
      disconnect: async () => {},
      signMessage: async () => {
        throw new Error("Кошелёк недоступен");
      },
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
    signMessage: async (message: string) => {
      if (typeof provider.signMessage !== "function") {
        throw new Error("Кошелёк не поддерживает подпись сообщений");
      }
      const result = await provider.signMessage(new TextEncoder().encode(message), "utf8");
      const signature = result?.signature || result;
      return btoa(String.fromCharCode(...new Uint8Array(signature)));
    },
    signAndSend: async (txBase64: string, intent?: TransactionIntent) => {
      const tx = decodeTransaction(txBase64);
      if (!provider.publicKey) throw new Error("NEED_WALLET");
      const user = new PublicKey(provider.publicKey.toString());
      const { guardTransaction, getAofGuardConfig } = await import("./txGuard");
      const guard = await guardTransaction(tx, user, { ...getAofGuardConfig(), intent });
      if (!guard.safe) throw new Error(guard.reason || "Transaction rejected by wallet guard");
      if (!provider.publicKey || !new PublicKey(provider.publicKey.toString()).equals(user)) {
        throw new Error("Wallet changed during transaction verification");
      }
      const { signature } = await provider.signAndSendTransaction(tx);
      await confirmSignature(connection, signature);
      return signature;
    },
  };
}

export async function signAndSendTx(txBase64: string, intent?: TransactionIntent): Promise<string> {
  const adapter = createWalletAdapter();
  if (!adapter.available) {
    throw new Error("NEED_WALLET");
  }
  return adapter.signAndSend(txBase64, intent);
}

export async function signWalletMessage(message: string): Promise<string> {
  const adapter = createWalletAdapter();
  if (!adapter.available) throw new Error("NEED_WALLET");
  return adapter.signMessage(message);
}

const WALLET_PROOF_DOMAIN = (import.meta as any).env?.VITE_WALLET_PROOF_DOMAIN || "NEUROFORGE_API";

export interface WalletProof {
  message: string;
  signature: string;
}

/**
 * Sign a one-time proof for a backend mutation. The backend fixes the
 * operation subject per route and rejects stale or previously consumed
 * messages, so callers must create a fresh proof for every request.
 */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .filter((key) => object[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
      .join(",")}}`;
  }
  const encoded = JSON.stringify(value);
  return encoded === undefined ? "null" : encoded;
}

async function digestWalletPayload(payload: Record<string, unknown>): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(payload));
  // Cast the owned ArrayBuffer for TypeScript's stricter DOM typings; the
  // browser receives an immutable copy, not the mutable view's ArrayBufferLike.
  const digest = await crypto.subtle.digest("SHA-256", bytes.buffer as ArrayBuffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function createWalletProof(
  wallet: string,
  subject: string,
  payload: Record<string, unknown>,
  request: { method: string; target: string },
): Promise<WalletProof> {
  if (!wallet || !subject) throw new Error("Wallet and proof subject are required");
  const nonceBytes = new Uint8Array(16);
  crypto.getRandomValues(nonceBytes);
  const nonce = Array.from(nonceBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const digest = await digestWalletPayload({ ...request, body: payload });
  const message = `${WALLET_PROOF_DOMAIN}:${wallet}:${subject}:${digest}:${Date.now()}:${nonce}`;
  const signature = await signWalletMessage(message);
  return { message, signature };
}
