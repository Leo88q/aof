/**
 * One-shot data copy SQLite -> PostgreSQL for the cut-over.
 *
 * Both databases must already be at the same schema level:
 *   sqlite : all prisma/migrations applied
 *   postgres: prisma/postgres/migrations/0_baseline applied (empty tables)
 *
 * Usage:
 *   SQLITE_URL=file:/abs/aof.db POSTGRES_URL=postgresql://... \
 *     npx ts-node --transpile-only scripts/migrate-sqlite-to-postgres.ts [--verify-only]
 *
 * Design:
 *  - Reads with better-sqlite3-free raw Prisma client pointed at SQLite, writes
 *    with a second Prisma client pointed at PostgreSQL. Two clients need two
 *    generated engines; this script therefore generates the PG client into a
 *    separate output dir on the fly (see PG_CLIENT_DIR) so the app's client is
 *    untouched.
 *  - Tables are copied in FK-safe order (parents first), in batches, inside
 *    one PG transaction per table. Failure = that table rolled back, script
 *    exits non-zero; rerun is safe because PG tables are truncated first.
 *  - Type coercion: SQLite returns Date for DATETIME via Prisma already;
 *    BigInt columns come back as bigint; JSON-as-TEXT columns are copied
 *    verbatim (schema keeps them TEXT on PG for now — see docs).
 *  - After copy: row counts per table must match exactly, plus a sample of
 *    the highest-risk tables (InboxItem, IdempotencyRecord, WalletOperation)
 *    is compared row-by-row by primary key.
 *
 * The API must be STOPPED during the copy: there is no CDC. See
 * docs/POSTGRES_MIGRATION.md for the full runbook.
 */
import { execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const SQLITE_URL = process.env.SQLITE_URL;
const POSTGRES_URL = process.env.POSTGRES_URL;
if (!SQLITE_URL || !POSTGRES_URL) {
  console.error("SQLITE_URL and POSTGRES_URL are required");
  process.exit(2);
}
const VERIFY_ONLY = process.argv.includes("--verify-only");
const BATCH = 1000;

// FK parents before children; everything else is independent.
const ORDER_FIRST = ["Guild", "ChainTx"];
const ORDER_LAST = ["GuildMember", "GuildActivity", "ChainEvent", "ChainMintDelta"];
// Highest-risk tables get a per-row comparison, not just a count.
const DEEP_VERIFY = ["InboxItem", "IdempotencyRecord", "WalletOperation", "ReconciliationCursor", "IndexerCursor"];

const ROOT = path.resolve(__dirname, "..");
const PG_CLIENT_DIR = path.join(ROOT, "node_modules", ".prisma", "client-postgres");

function generatePgClient(): void {
  // Generate a second client with the PG schema into its own directory.
  const tmpSchema = path.join(ROOT, "prisma", "postgres", ".schema.migrate.prisma");
  const src = fs.readFileSync(path.join(ROOT, "prisma", "postgres", "schema.prisma"), "utf8")
    .replace('provider = "prisma-client-js"', `provider = "prisma-client-js"\n  output   = "${PG_CLIENT_DIR.replace(/\\/g, "/")}"`);
  fs.writeFileSync(tmpSchema, src);
  try {
    execSync(`npx prisma generate --schema "${tmpSchema}"`, { stdio: "inherit", cwd: ROOT });
  } finally {
    fs.unlinkSync(tmpSchema);
  }
}

function modelNames(client: any): string[] {
  // Prisma exposes DMMF on the client; use it to enumerate models generically.
  const dmmf = (client as any)._runtimeDataModel ?? (client as any)._dmmf;
  const models = dmmf?.models ? Object.keys(dmmf.models) : Object.keys((client as any)._baseDmmf?.modelMap ?? {});
  if (models.length === 0) throw new Error("could not enumerate Prisma models from client");
  return models;
}

function delegate(client: any, model: string): any {
  const key = model.charAt(0).toLowerCase() + model.slice(1);
  const d = client[key];
  if (!d) throw new Error(`no delegate for model ${model}`);
  return d;
}

function orderTables(all: string[]): string[] {
  const set = new Set(all);
  const first = ORDER_FIRST.filter((t) => set.has(t));
  const last = ORDER_LAST.filter((t) => set.has(t));
  const mid = all.filter((t) => !first.includes(t) && !last.includes(t)).sort();
  return [...first, ...mid, ...last];
}

function pkOf(client: any, model: string): string[] {
  const dmmf = (client as any)._runtimeDataModel;
  const m = dmmf?.models?.[model];
  if (!m) return ["id"];
  const idField = m.fields.find((f: any) => f.isId);
  if (idField) return [idField.name];
  if (m.primaryKey?.fields?.length) return m.primaryKey.fields;
  return ["id"];
}

function stable(v: unknown): unknown {
  if (typeof v === "bigint") return v.toString();
  if (v instanceof Date) return v.toISOString();
  return v;
}

function rowsEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) if (JSON.stringify(stable(a[k])) !== JSON.stringify(stable(b[k]))) return false;
  return true;
}

