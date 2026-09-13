import "dotenv/config";
import { Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";

export const RPC_URL = process.env.RPC_URL || "https://api.devnet.solana.com";
export const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID!);
export const AUTHORITY: Keypair = Keypair.fromSecretKey(
  bs58.decode(process.env.AUTHORITY_SECRET_KEY!)
);
export const TREASURY = new PublicKey(process.env.TREASURY_PUBKEY!);
export const PORT = Number(process.env.PORT || 8080);
