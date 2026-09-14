import { Router } from "express";

const r = Router();

// Trading rules would grant automation limits from local profile/trust rows.
// Keep them unavailable until VIP/trust inputs are canonical and the worker
// execution path is verified against the on-chain market.
const unavailable = (_req: any, res: any) => {
  res.status(503).json({
    error: "TRADER_RULES_UNAVAILABLE_UNTIL_CANONICAL_VIP_TRUST_AND_EXECUTION_ARE_DEPLOYED",
  });
};

r.post("/create", unavailable);
r.get("/:user", unavailable);
r.post("/toggle", unavailable);
r.delete("/:id", unavailable);
r.get("/executions/:user", unavailable);

export default r;
