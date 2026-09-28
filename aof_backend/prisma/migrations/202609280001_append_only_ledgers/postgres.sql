-- PostgreSQL half of 202609280001_append_only_ledgers (appended to the
-- generated prisma/postgres/migrations/0_baseline by scripts/gen-postgres-schema.py).
CREATE OR REPLACE FUNCTION aof_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER "AuditLog_append_only" BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION aof_append_only();
CREATE TRIGGER "AuditRecord_append_only" BEFORE UPDATE OR DELETE ON "AuditRecord"
  FOR EACH ROW EXECUTE FUNCTION aof_append_only();
CREATE TRIGGER "WalletOperation_append_only" BEFORE UPDATE OR DELETE ON "WalletOperation"
  FOR EACH ROW EXECUTE FUNCTION aof_append_only();
CREATE TRIGGER "EconomySnapshot_append_only" BEFORE UPDATE OR DELETE ON "EconomySnapshot"
  FOR EACH ROW EXECUTE FUNCTION aof_append_only();
CREATE TRIGGER "TraderExecution_append_only" BEFORE UPDATE OR DELETE ON "TraderExecution"
  FOR EACH ROW EXECUTE FUNCTION aof_append_only();
