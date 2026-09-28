-- Append-only ledgers (docs/REVIEW_DB_TESTS_LOAD_AI_2026-09-28.md §1.3).
--
-- The rows that prove what happened can be added, never rewritten or removed:
-- not by the API, not by an admin tool, not by a compromised worker that holds
-- the same database credentials. Enforced by the database itself, so a bug or
-- a stolen ADMIN_TOKEN cannot erase its own trace.
--
--   AuditLog         every mutating request, actor from wallet proof
--   AuditRecord      value-moving operations (signature, status, ip)
--   WalletOperation  per-wallet rate/volume counters
--   EconomySnapshot  economy monitor snapshots
--   TraderExecution  farm-trader simulation results
--
-- None of these tables has an UPDATE/DELETE call site in src/, services/ or
-- scripts/ (grep 2026-09-28). Retention is done by archiving whole database
-- snapshots (scripts/backup-db.sh), never by deleting rows in place.
--
-- The PostgreSQL equivalent lives in postgres.sql next to this file; the block
-- below is SQLite syntax and is skipped by scripts/gen-postgres-schema.py.
-- sqlite-only:begin
CREATE TRIGGER "AuditLog_append_only_update" BEFORE UPDATE ON "AuditLog"
BEGIN SELECT RAISE(ABORT, 'AuditLog is append-only'); END;
CREATE TRIGGER "AuditLog_append_only_delete" BEFORE DELETE ON "AuditLog"
BEGIN SELECT RAISE(ABORT, 'AuditLog is append-only'); END;

CREATE TRIGGER "AuditRecord_append_only_update" BEFORE UPDATE ON "AuditRecord"
BEGIN SELECT RAISE(ABORT, 'AuditRecord is append-only'); END;
CREATE TRIGGER "AuditRecord_append_only_delete" BEFORE DELETE ON "AuditRecord"
BEGIN SELECT RAISE(ABORT, 'AuditRecord is append-only'); END;

CREATE TRIGGER "WalletOperation_append_only_update" BEFORE UPDATE ON "WalletOperation"
BEGIN SELECT RAISE(ABORT, 'WalletOperation is append-only'); END;
CREATE TRIGGER "WalletOperation_append_only_delete" BEFORE DELETE ON "WalletOperation"
BEGIN SELECT RAISE(ABORT, 'WalletOperation is append-only'); END;

CREATE TRIGGER "EconomySnapshot_append_only_update" BEFORE UPDATE ON "EconomySnapshot"
BEGIN SELECT RAISE(ABORT, 'EconomySnapshot is append-only'); END;
CREATE TRIGGER "EconomySnapshot_append_only_delete" BEFORE DELETE ON "EconomySnapshot"
BEGIN SELECT RAISE(ABORT, 'EconomySnapshot is append-only'); END;

CREATE TRIGGER "TraderExecution_append_only_update" BEFORE UPDATE ON "TraderExecution"
BEGIN SELECT RAISE(ABORT, 'TraderExecution is append-only'); END;
CREATE TRIGGER "TraderExecution_append_only_delete" BEFORE DELETE ON "TraderExecution"
BEGIN SELECT RAISE(ABORT, 'TraderExecution is append-only'); END;
-- sqlite-only:end
