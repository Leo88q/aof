import "dotenv/config";
import { fetchRewardReceipt } from "../src/lib/rewardReceipt";
import { Connection } from "@solana/web3.js";
import { db } from "../src/lib/db";
import { reconcileInboxClaims } from "../src/lib/rewardReconciliation";

async function main() {
  if (!process.env.RPC_URL || !process.env.EXPECTED_GENESIS_HASH) {
    throw new Error("RPC_URL and EXPECTED_GENESIS_HASH are required; never reconcile against a different cluster");
  }
  const rpc = new Connection(process.env.RPC_URL, "finalized");
  if (await rpc.getGenesisHash() !== process.env.EXPECTED_GENESIS_HASH) throw new Error("Wrong Solana cluster");
  const name = "inbox-rewards-v1";
  const saved = await db.reconciliationCursor.findUnique({ where: { name } });
  const resolved = await reconcileInboxClaims(db, rpc, (id) => fetchRewardReceipt(rpc, id), 10, {
    cursor: saved?.lastId ?? undefined,
    checkpoint: async (lastId) => {
      await db.reconciliationCursor.upsert({ where: { name }, create: { name, lastId }, update: { lastId } });
    },
  });
  const quarantined = await db.inboxItem.count({ where: { claimState: "quarantined" } });
  console.log({ resolved, quarantined });
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => db.$disconnect());
