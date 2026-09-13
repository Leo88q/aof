/**
 * Аудит критичных операций.
 * Все операции с деньгами/токенами логируются с полными деталями.
 * Позволяет расследовать инциденты пост-фактум.
 */
import { db } from "../lib/db";

export interface AuditEntry {
  action: string;
  wallet?: string;
  amount?: number;
  mint?: string;
  signature?: string;
  status: "initiated" | "success" | "failed" | "blocked";
  details?: string;
  ipAddress?: string;
  userAgent?: string;
}

export async function auditLog(entry: AuditEntry): Promise<void> {
  try {
    await db.auditRecord.create({
      data: {
        action: entry.action,
        wallet: entry.wallet || "",
        amount: entry.amount || 0,
        mint: entry.mint || "",
        signature: entry.signature || "",
        status: entry.status,
        details: entry.details?.slice(0, 2000) || "",
        ipAddress: entry.ipAddress || "",
        userAgent: entry.userAgent || "",
        createdAt: new Date(),
      },
    });
  } catch (e: any) {
    // Аудит не должен блокировать операцию
    console.error("[AUDIT_ERROR]", e.message);
  }
}

/**
 * Обёртка для операций с автоматическим аудитом.
 */
export async function withAudit<T>(
  entry: Omit<AuditEntry, "status">,
  fn: () => Promise<T>
): Promise<T> {
  await auditLog({ ...entry, status: "initiated" });

  try {
    const result = await fn();
    await auditLog({
      ...entry,
      status: "success",
      signature: (result as any)?.signature || (result as any)?.sig,
    });
    return result;
  } catch (e: any) {
    await auditLog({
      ...entry,
      status: "failed",
      details: e.message,
    });
    throw e;
  }
}

/**
 * Заблокировать подозрительную операцию и залогировать.
 */
export async function blockAndAudit(
  reason: string,
  entry: Omit<AuditEntry, "status">
): Promise<void> {
  await auditLog({
    ...entry,
    status: "blocked",
    details: reason,
  });
}
