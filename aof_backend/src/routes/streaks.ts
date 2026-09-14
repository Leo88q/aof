import { Router } from "express";
import { requireWalletProof } from "../security/walletProof";

const r = Router();

// Streak rewards were previously persisted in Prisma and could be claimed
// without an on-chain reward. Keep both paths fail-closed until a canonical
// streak/reward instruction and indexer are deployed.
r.post("/check-in", requireWalletProof("streak_check_in", "user"), (_req, res) => {
  res.status(503).json({
    error: "STREAK_REWARDS_UNAVAILABLE_UNTIL_CANONICAL_INSTRUCTION_IS_DEPLOYED",
  });
});

r.get("/:user", (_req, res) => {
  res.status(503).json({
    error: "STREAK_STATE_UNAVAILABLE_UNTIL_CANONICAL_INDEXING_IS_DEPLOYED",
  });
});

export default r;
