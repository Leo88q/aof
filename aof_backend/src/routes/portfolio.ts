import { Router } from "express";

const r = Router();

/**
 * Portfolio valuation is intentionally unavailable until the backend can read
 * every canonical token/tool balance and value each asset from verified market
 * data. Returning a default rarity, zero resource value, or a hard-coded base
 * price would present an invented net worth to players.
 */
r.get("/:user", (_req, res) => {
  res.status(503).json({
    error: "PORTFOLIO_VALUATION_UNAVAILABLE_UNTIL_CANONICAL_INDEXING_IS_DEPLOYED",
  });
});

export default r;
