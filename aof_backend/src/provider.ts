import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { RPC_URL, AUTHORITY } from "./config";
import idl from "./idl/aof_core.json";
import marketIdl from "./idl/aof_market.json";
import questsIdl from "./idl/aof_quests.json";
import rebirthIdl from "./idl/aof_rebirth.json";
import liquidityIdl from "./idl/aof_liquidity.json";

export const connection = new Connection(RPC_URL, "confirmed");
export const wallet = new Wallet(AUTHORITY);
export const provider = new AnchorProvider(connection, wallet, {
  commitment: "confirmed",
});

export const PROGRAM_ID = new PublicKey(idl.address);
export const program = new Program(idl as any, provider);

export const MARKET_PROGRAM_ID = new PublicKey(marketIdl.address);
export const marketProgram = new Program(marketIdl as any, provider);

export const QUESTS_PROGRAM_ID = new PublicKey(questsIdl.address);
export const questsProgram = new Program(questsIdl as any, provider);

export const REBIRTH_PROGRAM_ID = new PublicKey(rebirthIdl.address);
export const rebirthProgram = new Program(rebirthIdl as any, provider);

export const LIQUIDITY_PROGRAM_ID = new PublicKey(liquidityIdl.address);
export const liquidityProgram = new Program(liquidityIdl as any, provider);
