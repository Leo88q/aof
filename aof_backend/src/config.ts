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
if (isProduction && !process.env.ADMIN_TOKEN) {
  throw new Error("Production requires ADMIN_TOKEN");
}
export const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID);
export const AUTHORITY: Keypair = Keypair.fromSecretKey(
  bs58.decode(process.env.AUTHORITY_SECRET_KEY)
);
export const TREASURY = new PublicKey(process.env.TREASURY_PUBKEY);
export const PORT = Number(process.env.PORT || 8080);

// Mining remains fail-closed until the on-chain program and validator suite
// have been verified. Set explicitly in the test environment first; do not
// enable in production as part of a build-only deploy.
export const MINING_ENABLED = !isProduction && process.env.MINING_ENABLED === "true";
