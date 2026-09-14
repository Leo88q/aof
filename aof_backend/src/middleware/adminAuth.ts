import { timingSafeEqual } from "crypto";
import { Request, Response, NextFunction } from "express";

/**
 * Protects endpoints that sign transactions with the backend authority key or
 * mutate operational/security state.  The token is deliberately required at
 * runtime; there is no development fallback that would expose the authority.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const configured = process.env.ADMIN_TOKEN;
  if (!configured) {
    res.status(503).json({ error: "Admin API is unavailable: ADMIN_TOKEN is not configured" });
    return;
  }

  const authorization = req.header("authorization") || "";
  const bearer = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
  const supplied = bearer || req.header("x-admin-token") || "";
  const expected = Buffer.from(configured, "utf8");
  const actual = Buffer.from(supplied, "utf8");

  const valid = expected.length === actual.length && timingSafeEqual(expected, actual);
  if (!valid) {
    res.status(401).json({ error: "Admin authentication required" });
    return;
  }

  next();
}
