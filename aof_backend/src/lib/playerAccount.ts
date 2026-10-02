import { PublicKey } from "@solana/web3.js";
import { program } from "../provider";
import { playerPda } from "./pda";

/** A route must not turn RPC/IDL decode failures into "profile missing". */
export async function requireExistingPlayer(owner: PublicKey): Promise<void> {
  const [address] = playerPda(owner);
  // fetchNullable returns null only for a genuinely absent account. RPC errors,
  // wrong owners, and malformed account data remain errors and fail closed.
  const player = await (program.account as any).player.fetchNullable(address);
  if (!player) {
    const error = new Error("PLAYER_NOT_INITIALIZED");
    (error as Error & { status?: number }).status = 409;
    throw error;
  }
  if (!player.owner?.equals?.(owner)) {
    const error = new Error("PLAYER_ACCOUNT_OWNER_MISMATCH");
    (error as Error & { status?: number }).status = 409;
    throw error;
  }
}
