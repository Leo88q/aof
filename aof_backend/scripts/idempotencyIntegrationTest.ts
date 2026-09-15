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
 *   npm run test:idempotency-db
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
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "aof-idem-"));
  const dbFile = path.join(tmp, "idempotency-test.db");
  // SQLite is single-writer. Prisma's own guidance for SQLite is
  // `connection_limit=1`; without it, concurrent writers through the pool
  // surface as "database is locked" instead of the unique-constraint P2002 the
  // CAS relies on. Production DATABASE_URL must carry the same parameter (see
  // aof_backend/.env.example and docs/DATABASE_MIGRATIONS.md).
  process.env.DATABASE_URL = `file:${dbFile}?connection_limit=1`;
  console.log(`idempotency integration test: DATABASE_URL=file:<tmp>/idempotency-test.db?connection_limit=1`);

  const root = path.resolve(__dirname, "..");
  const prismaBin = path.join(root, "node_modules", ".bin", "prisma");
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

  // Import after DATABASE_URL is set so the singleton client binds to the temp DB.
  // `prisma db push` above has to see a plain file URL; the client gets the pooled one.
  const { db } = await import("../src/lib/db");
  const { checkIdempotency, completeIdempotency, failIdempotency } = await import("../src/security/idempotency");
  if (typeof (db as any).idempotencyRecord?.findUnique !== "function") {
    throw new Error("Prisma client has no idempotencyRecord delegate - run `prisma generate` first");
  }

  try {
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

    // Invalid key is rejected before touching the database.
    await assert.rejects(() => checkIdempotency(""), /Invalid idempotency key/);
    await assert.rejects(() => checkIdempotency("x".repeat(201)), /Invalid idempotency key/);

    console.log("idempotency integration test (Prisma + SQLite): concurrent claim, replay, failed/stale reclaim CAS passed");
  } finally {
    await db.$disconnect();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

void main().catch((error) => {
  console.error("idempotency integration test FAILED:", error?.message ?? error);
  if (error?.code) console.error("prisma error code:", error.code);
  if (error?.stack) console.error(error.stack.split("\n").slice(0, 8).join("\n"));
  process.exitCode = 1;
});
