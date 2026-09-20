import { Request, Response, NextFunction } from "express";
import { redactSensitive } from "../security/redaction";
import { db } from "../lib/db";
import { resolveAdminRole } from "./adminAuth";

/**
 * Actor attribution for the audit log.
 *
 * Priority: wallet proven by signature (walletProof middleware) → admin token
 * role → unauthenticated. The request body is NOT trusted for the actor
 * field: any caller could write an arbitrary `user` there and forge history.
 * The body-supplied subject (if any) is kept separately in metadata as
 * `claimedUser`, so mismatches between actor and subject remain visible.
 */
export function resolveAuditActor(req: Request): { user: string; actorType: string } {
  const wallet = (req as any).authenticatedWallet;
  if (typeof wallet === "string" && wallet) return { user: wallet, actorType: "wallet" };
  const role = resolveAdminRole(req);
  if (role) return { user: `admin:${role}`, actorType: "admin" };
  return { user: "anonymous", actorType: "anonymous" };
}

function claimedSubject(req: Request): string | null {
  const v = req.body?.user ?? req.body?.owner ?? req.params?.user;
  return typeof v === "string" ? v : null;
}

/**
 * Sentinel middleware — логирует критичные действия игроков.
 * Хранит metadata как JSON-строку, потому что SQLite не поддерживает Json.
 */

type AuditInput = {
  user: string;
  action: string;
  metadata?: any;
  result?: string;
  txSig?: string;
  programId?: string;
  ip?: string;
  userAgent?: string;
};

async function logAction(data: AuditInput) {
  try {
    await db.auditLog.create({
      data: {
        user: data.user || "unknown",
        action: data.action,
        metadata: data.metadata ? JSON.stringify(redactSensitive(data.metadata)) : null,
        result: data.result || "unknown",
        txSig: data.txSig || null,
        programId: data.programId || null,
        ip: data.ip || null,
        userAgent: data.userAgent || null,
      },
    });
  } catch (e) {
    console.error("Failed to write audit log:", e);
  }
}

/**
 * Ручной audit для конкретного endpoint:
 * r.post("/craft", audit("craft"), handler)
 */
export function audit(action: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);

    res.json = (body: any) => {
      const actor = resolveAuditActor(req);
      logAction({
        user: actor.user,
        action,
        metadata: {
          actorType: actor.actorType,
          claimedUser: claimedSubject(req),
          method: req.method,
          path: req.path,
          body: redactSensitive(req.body),
          query: redactSensitive(req.query),
        },
        result: body?.error ? "fail" : "success",
        txSig: body?.signature || body?.sig || null,
        ip: req.ip,
        userAgent: req.get("user-agent"),
      }).catch((err) => console.error("Audit log error:", err));

      return originalJson(body);
    };

    next();
  };
}

/**
 * Автоматический Sentinel audit для всех mutating requests.
 * Логирует POST / PUT / PATCH / DELETE.
 */
export function sentinelAutoAudit() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const method = req.method.toUpperCase();

    // Логируем только изменяющие запросы
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      return next();
    }

    // Не логируем сам audit endpoint и health
    if (
      req.originalUrl.startsWith("/admin/audit") ||
      req.originalUrl.startsWith("/health")
    ) {
      return next();
    }

    const originalJson = res.json.bind(res);

    res.json = (body: any) => {
      const action = makeActionName(req);
      const actor = resolveAuditActor(req);

      logAction({
        user: actor.user,
        action,
        metadata: {
          actorType: actor.actorType,
          claimedUser: claimedSubject(req),
          method,
          path: req.path,
          body: redactSensitive(req.body),
          query: redactSensitive(req.query),
          statusCode: res.statusCode,
        },
        result: body?.error || res.statusCode >= 400 ? "fail" : "success",
        txSig: body?.signature || body?.sig || null,
        ip: req.ip,
        userAgent: req.get("user-agent"),
      }).catch((err) => console.error("Sentinel auto audit error:", err));

      return originalJson(body);
    };

    next();
  };
}

export async function manualAudit(data: {
  user: string;
  action: string;
  metadata?: any;
  result?: string;
  txSig?: string;
}) {
  await logAction(data);
}

function makeActionName(req: Request): string {
  return req.originalUrl
    .replace(/^\/+/, "")
    .replace(/[/?#].*$/, "")
    .replace(/\//g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .toLowerCase();
}
