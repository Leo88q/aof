import "dotenv/config";
import { Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";

const isProduction = process.env.NODE_ENV === "production";
export const RPC_URL = process.env.RPC_URL || "https://api.devnet.solana.com";
if (isProduction && (!process.env.RPC_URL || /devnet|localhost|127\.0\.0\.1/i.test(RPC_URL))) {
  throw new Error("Production requires an explicit non-devnet RPC_URL");
}
if (!process.env.PROGRAM_ID || !process.env.AUTHORITY_SECRET_KEY || !process.env.TREASURY_PUBKEY) {
  throw new Error("PROGRAM_ID, AUTHORITY_SECRET_KEY and TREASURY_PUBKEY are required");
}
if (isProduction) {
  if (!process.env.ADMIN_TOKEN || process.env.ADMIN_TOKEN.length < 32) {
    throw new Error("Production requires a random ADMIN_TOKEN of at least 32 characters");
  }
  if (!process.env.EXPECTED_GENESIS_HASH) throw new Error("Production requires EXPECTED_GENESIS_HASH");
  if (!process.env.WALLET_PROOF_DOMAIN || !/^[A-Za-z0-9._-]{1,64}$/.test(process.env.WALLET_PROOF_DOMAIN)) {
    throw new Error("Production requires a deployment-specific WALLET_PROOF_DOMAIN");
  }
}
export const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID);
export const AUTHORITY: Keypair = Keypair.fromSecretKey(
  bs58.decode(process.env.AUTHORITY_SECRET_KEY)
);
export const TREASURY = new PublicKey(process.env.TREASURY_PUBKEY);
export const PORT = Number(process.env.PORT || 8080);

// Optional read-only admin credential (audit logs, economy snapshots, security
// stats). Must differ from the operator token, otherwise the split is moot.
export const ADMIN_READ_TOKEN = process.env.ADMIN_READ_TOKEN || "";
if (ADMIN_READ_TOKEN) {
  if (ADMIN_READ_TOKEN.length < 32) throw new Error("ADMIN_READ_TOKEN must be at least 32 characters");
  if (ADMIN_READ_TOKEN === process.env.ADMIN_TOKEN) throw new Error("ADMIN_READ_TOKEN must differ from ADMIN_TOKEN");
}

// Number of trusted reverse-proxy hops in front of Express (nginx, Caddy, a
// cloud load balancer). Rate limiting and audit IPs are derived from
// X-Forwarded-For only up to this depth; anything beyond is attacker-controlled.
// 0 disables proxy trust entirely. Production must set it explicitly so the
// per-IP limiter does not collapse every client into the proxy's address.
const trustProxyRaw = process.env.TRUST_PROXY_HOPS;
if (isProduction && (trustProxyRaw === undefined || trustProxyRaw === "")) {
  throw new Error("Production requires TRUST_PROXY_HOPS (0 if the app is exposed directly)");
}
export const TRUST_PROXY_HOPS = Number(trustProxyRaw ?? 0);
if (!Number.isInteger(TRUST_PROXY_HOPS) || TRUST_PROXY_HOPS < 0 || TRUST_PROXY_HOPS > 10) {
  throw new Error("TRUST_PROXY_HOPS must be an integer between 0 and 10");
}

// Mining remains fail-closed until the on-chain program and validator suite
// have been verified. Set explicitly in the test environment first; do not
// enable in production as part of a build-only deploy.
export const MINING_ENABLED = !isProduction && process.env.MINING_ENABLED === "true";
