-- On-chain event indexer tables + snapshot provenance column.
CREATE TABLE "ChainTx" (
    "signature" TEXT NOT NULL PRIMARY KEY,
    "slot" BIGINT NOT NULL,
    "blockTime" DATETIME,
    "success" BOOLEAN NOT NULL,
    "feePayer" TEXT NOT NULL,
    "programIds" TEXT NOT NULL,
    "errorJson" TEXT,
    "indexedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ChainTx_blockTime_idx" ON "ChainTx"("blockTime");
CREATE INDEX "ChainTx_success_blockTime_idx" ON "ChainTx"("success", "blockTime");
CREATE INDEX "ChainTx_feePayer_blockTime_idx" ON "ChainTx"("feePayer", "blockTime");

CREATE TABLE "ChainEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "signature" TEXT NOT NULL,
    "eventIndex" INTEGER NOT NULL,
    "slot" BIGINT NOT NULL,
    "blockTime" DATETIME,
    "programId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "wallet" TEXT,
    "walletHash" TEXT,
    "mint" TEXT,
    "amount" TEXT,
    "success" BOOLEAN NOT NULL,
    "data" TEXT NOT NULL,
    CONSTRAINT "ChainEvent_signature_fkey" FOREIGN KEY ("signature") REFERENCES "ChainTx" ("signature") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ChainEvent_signature_eventIndex_key" ON "ChainEvent"("signature", "eventIndex");
CREATE INDEX "ChainEvent_eventType_blockTime_idx" ON "ChainEvent"("eventType", "blockTime");
CREATE INDEX "ChainEvent_wallet_blockTime_idx" ON "ChainEvent"("wallet", "blockTime");
CREATE INDEX "ChainEvent_programId_slot_idx" ON "ChainEvent"("programId", "slot");

CREATE TABLE "ChainMintDelta" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "signature" TEXT NOT NULL,
    "mint" TEXT NOT NULL,
    "delta" TEXT NOT NULL,
    "blockTime" DATETIME,
    "slot" BIGINT NOT NULL,
    CONSTRAINT "ChainMintDelta_signature_fkey" FOREIGN KEY ("signature") REFERENCES "ChainTx" ("signature") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ChainMintDelta_signature_mint_key" ON "ChainMintDelta"("signature", "mint");
CREATE INDEX "ChainMintDelta_mint_blockTime_idx" ON "ChainMintDelta"("mint", "blockTime");

CREATE TABLE "IndexerCursor" (
    "programId" TEXT NOT NULL PRIMARY KEY,
    "newestSignature" TEXT,
    "oldestSignature" TEXT,
    "newestSlot" BIGINT,
    "backfillComplete" BOOLEAN NOT NULL DEFAULT false,
    "txIndexed" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "updatedAt" DATETIME NOT NULL
);

ALTER TABLE "EconomySnapshot" ADD COLUMN "fieldQuality" TEXT;
