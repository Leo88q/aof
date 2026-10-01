import { Router } from "express";
import { requireWalletProof } from "../security/walletProof";

const r = Router();

// The social action previously recorded an off-chain row while its promised
// trust/harvest bonuses were not applied canonically. Keep it fail-closed.
r.post("/power", requireWalletProof("friend_power", "power"), (_req, res) => {
  res.status(503).json({
    error: "FRIEND_POWER_UNAVAILABLE_UNTIL_CANONICAL_SOCIAL_BONUS_IS_DEPLOYED",
  });
});

export default r;
