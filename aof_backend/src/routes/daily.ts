import { Router } from "express";

const r = Router();

/**
 * Daily reward state used to come from a local streak row while the reward
 * itself had no on-chain mint. Do not expose that state as claimable game data.
 */
r.get("/status/:user", (_req, res) => {
  res.status(503).json({
    error: "DAILY_REWARDS_UNAVAILABLE_UNTIL_ONCHAIN_POTATO_REWARD_IS_DEPLOYED",
  });
});

r.post("/claim", (_req, res) => {
  res.status(503).json({
    error: "DAILY_REWARDS_UNAVAILABLE_UNTIL_ONCHAIN_POTATO_REWARD_IS_DEPLOYED",
  });
});

export default r;
