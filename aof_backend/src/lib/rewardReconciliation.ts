import type { Connection } from "@solana/web3.js";
import type { InboxItem, PrismaClient } from "@prisma/client";
import { assertRewardReceipt, RewardReceiptConflict } from "./rewardReceipt";

/// [AUDIT F-28] The receipt tombstone is keyed by (recipient, reward_id), so a
/// reader that only knows the inbox id would look in the wrong namespace.
type ReceiptReader = (id: string, recipient: string) => Promise<{ recipient: string; mint: string; grossAmount: string } | null>;

/** Finalized receipt is authoritative for v1 rewards, even if a duplicate retry
 * signature failed. Never turn that failure into a second logical payout.
 * Keyset pagination advances past unresolved/pruned statuses to prevent the
 * first 100 rows from permanently starving later finalized payments. */
export async function reconcileInboxClaims(
  db: Pick<PrismaClient, "inboxItem">,
  rpc: Pick<Connection, "getSignatureStatuses">,
  readReceipt?: ReceiptReader,
  maxPages = 10,
  progress: { cursor?: string; checkpoint?: (cursor: string | null) => Promise<void> } = {},
): Promise<number> {
  let resolved = 0;
  let cursor = progress.cursor;
  for (let page = 0; page < maxPages; page++) {
    const rows: InboxItem[] = await db.inboxItem.findMany({
      where: { claimed: true, claimState: "submitted", claimSignature: { not: null }, ...(cursor ? { id: { gt: cursor } } : {}) },
      take: 100, orderBy: { id: "asc" },
    });
    if (!rows.length) {
      await progress.checkpoint?.(null); // wrap around on the next run
      break;
    }
    const result = await rpc.getSignatureStatuses(rows.map((row) => row.claimSignature!), { searchTransactionHistory: true });
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const status = result.value[i];
      let paid = false;
      if (row.rewardVersion === 1) {
        if (!readReceipt || !row.claimMint || !row.rewardAmount) continue;
        const receipt = await readReceipt(row.id, row.user); // throws on RPC/owner/decode error
        if (receipt) {
          try {
            assertRewardReceipt(receipt, {
              recipient: row.user, mint: row.claimMint,
              grossAmount: (BigInt(row.rewardAmount) * 1_000_000_000n).toString(),
            });
          } catch (error) {
            if (!(error instanceof RewardReceiptConflict)) throw error;
            // A single mismatched receipt must not starve every later row.
            // Quarantine, never reopen it; RPC/decode errors still abort safely.
            await db.inboxItem.updateMany({
              where: { id: row.id, claimed: true, claimState: "submitted", claimSignature: row.claimSignature },
              data: { claimState: "quarantined" },
            });
            continue;
          }
          paid = true;
        }
        // Successful signature without a receipt isn't a verified v1 reward.
        if (!paid && (!status?.err || status.confirmationStatus !== "finalized")) continue;
      } else {
        if (!status || status.confirmationStatus !== "finalized") continue;
        paid = !status.err;
      }
      const update = await db.inboxItem.updateMany({
        where: { id: row.id, claimed: true, claimState: "submitted", claimSignature: row.claimSignature },
        data: paid
          ? { claimed: true, claimState: "confirmed", read: true }
          : { claimed: false, claimState: "unclaimed", claimSignature: null },
      });
      resolved += update.count;
    }
    cursor = rows[rows.length - 1].id;
    await progress.checkpoint?.(rows.length < 100 ? null : cursor);
    if (rows.length < 100) break;
  }
  return resolved;
}
