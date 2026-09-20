import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { RPC_URL, AUTHORITY, PROGRAM_ID as CONFIG_PROGRAM_ID } from "./config";
import idl from "./idl/aof_core.json";
import marketIdl from "./idl/aof_market.json";
import questsIdl from "./idl/aof_quests.json";
import rebirthIdl from "./idl/aof_rebirth.json";
import liquidityIdl from "./idl/aof_liquidity.json";
import sessionIdl from "./idl/aof_session_keys.json";

export const connection = new Connection(RPC_URL, "confirmed");
export const wallet = new Wallet(AUTHORITY);
export const provider = new AnchorProvider(connection, wallet, {
  commitment: "confirmed",
});

const IDL_PROGRAM_ID = new PublicKey(idl.address);
if (!IDL_PROGRAM_ID.equals(CONFIG_PROGRAM_ID)) {
  throw new Error(
    `PROGRAM_ID does not match the canonical aof_core IDL address: ${CONFIG_PROGRAM_ID.toBase58()} != ${IDL_PROGRAM_ID.toBase58()}`,
  );
}

export const PROGRAM_ID = IDL_PROGRAM_ID;
export const program = new Program(idl as any, provider);

export const MARKET_PROGRAM_ID = new PublicKey(marketIdl.address);
export const marketProgram = new Program(marketIdl as any, provider);

export const QUESTS_PROGRAM_ID = new PublicKey(questsIdl.address);
export const questsProgram = new Program(questsIdl as any, provider);

export const REBIRTH_PROGRAM_ID = new PublicKey(rebirthIdl.address);
export const rebirthProgram = new Program(rebirthIdl as any, provider);

export const LIQUIDITY_PROGRAM_ID = new PublicKey(liquidityIdl.address);
export const liquidityProgram = new Program(liquidityIdl as any, provider);

export const SESSION_PROGRAM_ID = new PublicKey(sessionIdl.address);
export const sessionProgram = new Program(sessionIdl as any, provider);

let clusterVerified: Promise<void> | undefined;
export async function assertExpectedCluster(): Promise<void> {
  if (!process.env.EXPECTED_GENESIS_HASH) return; // production config requires it
  if (!clusterVerified) {
    clusterVerified = connection.getGenesisHash().then((actual) => {
      if (actual !== process.env.EXPECTED_GENESIS_HASH) throw new Error("Wrong Solana cluster");
    }).catch((error) => { clusterVerified = undefined; throw error; });
  }
  await clusterVerified;
}
