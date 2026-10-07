import { NextFunction, Request, Response } from "express";

/**
 * Paid season-pass sales stay closed unless an operator explicitly enables
 * them after release acceptance. Exact string matching is deliberate: missing,
 * malformed, or differently-cased values all fail closed.
 */
export function paidSeasonPassSalesEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.PAID_PASS_SALES_ENABLED === "true";
}

export function requirePaidSeasonPassSales(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!paidSeasonPassSalesEnabled()) {
    res.status(503).json({ error: "SEASON_PASS_SALES_CLOSED" });
    return;
  }
  next();
}
