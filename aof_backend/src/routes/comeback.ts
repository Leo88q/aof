import { Router } from "express";
import { requireIdempotency } from "../middleware/security";
import { requireWalletProof } from "../security/walletProof";

const r = Router();

// Comeback rewards previously created local bonus records before a canonical
// reward instruction existed. Keep every entry point unavailable rather than
// showing or consuming an unbacked reward.
r.post("/check", requireWalletProof("comeback_check", "user"), (_req, res) => {
  res.status(503).json({
    error: "COMEBACK_REWARDS_UNAVAILABLE_UNTIL_CANONICAL_INSTRUCTION_IS_DEPLOYED",
  });
});

r.get("/:user", (_req, res) => {
  res.status(503).json({
    error: "COMEBACK_REWARDS_UNAVAILABLE_UNTIL_CANONICAL_INSTRUCTION_IS_DEPLOYED",
  });
});

r.post("/claim", requireWalletProof("comeback_claim", "user"), requireIdempotency, (_req, res) => {
  res.status(503).json({
    error: "COMEBACK_REWARDS_UNAVAILABLE_UNTIL_CANONICAL_INSTRUCTION_IS_DEPLOYED",
  });
});

export default r;
