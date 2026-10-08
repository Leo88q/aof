import { LocalTxFeedbackError } from "./txResponseFeedback";
import { walletRuntimeCopy } from "../i18n/walletRuntimeCopy";
import { getApiErrorLanguage } from "./apiErrorLanguage";
import type { TransactionIntent } from "./transactionIntent";
import { confirmSignature } from "./confirmation";
import {
  Connection,
  PublicKey,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";

const walletText = () => walletRuntimeCopy[getApiErrorLanguage()];

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

/**
 * Wallet Standard (https://walletstandard.com): часть кошельков регистрируется
 * только в navigator.wallets и не оставляет window.phantom/backpack/solflare
 * (Coinbase Wallet и им подобные). Инжект держим в приоритете — он проверен
 * харнессом и не требует асинхронного реестра.
 */
function standardProvider(wallet: any) {
  let account: any = null;
  return {
    isStandard: true,
    name: typeof wallet.name === "string" && wallet.name ? wallet.name : "Standard wallet",
    connect: async () => {
      const feature = wallet.features?.["standard:connect"];
      if (typeof feature?.connect === "function") {
        const out = await feature.connect({ silent: false });
        account = out?.accounts?.[0] ?? account ?? null;
      }
      account = account || wallet.accounts?.[0] || null;
      if (!account?.address) throw new Error(walletText().missingAccount);
      return { publicKey: new PublicKey(account.address) };
    },
    disconnect: async () => {
      await wallet.features?.["standard:disconnect"]?.disconnect?.();
      account = null;
    },
    signMessage: async (message: Uint8Array) => {
      const feature = wallet.features?.["solana:signMessage"];
      if (typeof feature?.signMessage !== "function") {
        throw new Error(walletText().cannotSignMessage);
      }
      if (!account) throw new Error(walletText().notConnected);
      const out = await feature.signMessage({ message, account });
      const first = Array.isArray(out) ? out[0] : out;
      if (!first?.signature) throw new Error(walletText().missingSignature);
      return { signature: first.signature as Uint8Array };
    },
    signAndSendTransaction: async (tx: any) => {
      const feature = wallet.features?.["solana:signAndSendTransaction"];
      if (typeof feature?.signAndSendTransaction !== "function") {
        throw new Error(walletText().cannotSend);
      }
      if (!account) throw new Error(walletText().notConnected);
      const out = await feature.signAndSendTransaction(tx);
      const first = Array.isArray(out) ? out[0] : out;
      if (!first?.signature) throw new Error(walletText().missingTxSignature);
      return { signature: first.signature as string };
    },
  };
}

function detectWallet(): any {
  const w = window as any;
  if (w.phantom?.solana?.isPhantom) return w.phantom.solana;
  if (w.backpack) return w.backpack;
  if (w.solflare) return w.solflare;
  try {
    const registered = w.navigator?.wallets?.get?.();
    if (Array.isArray(registered) && registered.length > 0) {
      const solana = registered.filter(
        (x: any) =>
          Array.isArray(x?.chains) &&
          x.chains.some((c: any) => typeof c === "string" && c.startsWith("solana:"))
      );
      const preferred = ["Phantom", "Solflare", "Backpack", "Coinbase Wallet"];
      const picked =
        preferred.map((n) => solana.find((x: any) => x.name === n)).find(Boolean) || solana[0];
      if (picked) return standardProvider(picked);
    }
  } catch {
    // Битый реестр не должен ронять подключение: молча остаёмся без кошелька.
  }
  return null;
}

/** Есть ли поддерживаемый кошелёк (инжект или Wallet Standard). */
export function hasWalletSupport(): boolean {
  return detectWallet() !== null;
}

/** Мобильный браузер (iOS/Android): сюда имеет смысл показывать deep-link. */
export function isMobileBrowser(): boolean {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

/**
 * Browse-дееплинк Phantom: открывает текущую страницу во встроенном браузере
 * Phantom, где кошелёк уже инжектится как window.phantom.solana. Без сессии и
 * без ручной передачи параметров — как в документации Phantom (ul/browse).
 */
export function phantomBrowseLink(url?: string): string {
  const target = url || (typeof location !== "undefined" ? location.href : "");
  const ref = typeof location !== "undefined" && location.origin ? location.origin : "https://phantom.app";
  return `https://phantom.app/ul/browse/${encodeURIComponent(target)}?ref=${encodeURIComponent(ref)}`;
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
        throw new Error(walletText().notFound);
      },
      disconnect: async () => {},
      signMessage: async () => {
        throw new Error(walletText().unavailable);
      },
      signAndSend: async () => {
        throw new Error(walletText().unavailable);
      },
    };
  }

  return {
    available: true,
    name: provider.isStandard ? provider.name : provider.isPhantom ? "Phantom" : "Backpack",
    connect: async () => {
      const resp = await provider.connect();
      return new PublicKey(resp.publicKey.toString());
    },
    disconnect: async () => {
      await provider.disconnect();
    },
    signMessage: async (message: string) => {
      if (typeof provider.signMessage !== "function") {
        throw new Error(walletText().cannotSignMessage);
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
      if (!guard.safe) throw new LocalTxFeedbackError(guard.reason || walletText().unavailable);
      if (!provider.publicKey || !new PublicKey(provider.publicKey.toString()).equals(user)) {
        throw new Error("Wallet changed during transaction verification");
      }
      // The operator has already partially signed. Phantom's signAndSendTransaction
      // shows the approval and then fails inside the extension with JSON-RPC
      // -32603 and no signature, so the payment never reaches the cluster.
      // Ask the wallet only for the missing signature and broadcast the same
      // bytes through the game RPC that guardTransaction already simulated.
      const signature = await signThenBroadcast(provider, tx);
      try {
        await confirmSignature(connection, signature);
      } catch (cause) {
        // A submitted payment with an unknown confirmation must retain its
        // signature; otherwise callers can mistake it for a safe retry.
        const error = cause instanceof Error ? cause : new Error(String(cause));
        (error as Error & { signature?: string }).signature = signature;
        throw error;
      }
      return signature;
    },
  };
}


async function signThenBroadcast(provider: any, tx: Transaction | VersionedTransaction): Promise<string> {
  if (typeof provider.signTransaction !== "function") {
    const sent = await provider.signAndSendTransaction(tx);
    if (!sent?.signature || typeof sent.signature !== "string") throw new Error(walletText().missingTxSignature);
    return sent.signature;
  }
  const signed = await provider.signTransaction(tx);
  const raw = signed.serialize();
  return connection.sendRawTransaction(raw, { skipPreflight: false, preflightCommitment: "confirmed" });
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
