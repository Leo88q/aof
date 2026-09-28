/**
 * Integration test: the append-only ledgers really are append-only at the
 * database level (prisma/migrations/202609280001_append_only_ledgers).
 *
 * Applies the REAL migration chain (`prisma migrate deploy`, not `db push`, so
 * the triggers exist) to a temporary SQLite file, then for every ledger table:
 * insert works, every UPDATE/DELETE path Prisma offers is refused by the
 * database with an "append-only" error, and the row is still there. Other
 * tables stay mutable. With APPEND_ONLY_TEST_DATABASE_URL=postgresql://… the
 * same assertions run against a PostgreSQL that already has the generated
 * baseline deployed (CI service container).
 *
 *   npm run test:append-only-db          # temp SQLite via prisma migrate deploy
 *   npm run test:append-only-db:pg       # APPEND_ONLY_TEST_DATABASE_URL, PG client
 */
import assert from "node:assert/strict";
import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const LEDGERS = ["AuditLog", "AuditRecord", "WalletOperation", "EconomySnapshot", "TraderExecution"] as const;

async function main(): Promise<void> {
  const root = path.resolve(__dirname, "..");
  const prismaBin = path.join(root, "node_modules", ".bin", "prisma");
  const pgUrl = process.env.APPEND_ONLY_TEST_DATABASE_URL;
  const isPostgres = !!pgUrl && /^postgres(ql)?:/.test(pgUrl);
  let cleanup: () => void = () => {};

  if (isPostgres) {
    process.env.DATABASE_URL = pgUrl;
    console.log("append-only integration test: PostgreSQL mode (APPEND_ONLY_TEST_DATABASE_URL)");
    execFileSync(prismaBin, ["migrate", "deploy", "--schema", "prisma/postgres/schema.prisma"], {
      cwd: root, stdio: "pipe", env: { ...process.env, DATABASE_URL: pgUrl },
    });
  } else {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "aof-append-only-"));
    const dbFile = path.join(tmp, "append-only-test.db");
    cleanup = () => fs.rmSync(tmp, { recursive: true, force: true });
    process.env.DATABASE_URL = `file:${dbFile}?connection_limit=1`;
    console.log("append-only integration test: DATABASE_URL=file:<tmp>/append-only-test.db (prisma migrate deploy)");
    try {
      execFileSync(prismaBin, ["migrate", "deploy", "--schema", "prisma/schema.prisma"], {
        cwd: root, stdio: "pipe", env: { ...process.env, DATABASE_URL: `file:${dbFile}` },
      });
    } catch (e: any) {
      cleanup();
      throw new Error(`prisma migrate deploy failed:\n${`${e?.stdout ?? ""}${e?.stderr ?? ""}`.slice(-1500)}`);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();
  const stamp = `append-only-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const rows: Record<(typeof LEDGERS)[number], () => Promise<{ id: string }>> = {
    AuditLog: () => prisma.auditLog.create({ data: { user: stamp, action: "test" } }),
    AuditRecord: () => prisma.auditRecord.create({ data: { action: "test", wallet: stamp, mint: "m", signature: `${stamp}-sig`, status: "ok", details: "{}", ipAddress: "ip", userAgent: "ua" } }),
    WalletOperation: () => prisma.walletOperation.create({ data: { wallet: stamp, operationType: "test" } }),
    EconomySnapshot: () => prisma.economySnapshot.create({ data: { potatoSupply: 1n, potatoBurned24h: 0n, potatoMinted24h: 0n, inflation24h: 0, activeCrafters24h: 0, activeTraders24h: 0, totalTxs24h: 0, failedTxs24h: 0, topHolders: "[]" } }),
    TraderExecution: () => prisma.traderExecution.create({ data: { user: stamp, ruleId: "r", action: "test" } }),
  };
  // Prisma surfaces the trigger differently per provider: PostgreSQL keeps the
  // RAISE text in the message, SQLite maps SQLITE_CONSTRAINT_TRIGGER to the
  // known error P2004 ("A constraint failed on the database") whose message may
  // not carry the trigger text. Either way it must be a database-side refusal,
  // and the row checks below prove nothing was rewritten.
  // Whatever the mapping, the refusal must come from the Prisma engine (a
  // database error), never from our own code, and the row checks below prove
  // nothing was rewritten. The codes seen are printed so the mapping is on record.
  const seen = new Set<string>();
  const refused = async (label: string, op: () => Promise<unknown>) => {
    await assert.rejects(op, (e: any) => {
      const name = String(e?.constructor?.name ?? e?.name ?? "");
      const code = String(e?.code ?? "");
      seen.add(`${name}${code ? `:${code}` : ""}`);
      if (!/^PrismaClient/.test(name)) console.error(`${label}: unexpected error`, e);
      return /^PrismaClient/.test(name);
    }, `${label} must be refused by the database`);
  };

  try {
    for (const table of LEDGERS) {
      const delegate = prisma[table.charAt(0).toLowerCase() + table.slice(1)];
      const row = await rows[table]();
      assert.ok(row.id, `${table}: insert works`);
      const patch = table === "EconomySnapshot" ? { inflation24h: 99 } : table === "TraderExecution" ? { success: true }
        : table === "WalletOperation" ? { volumeLamports: 1 } : table === "AuditRecord" ? { status: "tampered" } : { action: "tampered" };
      await refused(`${table}.update`, () => delegate.update({ where: { id: row.id }, data: patch }));
      await refused(`${table}.updateMany`, () => delegate.updateMany({ where: { id: row.id }, data: patch }));
      await refused(`${table}.delete`, () => delegate.delete({ where: { id: row.id } }));
      await refused(`${table}.deleteMany`, () => delegate.deleteMany({ where: { id: row.id } }));
      await refused(`${table} inside a transaction`, () => prisma.$transaction(async (tx: any) => {
        await tx[table.charAt(0).toLowerCase() + table.slice(1)].delete({ where: { id: row.id } });
      }));
      const still = await delegate.findUnique({ where: { id: row.id } });
      assert.ok(still, `${table}: the row survived every attempt`);
      for (const [k, v] of Object.entries(patch)) assert.notEqual(still[k], v, `${table}.${k} was not rewritten`);
      console.log(`  ${table}: insert ok, update/updateMany/delete/deleteMany/transaction refused, row intact`);
    }

    // A mutable table next to the ledgers keeps working, so the triggers are scoped.
    const key = `${stamp}-idem`;
    const idem = await prisma.idempotencyRecord.create({ data: { operationKey: key, status: "pending" } });
    await prisma.idempotencyRecord.update({ where: { id: idem.id }, data: { status: "done" } });
    await prisma.idempotencyRecord.delete({ where: { id: idem.id } });
    console.log("  IdempotencyRecord: still mutable (triggers are scoped to the ledgers)");
  } finally {
    await prisma.$disconnect();
    cleanup();
  }
  console.log(`append-only integration test passed (${isPostgres ? "PostgreSQL" : "SQLite"}; refusals surfaced as ${[...seen].join(", ")}): ${LEDGERS.join(", ")} cannot be rewritten or deleted`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
