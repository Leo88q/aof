-- Persist only bounded XP entitlement metadata. No funds or player assets are held off-chain.
CREATE TABLE "SeasonXpEntitlement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clusterGenesisHash" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "seasonId" INTEGER NOT NULL,
    "player" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "campaignId" TEXT NOT NULL,
    "campaignDigest" TEXT NOT NULL,
    "nonce" INTEGER NOT NULL,
    "expirySlot" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "claimSignature" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumedAt" DATETIME
);

CREATE UNIQUE INDEX "season_xp_scope_nonce_uq"
    ON "SeasonXpEntitlement"("clusterGenesisHash", "programId", "seasonId", "player", "nonce");
CREATE UNIQUE INDEX "season_xp_campaign_uq"
    ON "SeasonXpEntitlement"("clusterGenesisHash", "programId", "seasonId", "player", "campaignId");
CREATE INDEX "season_xp_player_status_idx"
    ON "SeasonXpEntitlement"("clusterGenesisHash", "programId", "player", "seasonId", "status");

CREATE TABLE "SeasonXpNonceSequence" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "nextNonce" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
