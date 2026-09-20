import { Request, Response, NextFunction } from "express";
import { redactSensitive } from "../security/redaction";
import { db } from "../lib/db";

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
      logAction({
        user: req.body?.user || req.params?.user || "unknown",
        action,
        metadata: {
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

      logAction({
        user: req.body?.user || req.params?.user || "unknown",
        action,
        metadata: {
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
