/**
 * Prisma-backed idempotency integration test.
 *
 * Runs src/security/idempotency.ts against a throwaway SQLite database created
 * by `prisma db push` (schema only, no data) and verifies the properties the
 * money-moving routes rely on:
 *
 *   1. N concurrent claims of one operationKey -> exactly one `allowed`, the
 *      rest are rejected by the unique constraint (P2002) or the in_progress
 *      short-circuit;
 *   2. a completed operation is reported as alreadyProcessed on replay;
 *   3. a failed operation can be reclaimed exactly once under concurrency
 *      (updateMany CAS on status);
 *   4. a stale in_progress operation (older than STALE_OPERATION_MS) can be
 *      reclaimed exactly once under concurrency;
 *   5. an in_progress operation younger than the stale window is not reclaimable.
 *
 * Usage (from aof_backend/):
 *   npm run test:idempotency-db                       # temp SQLite via prisma db push
 *   IDEMPOTENCY_TEST_DATABASE_URL=postgresql://... \
 *     npm run test:idempotency-db:pg                  # PostgreSQL: generate PG client,
 *                                                     # prisma migrate deploy (baseline), run
 *
 * Requirements: `prisma generate` and `prisma db push` must be able to run, i.e.
 * the Prisma engines must be available (they are in CI; in offline sandboxes
 * binaries.prisma.sh may be unreachable). When they are not, this script exits
 * non-zero with an explicit reason - it never reports success without running.
 */
import { strict as assert } from "assert";
import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

