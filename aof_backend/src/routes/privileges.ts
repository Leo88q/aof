import { Router } from "express";

const r = Router();

// Privilege aggregation previously mixed on-chain NFT checks with local streak
// and trust fallbacks. Do not expose a combined access/discount map until all
// inputs are canonical and indexed.
r.get("/:user", (_req, res) => {
  res.status(503).json({
    error: "PRIVILEGES_UNAVAILABLE_UNTIL_CANONICAL_INDEXING_IS_DEPLOYED",
  });
});

export default r;
