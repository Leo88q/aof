-- AOF Watchtower read model.
--
-- The exporter reads the chain-indexer ledger owned by aof_backend
-- (ChainTx / ChainEvent / ChainMintDelta / IndexerCursor, created by
-- aof_backend/prisma/migrations/202609210001_chain_indexer) plus FraudCase
-- (202609210002_fraud_cases). It creates no tables of its own; this file adds
-- the indexes the exporter's access patterns need and read-only views that
-- document exactly what leaves the game boundary.
--
-- Apply with the same database user AFTER the Prisma migrations. Portable
-- SQLite/PostgreSQL syntax; the exporter's DB role should be SELECT-only.

-- Forward-only event stream ordering used by /watchtower/events cursors.
CREATE INDEX IF NOT EXISTS "wt_chaintx_slot_signature" ON "ChainTx"("slot", "signature");
CREATE INDEX IF NOT EXISTS "wt_chainevent_wallet_blocktime" ON "ChainEvent"("wallet", "blockTime");
CREATE INDEX IF NOT EXISTS "wt_chainevent_blocktime_type" ON "ChainEvent"("blockTime", "eventType");
CREATE INDEX IF NOT EXISTS "wt_mintdelta_blocktime" ON "ChainMintDelta"("blockTime");
CREATE INDEX IF NOT EXISTS "wt_fraudcase_status_lastseen" ON "FraudCase"("status", "lastSeen");

-- First-seen per wallet: basis for cohorts, retention, PlayerJoined/FirstAction.
CREATE VIEW IF NOT EXISTS "wt_player_first_seen" AS
SELECT "wallet", MIN("blockTime") AS "firstSeen", MIN("slot") AS "firstSlot"
FROM "ChainEvent"
WHERE "wallet" IS NOT NULL AND "blockTime" IS NOT NULL
GROUP BY "wallet";

-- Per-day transaction health, as served by /watchtower/metrics/daily.
CREATE VIEW IF NOT EXISTS "wt_daily_tx" AS
SELECT substr(CAST("blockTime" AS TEXT), 1, 10) AS "day",
       SUM(CASE WHEN "success" THEN 1 ELSE 0 END) AS "txOk",
       SUM(CASE WHEN "success" THEN 0 ELSE 1 END) AS "txFailed",
       COUNT(DISTINCT "feePayer") AS "uniqueFeePayers"
FROM "ChainTx"
WHERE "blockTime" IS NOT NULL
GROUP BY substr(CAST("blockTime" AS TEXT), 1, 10);

-- Raw wallets never leave through views either: exporter hashes at read time.
