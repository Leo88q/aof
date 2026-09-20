import { timingSafeEqual } from "crypto";
import { Request, Response, NextFunction } from "express";

/**
 * Admin authentication with two privilege levels.
 *
 *   ops  — ADMIN_TOKEN. Signs transactions with the backend authority key,
 *          mutates on-chain config, circuit breaker, allow-lists.
 *   read — ADMIN_READ_TOKEN (optional). Read-only access to audit logs,
 *          economy snapshots, security stats. Never accepted on ops routes.
 *
 * If ADMIN_READ_TOKEN is not configured, the ops token is the only credential
 * and is accepted on read routes too (backwards compatible). The token is
 * deliberately required at runtime; there is no development fallback that
 * would expose the authority.
 */

export type AdminRole = "ops" | "read";

declare global {
  namespace Express {
    interface Request {
      adminRole?: AdminRole;
    }
  }
}

function suppliedToken(req: Request): string {
  const authorization = req.header("authorization") || "";
  const bearer = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
  return bearer || req.header("x-admin-token") || "";
}

function tokenMatches(configured: string | undefined, supplied: string): boolean {
  if (!configured || !supplied) return false;
  const expected = Buffer.from(configured, "utf8");
  const actual = Buffer.from(supplied, "utf8");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Resolve the role of the presented credential, or null. */
export function resolveAdminRole(req: Request): AdminRole | null {
  const supplied = suppliedToken(req);
  if (tokenMatches(process.env.ADMIN_TOKEN, supplied)) return "ops";
  if (tokenMatches(process.env.ADMIN_READ_TOKEN, supplied)) return "read";
  return null;
}

function buildGuard(minimum: AdminRole) {
  return function guard(req: Request, res: Response, next: NextFunction): void {
    if (!process.env.ADMIN_TOKEN) {
      res.status(503).json({ error: "Admin API is unavailable: ADMIN_TOKEN is not configured" });
      return;
    }
    const role = resolveAdminRole(req);
    if (!role) {
      res.status(401).json({ error: "Admin authentication required" });
      return;
    }
    if (minimum === "ops" && role !== "ops") {
      res.status(403).json({ error: "Operator token required" });
      return;
    }
    req.adminRole = role;
    next();
  };
}

/** Full operator access (authority signing, config mutation). */
export const requireAdmin = buildGuard("ops");
/** Alias for readability at call sites that clearly mutate state. */
export const requireAdminOps = requireAdmin;
/** Read-only admin access: accepts either the read or the ops token. */
export const requireAdminRead = buildGuard("read");

/**
 * Router-level helper: GET/HEAD/OPTIONS need only the read token, every other
 * method needs the ops token. Use on admin routers that mix both.
 */
export function adminByMethod(req: Request, res: Response, next: NextFunction): void {
  const readOnly = req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS";
  return (readOnly ? requireAdminRead : requireAdmin)(req, res, next);
}

const isProduction = process.env.NODE_ENV === "production";

/**
 * Hard gate for endpoints that must never exist in production
 * (test grants, arbitrary relay, bulk manual minting). In production the
 * route answers 404 so its existence is not even confirmed.
 */
export function nonProductionOnly(_req: Request, res: Response, next: NextFunction): void {
  if (isProduction) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  next();
}
