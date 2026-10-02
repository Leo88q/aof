-- Forward-only compatibility migration for existing PostgreSQL databases.
-- The generated 0_baseline also contains these models for fresh databases;
-- IF NOT EXISTS makes this safe for either migration history.
CREATE TABLE IF NOT EXISTS "SeasonXpEntitlement" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumedAt" TIMESTAMP(3),
    CONSTRAINT "SeasonXpEntitlement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "season_xp_scope_nonce_uq"
    ON "SeasonXpEntitlement"("clusterGenesisHash", "programId", "seasonId", "player", "nonce");
CREATE UNIQUE INDEX IF NOT EXISTS "season_xp_campaign_uq"
    ON "SeasonXpEntitlement"("clusterGenesisHash", "programId", "seasonId", "player", "campaignId");
CREATE INDEX IF NOT EXISTS "season_xp_player_status_idx"
    ON "SeasonXpEntitlement"("clusterGenesisHash", "programId", "player", "seasonId", "status");

CREATE TABLE IF NOT EXISTS "SeasonXpNonceSequence" (
    "key" TEXT NOT NULL,
    "nextNonce" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SeasonXpNonceSequence_pkey" PRIMARY KEY ("key")
);