async function main(): Promise<void> {
  const root = path.resolve(__dirname, "..");
  const prismaBin = path.join(root, "node_modules", ".bin", "prisma");
  const pgUrl = process.env.IDEMPOTENCY_TEST_DATABASE_URL;
  const isPostgres = !!pgUrl && /^postgres(ql)?:/.test(pgUrl);
  let cleanup: () => void = () => {};

  if (isPostgres) {
    // PostgreSQL mode (CI service container). The generated Prisma client must
    // come from prisma/postgres/schema.prisma (a client generated for the
    // sqlite provider refuses a postgres URL), and the schema is applied with
    // the real baseline migration - so this run also proves the PG migration
    // set deploys cleanly, not just that the CAS works.
    process.env.DATABASE_URL = pgUrl;
    console.log("idempotency integration test: PostgreSQL mode (IDEMPOTENCY_TEST_DATABASE_URL)");
    try {
      execFileSync(prismaBin, ["migrate", "deploy", "--schema", "prisma/postgres/schema.prisma"], {
        cwd: root, stdio: "pipe", env: { ...process.env, DATABASE_URL: pgUrl },
      });
    } catch (e: any) {
      const out = `${e?.stdout ?? ""}${e?.stderr ?? ""}`;
      throw new Error(`prisma migrate deploy (postgres) failed:\n${out.slice(-1500)}`);
    }
  } else {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "aof-idem-"));
    const dbFile = path.join(tmp, "idempotency-test.db");
    cleanup = () => fs.rmSync(tmp, { recursive: true, force: true });
    // SQLite is single-writer. Prisma's own guidance for SQLite is
    // `connection_limit=1`; without it, concurrent writers through the pool
    // surface as "database is locked" instead of the unique-constraint P2002 the
    // CAS relies on. Production DATABASE_URL must carry the same parameter (see
    // aof_backend/.env.example and docs/DATABASE_MIGRATIONS.md).
    process.env.DATABASE_URL = `file:${dbFile}?connection_limit=1`;
    console.log(`idempotency integration test: DATABASE_URL=file:<tmp>/idempotency-test.db?connection_limit=1`);
    try {
      execFileSync(prismaBin, ["db", "push", "--schema", "prisma/schema.prisma", "--skip-generate", "--accept-data-loss"], {
        cwd: root,
        stdio: "pipe",
        env: { ...process.env, DATABASE_URL: `file:${dbFile}` },
      });
    } catch (e: any) {
      const out = `${e?.stdout ?? ""}${e?.stderr ?? ""}`;
      throw new Error(`prisma db push failed - Prisma engines unavailable or schema invalid:\n${out.slice(-1500)}`);
    }
  }

  // Import after DATABASE_URL is set so the singleton client binds to the temp DB.
  // `prisma db push` above has to see a plain file URL; the client gets the pooled one.
  const { db } = await import("../src/lib/db");
  const { checkIdempotency, completeIdempotency, failIdempotency } = await import("../src/security/idempotency");
  if (typeof (db as any).idempotencyRecord?.findUnique !== "function") {
    throw new Error("Prisma client has no idempotencyRecord delegate - run `prisma generate` first");
  }

  try {
    // PG databases persist across steps in CI; start from a clean table.
    await db.idempotencyRecord.deleteMany({ where: { operationKey: { startsWith: "itest:" } } });

    // 1. concurrent first claims -> exactly one winner
    const key1 = "itest:concurrent-claim";
    const results = await Promise.all(Array.from({ length: 32 }, () => checkIdempotency(key1)));
    assert.equal(results.filter((r) => r.allowed).length, 1, "exactly one concurrent claim must win");
    assert.equal(results.filter((r) => r.alreadyProcessed).length, 0);

    // 2. completed -> replay reports alreadyProcessed
    await completeIdempotency(key1, "ok");
    const replay = await checkIdempotency(key1);
    assert.deepEqual(replay, { allowed: false, alreadyProcessed: true });

    // 3. failed -> reclaimable exactly once under concurrency
    const key2 = "itest:failed-reclaim";
    assert.equal((await checkIdempotency(key2)).allowed, true);
    await failIdempotency(key2, "boom");
    const reclaims = await Promise.all(Array.from({ length: 16 }, () => checkIdempotency(key2)));
    assert.equal(reclaims.filter((r) => r.allowed).length, 1, "a failed op must be reclaimed by exactly one retry");
    const row2 = await db.idempotencyRecord.findUnique({ where: { operationKey: key2 } });
    assert.equal(row2?.status, "in_progress");

    // 4. stale in_progress -> reclaimable exactly once
    const key3 = "itest:stale-reclaim";
    assert.equal((await checkIdempotency(key3)).allowed, true);
    await db.idempotencyRecord.update({
      where: { operationKey: key3 },
      data: { createdAt: new Date(Date.now() - 16 * 60 * 1000) },
    });
    const stale = await Promise.all(Array.from({ length: 16 }, () => checkIdempotency(key3)));
    assert.equal(stale.filter((r) => r.allowed).length, 1, "a stale op must be reclaimed by exactly one caller");

    // 5. fresh in_progress -> not reclaimable
    const key4 = "itest:fresh-in-progress";
    assert.equal((await checkIdempotency(key4)).allowed, true);
    const fresh = await checkIdempotency(key4);
    assert.deepEqual(fresh, { allowed: false, alreadyProcessed: false });

    // FraudCase review queue: openKey uniqueness + resolve CAS (same migration set).
    await db.fraudCase.deleteMany({ where: { wallet: "itest-wallet" } });
    const { persistFindings } = await import("../src/lib/fraudSignals");
    const finding = { wallet: "itest-wallet", signal: "reward_velocity" as const, severity: 2 as const, score: 10, evidence: { n: 1 } };
    const first = await persistFindings([finding]);
    const second = await persistFindings([{ ...finding, severity: 3, score: 30 }]);
    assert.deepEqual([first.opened, second.opened, second.refreshed], [1, 0, 1], "one open case per (wallet, signal)");
    const open = await db.fraudCase.findMany({ where: { wallet: "itest-wallet", status: "open" } });
    assert.equal(open.length, 1);
    assert.deepEqual([open[0].hits, open[0].severity, open[0].score], [2, 3, 30]);
    const resolves = await Promise.all(["confirmed", "dismissed"].map((status) =>
      db.fraudCase.updateMany({ where: { id: open[0].id, status: "open" }, data: { status, openKey: null, resolvedBy: "itest", resolvedAt: new Date(), resolution: "x" } })));
    assert.equal(resolves.map((r) => r.count).reduce((a, b) => a + b, 0), 1, "exactly one reviewer wins the resolve CAS");
    const reopened = await persistFindings([finding]);
    assert.equal(reopened.opened, 1, "a new case can be opened after resolution (openKey freed)");
    assert.equal(await db.fraudCase.count({ where: { wallet: "itest-wallet" } }), 2);

    // Invalid key is rejected before touching the database.
    await assert.rejects(() => checkIdempotency(""), /Invalid idempotency key/);
    await assert.rejects(() => checkIdempotency("x".repeat(201)), /Invalid idempotency key/);

    console.log(`idempotency integration test (Prisma + ${isPostgres ? "PostgreSQL" : "SQLite"}): concurrent claim, replay, failed/stale reclaim CAS, fraud-case openKey/resolve CAS passed`);
  } finally {
    await db.$disconnect();
    cleanup();
  }
}

void main().catch((error) => {
  console.error("idempotency integration test FAILED:", error?.message ?? error);
  if (error?.code) console.error("prisma error code:", error.code);
  if (error?.stack) console.error(error.stack.split("\n").slice(0, 8).join("\n"));
  process.exitCode = 1;
});
