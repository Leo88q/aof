# Database migrations, staging procedure and rollback plan

Backend datastore: Prisma 5 + SQLite (`aof_backend/prisma/schema.prisma`,
`datasource db { provider = "sqlite"; url = env("DATABASE_URL") }`).

## 1. What changed on 2026-09-15

| Before | After |
|---|---|
| `aof_backend/prisma/aof.db` (10 MB, operational data: 76 976 PriceTick, 285 AuditLog, 58 WalletOperation, 12 IdempotencyRecord, 6 TrustScore, ...) and `dev.db` were **tracked in Git** | Untracked (`git rm --cached`), covered by `aof_backend/.gitignore` (`prisma/*.db`). Files are still on disk and in Git history (`git show 486b252:aof_backend/prisma/aof.db`) - nothing was deleted. Local copies with checksums were saved to `~/aof-db-backup-2026-09-15/` before untracking. |
| No `prisma/migrations/` - schema only reproducible via `prisma db push` | `prisma/migrations/0_init/migration.sql` baseline (49 tables, 63 indexes, generated from the `db push` state and verified to apply to an empty SQLite database) + `migration_lock.toml` |
| No `.env.example` | `aof_backend/.env.example`, `frontend/.env.example` (no secret values) |

> The 285 AuditLog rows and 58 WalletOperation rows in the committed `aof.db`
> contain wallet addresses and IPs. They remain in Git history until the owner
> decides on a history rewrite (see §6); this document deliberately does not
> print any of that data.

## 2. Migration strategy

* **Source of truth:** `prisma/schema.prisma`. Every schema change ships with a
  migration directory produced by `prisma migrate dev --name <change>` on a
  developer machine and committed together with the code.
* **Baseline:** `0_init`. Existing databases that were created with
  `prisma db push` must be *marked* as already having the baseline, never
  re-applied:

  ```bash
  cd aof_backend
  DATABASE_URL=file:/abs/path/aof.db npx prisma migrate resolve --applied 0_init
  ```

* **CI check (blocking):** `npm run prisma:migrate:check` runs
  `prisma migrate diff --from-migrations ... --to-schema-datamodel ... --exit-code`
  and fails when the migrations folder and the schema diverge.
* **Deploy:** `npm run prisma:migrate:deploy` (`prisma migrate deploy`) - never
  `db push` against staging or production.
* **No destructive migrations without a two-step plan:** column drops and
  type changes go expand -> backfill -> contract across two releases.

## 3. Staging procedure (must be executed before any production deploy)

1. Provision a staging database file outside the repo, e.g.
   `DATABASE_URL=file:/var/lib/aof/staging.db`, on a host with the same
   Prisma engine platform as production (`debian-openssl-3.0.x`).
2. Restore a **copy** of the production database into staging
   (`sqlite3 prod.db ".backup staging.db"`), then anonymise `AuditLog.ip`,
   `AuditLog.userAgent`, `AuditRecord.ipAddress`, `AuditRecord.userAgent`.
3. Take a pre-migration snapshot: `sqlite3 staging.db ".backup staging.pre.db"`
   and record `sha256sum`.
4. `npm ci && npm run prisma:generate`
5. `npx prisma migrate status` - expect the baseline to be pending on a
   db-push database -> `npx prisma migrate resolve --applied 0_init`.
6. `npm run prisma:migrate:deploy` - exit code must be 0.
7. `npm run build && npm run test:wallet-proof && npm run test:resource-registry
   && npm run test:security-invariants && npm run test:idempotency-db`.
8. Start the backend with `NODE_ENV=production`, a staging `RPC_URL` (devnet is
   rejected in production mode, use a private RPC or `NODE_ENV=staging`),
   `ADMIN_TOKEN`, `AUTHORITY_SECRET_KEY` of the *staging* authority.
9. Smoke: `GET /health`, `GET /query/config`, one wallet-proofed POST with a
   reused idempotency key (expect the second call to be rejected), one
   unauthenticated `/admin/*` call (expect 401), one disabled route
   (`POST /packs/commit` -> 503 `PACK_COMMITS_DISABLED_UNTIL_EXPIRY_REFUND_WORKER_IS_DEPLOYED`).
10. Compare row counts of money-bearing tables before/after
    (`WalletOperation`, `IdempotencyRecord`, `CommitSecret`).

## 4. Rollback plan

### 4.1 Backend code
* Deploy is immutable per commit; roll back by redeploying the previous
  release tag. Keep the previous `dist/` and `node_modules/.prisma` alongside.

### 4.2 Database
SQLite has no online down-migrations; the rollback unit is the file snapshot.

1. Stop the backend and all workers (`indexer`, `trust-worker`, `farm-trader`,
   `price-cranker`, `push-worker`) - they share the file.
2. `sqlite3 live.db ".backup live.failed.db"` (preserve evidence).
3. Replace `live.db` with the pre-migration snapshot taken in §3 step 3 /
   the production equivalent, verify `sha256sum`.
4. `npx prisma migrate status` against the restored file must show the
   previous migration set as applied; if the failed migration is recorded,
   `npx prisma migrate resolve --rolled-back <name>`.
5. Redeploy the previous backend release, start workers, run the §3.9 smoke.
6. Any `IdempotencyRecord` in `in_progress` older than 15 min is reclaimable
   by design (`STALE_OPERATION_MS`); no manual cleanup needed. `CommitSecret`
   rows for disabled mechanics are inert.

### 4.3 On-chain programs
* Programs are upgradeable (`[test] upgradeable = true` mirrors production).
  Roll back with `solana program deploy --program-id <id> <previous>.so`
  using the archived `.so` of the previous release (CI artifact
  `anchor-target`, retention 7 days - archive it to long-term storage at
  release time).
* Config-level kill switch: `set_paused(true)` on `aof_core` blocks every
  instruction that carries `constraint = !config.paused`. `aof_market` has its
  own `set_paused`.
* Never roll back a program to a version whose account layouts differ from
  the accounts already written by the newer version.

### 4.4 Frontend
* Static bundle; roll back by re-publishing the previous build artifact.
  Not part of this branch: no Cloudflare/production action is performed here.

## 5. Environment variables

See `aof_backend/.env.example` and `frontend/.env.example`. Required in
production (enforced in `src/config.ts`): `RPC_URL` (non-devnet), `PROGRAM_ID`,
`AUTHORITY_SECRET_KEY`, `TREASURY_PUBKEY`, `ADMIN_TOKEN`, `DATABASE_URL`.

## 6. Open items for the owner

* Decide whether to purge `aof.db`/`dev.db` from Git history (BFG / `git filter-repo`).
  This rewrites history and needs a coordinated force-push, which this session
  is not allowed to perform.
* Decide on the long-term datastore: SQLite is single-writer; the workers and
  the API share one file. Postgres would allow `prisma migrate` with a shadow
  database and true concurrent writers.
