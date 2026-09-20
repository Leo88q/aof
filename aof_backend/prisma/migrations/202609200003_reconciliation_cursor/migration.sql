CREATE TABLE "ReconciliationCursor" (
    "name" TEXT NOT NULL PRIMARY KEY,
    "lastId" TEXT,
    "updatedAt" DATETIME NOT NULL
);
CREATE INDEX "InboxItem_claimState_id_idx" ON "InboxItem"("claimState", "id");
