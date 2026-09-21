-- Anti-fraud review queue (human-resolved; no automatic enforcement).
CREATE TABLE "FraudCase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wallet" TEXT NOT NULL,
    "signal" TEXT NOT NULL,
    "severity" INTEGER NOT NULL,
    "score" REAL NOT NULL,
    "evidence" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "openKey" TEXT,
    "firstSeen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hits" INTEGER NOT NULL DEFAULT 1,
    "resolvedBy" TEXT,
    "resolvedAt" DATETIME,
    "resolution" TEXT
);
CREATE UNIQUE INDEX "FraudCase_openKey_key" ON "FraudCase"("openKey");
CREATE INDEX "FraudCase_status_severity_lastSeen_idx" ON "FraudCase"("status", "severity", "lastSeen");
CREATE INDEX "FraudCase_wallet_idx" ON "FraudCase"("wallet");