async function main(): Promise<void> {
  if (!fs.existsSync(PG_CLIENT_DIR)) generatePgClient();
  const { PrismaClient: SqliteClient } = await import("@prisma/client");
  const { PrismaClient: PgClient } = await import(PG_CLIENT_DIR);
  const src: any = new SqliteClient({ datasources: { db: { url: SQLITE_URL } } });
  const dst: any = new PgClient({ datasources: { db: { url: POSTGRES_URL } } });

  const tables = orderTables(modelNames(src));
  console.log(`tables (${tables.length}):`, tables.join(", "));

  if (!VERIFY_ONLY) {
    // Truncate children first so FKs do not block; CASCADE covers the rest.
    const quoted = tables.map((t) => `"${t}"`).join(", ");
    await dst.$executeRawUnsafe(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`);

    for (const table of tables) {
      const s = delegate(src, table), d = delegate(dst, table);
      const total = await s.count();
      const pk = pkOf(src, table);
      let copied = 0;
      await dst.$transaction(async (trx: any) => {
        const td = delegate(trx, table);
        let cursor: Record<string, unknown> | undefined;
        while (true) {
          const rows = await s.findMany({
            take: BATCH,
            orderBy: pk.map((f) => ({ [f]: "asc" })),
            ...(cursor ? { skip: 1, cursor } : {}),
          });
          if (rows.length === 0) break;
          await td.createMany({ data: rows });
          copied += rows.length;
          const last = rows[rows.length - 1];
          cursor = pk.length === 1 ? { [pk[0]]: last[pk[0]] } : { [pk.join("_")]: Object.fromEntries(pk.map((f) => [f, last[f]])) };
          if (rows.length < BATCH) break;
        }
      }, { timeout: 10 * 60 * 1000 });
      console.log(`${table.padEnd(24)} ${String(copied).padStart(8)} / ${total}`);
      if (copied !== total) throw new Error(`${table}: copied ${copied} of ${total}`);
    }
  }

  // ---- verification ----
  let ok = true;
  for (const table of tables) {
    const [a, b] = await Promise.all([delegate(src, table).count(), delegate(dst, table).count()]);
    if (a !== b) { ok = false; console.error(`COUNT MISMATCH ${table}: sqlite=${a} postgres=${b}`); }
  }
  for (const table of DEEP_VERIFY.filter((t) => tables.includes(t))) {
    const pk = pkOf(src, table);
    const rows = await delegate(src, table).findMany({ orderBy: pk.map((f) => ({ [f]: "asc" })) });
    for (const row of rows) {
      const where = pk.length === 1 ? { [pk[0]]: row[pk[0]] } : { [pk.join("_")]: Object.fromEntries(pk.map((f) => [f, row[f]])) };
      const other = await delegate(dst, table).findUnique({ where });
      if (!other || !rowsEqual(row, other)) { ok = false; console.error(`ROW MISMATCH ${table} ${JSON.stringify(where)}`); }
    }
    console.log(`deep-verified ${table}: ${rows.length} rows`);
  }
  await src.$disconnect(); await dst.$disconnect();
  if (!ok) { console.error("VERIFICATION FAILED"); process.exit(1); }
  console.log(VERIFY_ONLY ? "verification passed" : "copy + verification passed");
}

main().catch((e) => { console.error(e); process.exit(1); });
