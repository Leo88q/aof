import { createHash } from "crypto";
import { BorshAccountsCoder } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import idl from "../idl/aof_core.json";

const coreId = new PublicKey(idl.address);
const coder = new BorshAccountsCoder(idl as any);

export function inboxRewardId(id: string): Buffer {
  if (typeof id !== "string" || !id || id.length > 128) throw new Error("Invalid inbox ID");
  return createHash("sha256").update("AOF_INBOX_REWARD_V1\0").update(id, "utf8").digest();
}
export function rewardReceiptPda(id: string): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("reward_receipt"), inboxRewardId(id)], coreId)[0];
}

// Do not swallow RPC/decode/owner failures as 'missing'; only a null RPC account
// means absent. Receipt reads are finalized so DB repair survives fork rollback.
export async function fetchRewardReceipt(rpc: Pick<Connection, "getAccountInfo">, id: string) {
  const info = await rpc.getAccountInfo(rewardReceiptPda(id), "finalized");
  if (!info) return null;
  if (!info.owner.equals(coreId) || info.executable) throw new Error("Invalid reward receipt owner");
  const receipt: any = coder.decode("RewardReceipt", info.data);
  if (!Buffer.from(receipt.rewardId ?? receipt.reward_id).equals(inboxRewardId(id))) throw new Error("Reward ID mismatch");
  return {
    recipient: (receipt.recipient as PublicKey).toBase58(),
    mint: (receipt.mint as PublicKey).toBase58(),
    grossAmount: String(receipt.grossAmount ?? receipt.gross_amount),
  };
}
export class RewardReceiptConflict extends Error {
  constructor() { super("Reward receipt conflicts with inbox payout; manual investigation required"); this.name = "RewardReceiptConflict"; }
}
export function assertRewardReceipt(
  receipt: { recipient: string; mint: string; grossAmount: string },
  expected: { recipient: string; mint: string; grossAmount: string },
): void {
  if (receipt.recipient !== expected.recipient || receipt.mint !== expected.mint || receipt.grossAmount !== expected.grossAmount) {
    throw new RewardReceiptConflict();
  }
}
