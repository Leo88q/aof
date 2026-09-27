/**
 * [F-06] Who signs the VRF settler's transactions.
 *
 * Every instruction the settler sends is permissionless: the reveals
 * (pack/reroll/exploration/forge/lottery/drum) and the refunds accept any
 * funded `cranker`, and the expire/refund variants need no signer at all. The
 * settler therefore does not need the operator key, which co-signs paid
 * commits, mints resources and grants season XP. It runs with a fee-only hot
 * wallet (VRF_SETTLER_SECRET_KEY_FILE) and AUTHORITY_MODE=read-only, so a
 * compromised settler host exposes a small SOL float, not the operator role.
 *
 * The wallet pays transaction fees and fronts the rent of the NFTs a reveal
 * creates (reimbursed by the reveal itself), so it only needs a float: the
 * settler warns below VRF_SETTLER_MIN_BALANCE_LAMPORTS.
 */
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { readSecret } from "../security/secretFiles";

export type SettlerSigner = { keypair: Keypair; source: "dedicated" | "operator" };

/** base58 (like AUTHORITY_SECRET_KEY) or the JSON array written by solana-keygen. */
export function parseSecretKey(raw: string): Keypair {
  const value = raw.trim();
  const bytes = value.startsWith("[") ? Uint8Array.from(JSON.parse(value) as number[]) : bs58.decode(value);
  if (bytes.length !== 64) throw new Error("VRF_SETTLER_SECRET_KEY must be a 64-byte Solana keypair");
  return Keypair.fromSecretKey(bytes);
}

/**
 * The dedicated settler wallet when configured. Outside production the
 * settler may fall back to the operator key (local development); production
 * refuses, so the operator key never has to reach the settler host.
 */
export function resolveSettlerSigner(
  operator: Keypair | null,
  env: NodeJS.ProcessEnv = process.env,
  isProduction = env.NODE_ENV === "production",
): SettlerSigner {
  const raw = readSecret("VRF_SETTLER_SECRET_KEY", env, isProduction);
  if (raw) {
    const keypair = parseSecretKey(raw);
    if (operator && keypair.publicKey.equals(operator.publicKey)) {
      throw new Error("VRF_SETTLER_SECRET_KEY must be a separate fee-only wallet, not the operator key");
    }
    return { keypair, source: "dedicated" };
  }
  if (isProduction) {
    throw new Error(
      "vrf-settler needs VRF_SETTLER_SECRET_KEY_FILE (a fee-only wallet) in production: reveal and refund " +
        "are permissionless and must not run with the operator key (see docker-compose.secrets.yml)",
    );
  }
  if (!operator) {
    throw new Error("vrf-settler needs VRF_SETTLER_SECRET_KEY(_FILE), or the operator key in AUTHORITY_MODE=hot");
  }
  return { keypair: operator, source: "operator" };
}

/**
 * A standby settler (second host, own wallet and RPC) only touches commits
 * older than VRF_SETTLER_STANDBY_SLOTS, so it stays idle while the primary
 * settles within seconds and takes over when the primary is down. It must act
 * well before the commit routes' circuit breaker (VRF_MAX_PENDING_SLOTS, 450).
 */
export function settlerStandbySlots(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.VRF_SETTLER_STANDBY_SLOTS;
  if (raw === undefined || raw.trim() === "") return 0;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) throw new Error("VRF_SETTLER_STANDBY_SLOTS must be a non-negative integer");
  const breaker = Number(env.VRF_MAX_PENDING_SLOTS) > 0 ? Number(env.VRF_MAX_PENDING_SLOTS) : 450;
  if (value >= breaker) {
    throw new Error(`VRF_SETTLER_STANDBY_SLOTS (${value}) must stay below VRF_MAX_PENDING_SLOTS (${breaker})`);
  }
  return value;
}
