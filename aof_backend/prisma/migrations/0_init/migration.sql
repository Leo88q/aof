-- Baseline migration generated from the Prisma schema state (prisma db push output).
-- Verified in CI with: prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --exit-code

-- CreateTable
CREATE TABLE "AllowedMint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mint" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'free',
    "rateLimit" INTEGER NOT NULL DEFAULT 60,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" DATETIME
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" TEXT,
    "result" TEXT,
    "txSig" TEXT,
    "programId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT
);

-- CreateTable
CREATE TABLE "AuditRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "amount" REAL NOT NULL DEFAULT 0,
    "mint" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Candle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rarity" INTEGER NOT NULL,
    "timeframe" TEXT NOT NULL,
    "open" REAL NOT NULL,
    "high" REAL NOT NULL,
    "low" REAL NOT NULL,
    "close" REAL NOT NULL,
    "volume" REAL NOT NULL DEFAULT 0,
    "tsStart" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ChallengeScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "medals" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "CircuitBreaker" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "state" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ComebackBonus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user" TEXT NOT NULL,
    "absenceDays" INTEGER NOT NULL,
    "bonusType" TEXT NOT NULL,
    "claimed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ComebackRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user" TEXT NOT NULL,
    "lastSeen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalAbsences" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "CommitSecret" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "CompendiumEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user" TEXT NOT NULL,
    "toolType" TEXT NOT NULL,
    "rarity" TEXT NOT NULL,
    "seenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "DeviceFingerprint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "firstSeen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "DeviceToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "EconomyAlert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" DATETIME
);

-- CreateTable
CREATE TABLE "EconomySnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "potatoSupply" BIGINT NOT NULL,
    "potatoBurned24h" BIGINT NOT NULL,
    "potatoMinted24h" BIGINT NOT NULL,
    "inflation24h" REAL NOT NULL,
    "activeCrafters24h" INTEGER NOT NULL,
    "activeTraders24h" INTEGER NOT NULL,
    "totalTxs24h" INTEGER NOT NULL,
    "failedTxs24h" INTEGER NOT NULL,
    "topHolders" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Energy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 20,
    "cap" INTEGER NOT NULL DEFAULT 20,
    "lastUpdate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "FarmBuilding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user" TEXT NOT NULL,
    "tileX" INTEGER NOT NULL,
    "tileY" INTEGER NOT NULL,
    "toolMint" TEXT NOT NULL,
    "type" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "FarmPlot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user" TEXT NOT NULL,
    "size" INTEGER NOT NULL DEFAULT 8,
    "tiles" TEXT NOT NULL DEFAULT '[]',
    "expandedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "FriendWatering" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "owner" TEXT NOT NULL,
    "waterer" TEXT NOT NULL,
    "wateredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bonusPct" INTEGER NOT NULL DEFAULT 1
);

-- CreateTable
CREATE TABLE "Guild" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "leaderId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "GuildActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guildId" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "amount" INTEGER,
    "ts" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuildActivity_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GuildMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guildId" TEXT NOT NULL,
    "user" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuildMember_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "operationKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "result" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME
);

-- CreateTable
CREATE TABLE "InboxItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "rewardType" TEXT,
    "rewardAmount" INTEGER,
    "expiresAt" DATETIME,
    "claimed" BOOLEAN NOT NULL DEFAULT false,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "LeaderboardEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "snapshotId" TEXT NOT NULL,
    "user" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "score" REAL NOT NULL,
    "proof" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "LeaderboardSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "period" TEXT NOT NULL,
    "periodId" INTEGER NOT NULL,
    "merkleRoot" TEXT NOT NULL,
    "totalEntries" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "LoreProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user" TEXT NOT NULL,
    "arcId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "NeighborVisit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "visitor" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "ts" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "NotificationQueue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "payload" TEXT,
    "sent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "OnboardingState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user" TEXT NOT NULL,
    "step" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "PlayerProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "address" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PlayerRating" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fromUser" TEXT NOT NULL,
    "toUser" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "referenceId" TEXT,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "stakeWeight" REAL NOT NULL DEFAULT 1.0
);

-- CreateTable
CREATE TABLE "PriceAlert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user" TEXT NOT NULL,
    "rarity" TEXT,
    "currency" TEXT,
    "direction" TEXT,
    "threshold" REAL NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PriceTick" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rarity" INTEGER NOT NULL,
    "priceMascot" REAL NOT NULL,
    "priceSol" REAL NOT NULL,
    "side" TEXT,
    "mint" TEXT,
    "ts" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user" TEXT NOT NULL,
    "nickname" TEXT,
    "avatar" TEXT,
    "title" TEXT,
    "showcase" TEXT NOT NULL DEFAULT '[]'
);

-- CreateTable
CREATE TABLE "QuestProgressDb" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user" TEXT NOT NULL,
    "questId" INTEGER NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ReferralHolding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "referrer" TEXT NOT NULL,
    "referred" TEXT NOT NULL,
    "rewardType" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "availableAt" DATETIME NOT NULL,
    "claimed" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "ReferralStatsDb" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user" TEXT NOT NULL,
    "directCount" INTEGER NOT NULL DEFAULT 0,
    "l2Count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Streak" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user" TEXT NOT NULL,
    "current" INTEGER NOT NULL DEFAULT 0,
    "longest" INTEGER NOT NULL DEFAULT 0,
    "lastLogin" DATETIME
);

-- CreateTable
CREATE TABLE "SybilFlag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "severity" INTEGER NOT NULL DEFAULT 1,
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    "active" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Territory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "territoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "guildId" TEXT,
    "bonusType" TEXT,
    "contestedAt" DATETIME
);

-- CreateTable
CREATE TABLE "TraderExecution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "mint" TEXT,
    "price" REAL,
    "signature" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "ts" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TraderRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "rarity" INTEGER,
    "toolType" TEXT,
    "currency" TEXT,
    "threshold" REAL,
    "direction" TEXT,
    "maxSpendPerDay" REAL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TrustBreakdown" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "tier" INTEGER NOT NULL DEFAULT 1,
    "components" TEXT NOT NULL DEFAULT '{}',
    "computedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TrustFlag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user" TEXT NOT NULL,
    "flagType" TEXT NOT NULL,
    "mult" REAL NOT NULL,
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    "active" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "TrustScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "tier" INTEGER NOT NULL DEFAULT 1,
    "ageScore" INTEGER NOT NULL DEFAULT 0,
    "referralScore" INTEGER NOT NULL DEFAULT 0,
    "traderScore" INTEGER NOT NULL DEFAULT 75,
    "stakingScore" INTEGER NOT NULL DEFAULT 0,
    "rebirthScore" INTEGER NOT NULL DEFAULT 0,
    "guildScore" INTEGER NOT NULL DEFAULT 0,
    "compendiumScore" INTEGER NOT NULL DEFAULT 0,
    "questScore" INTEGER NOT NULL DEFAULT 0,
    "craftRepScore" INTEGER NOT NULL DEFAULT 0,
    "antiBotScore" INTEGER NOT NULL DEFAULT 50,
    "penaltyMult" REAL NOT NULL DEFAULT 1.0,
    "computedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "WalletOperation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wallet" TEXT NOT NULL,
    "operationType" TEXT NOT NULL,
    "volumeLamports" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Weather" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "type" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "WhaleAlert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "mint" TEXT,
    "amount" REAL NOT NULL,
    "price" REAL,
    "ts" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "AllowedMint_mint_key" ON "AllowedMint"("mint");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_key_key" ON "ApiKey"("key");

-- CreateIndex
CREATE INDEX "AuditLog_action_timestamp_idx" ON "AuditLog"("action", "timestamp");

-- CreateIndex
CREATE INDEX "AuditLog_txSig_idx" ON "AuditLog"("txSig");

-- CreateIndex
CREATE INDEX "AuditLog_user_timestamp_idx" ON "AuditLog"("user", "timestamp");

-- CreateIndex
CREATE INDEX "AuditRecord_action_createdAt_idx" ON "AuditRecord"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditRecord_status_createdAt_idx" ON "AuditRecord"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AuditRecord_wallet_createdAt_idx" ON "AuditRecord"("wallet", "createdAt");

-- CreateIndex
CREATE INDEX "Candle_rarity_timeframe_tsStart_idx" ON "Candle"("rarity", "timeframe", "tsStart");

-- CreateIndex
CREATE UNIQUE INDEX "Candle_rarity_timeframe_tsStart_key" ON "Candle"("rarity", "timeframe", "tsStart");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeScore_user_weekNumber_key" ON "ChallengeScore"("user", "weekNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ComebackBonus_user_absenceDays_key" ON "ComebackBonus"("user", "absenceDays");

-- CreateIndex
CREATE UNIQUE INDEX "ComebackRecord_user_key" ON "ComebackRecord"("user");

-- CreateIndex
CREATE INDEX "CommitSecret_expiresAt_idx" ON "CommitSecret"("expiresAt");

-- CreateIndex
CREATE INDEX "CommitSecret_key_idx" ON "CommitSecret"("key");

-- CreateIndex
CREATE UNIQUE INDEX "CommitSecret_key_key" ON "CommitSecret"("key");

-- CreateIndex
CREATE UNIQUE INDEX "CompendiumEntry_user_toolType_rarity_key" ON "CompendiumEntry"("user", "toolType", "rarity");

-- CreateIndex
CREATE INDEX "DeviceFingerprint_fingerprint_idx" ON "DeviceFingerprint"("fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceFingerprint_user_fingerprint_key" ON "DeviceFingerprint"("user", "fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceToken_token_key" ON "DeviceToken"("token");

-- CreateIndex
CREATE INDEX "DeviceToken_user_enabled_idx" ON "DeviceToken"("user", "enabled");

-- CreateIndex
CREATE INDEX "EconomyAlert_resolved_timestamp_idx" ON "EconomyAlert"("resolved", "timestamp");

-- CreateIndex
CREATE INDEX "EconomyAlert_timestamp_idx" ON "EconomyAlert"("timestamp");

-- CreateIndex
CREATE INDEX "EconomySnapshot_timestamp_idx" ON "EconomySnapshot"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "Energy_user_key" ON "Energy"("user");

-- CreateIndex
CREATE UNIQUE INDEX "FarmBuilding_user_tileX_tileY_key" ON "FarmBuilding"("user", "tileX", "tileY");

-- CreateIndex
CREATE UNIQUE INDEX "FarmPlot_user_key" ON "FarmPlot"("user");

-- CreateIndex
CREATE INDEX "FriendWatering_owner_idx" ON "FriendWatering"("owner");

-- CreateIndex
CREATE UNIQUE INDEX "FriendWatering_owner_waterer_wateredAt_key" ON "FriendWatering"("owner", "waterer", "wateredAt");

-- CreateIndex
CREATE INDEX "FriendWatering_waterer_idx" ON "FriendWatering"("waterer");

-- CreateIndex
CREATE UNIQUE INDEX "Guild_name_key" ON "Guild"("name");

-- CreateIndex
CREATE UNIQUE INDEX "GuildMember_guildId_user_key" ON "GuildMember"("guildId", "user");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_operationKey_idx" ON "IdempotencyRecord"("operationKey");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_operationKey_key" ON "IdempotencyRecord"("operationKey");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_status_createdAt_idx" ON "IdempotencyRecord"("status", "createdAt");

-- CreateIndex
CREATE INDEX "LeaderboardEntry_snapshotId_rank_idx" ON "LeaderboardEntry"("snapshotId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "LeaderboardEntry_snapshotId_user_key" ON "LeaderboardEntry"("snapshotId", "user");

-- CreateIndex
CREATE UNIQUE INDEX "LeaderboardSnapshot_period_periodId_key" ON "LeaderboardSnapshot"("period", "periodId");

-- CreateIndex
CREATE UNIQUE INDEX "LoreProgress_user_arcId_nodeId_key" ON "LoreProgress"("user", "arcId", "nodeId");

-- CreateIndex
CREATE INDEX "NotificationQueue_user_sent_idx" ON "NotificationQueue"("user", "sent");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingState_user_key" ON "OnboardingState"("user");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerProfile_address_key" ON "PlayerProfile"("address");

-- CreateIndex
CREATE INDEX "PlayerProfile_username_idx" ON "PlayerProfile"("username");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerProfile_username_key" ON "PlayerProfile"("username");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerRating_fromUser_toUser_context_referenceId_key" ON "PlayerRating"("fromUser", "toUser", "context", "referenceId");

-- CreateIndex
CREATE INDEX "PlayerRating_fromUser_toUser_idx" ON "PlayerRating"("fromUser", "toUser");

-- CreateIndex
CREATE INDEX "PlayerRating_toUser_timestamp_idx" ON "PlayerRating"("toUser", "timestamp");

-- CreateIndex
CREATE INDEX "PriceTick_rarity_ts_idx" ON "PriceTick"("rarity", "ts");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_user_key" ON "Profile"("user");

-- CreateIndex
CREATE UNIQUE INDEX "QuestProgressDb_user_questId_key" ON "QuestProgressDb"("user", "questId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralHolding_referrer_referred_rewardType_key" ON "ReferralHolding"("referrer", "referred", "rewardType");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralStatsDb_user_key" ON "ReferralStatsDb"("user");

-- CreateIndex
CREATE UNIQUE INDEX "Streak_user_key" ON "Streak"("user");

-- CreateIndex
CREATE INDEX "SybilFlag_user_active_idx" ON "SybilFlag"("user", "active");

-- CreateIndex
CREATE INDEX "Territory_guildId_idx" ON "Territory"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "Territory_territoryId_key" ON "Territory"("territoryId");

-- CreateIndex
CREATE INDEX "TraderExecution_user_ts_idx" ON "TraderExecution"("user", "ts");

-- CreateIndex
CREATE INDEX "TraderRule_user_type_idx" ON "TraderRule"("user", "type");

-- CreateIndex
CREATE UNIQUE INDEX "TrustBreakdown_user_key" ON "TrustBreakdown"("user");

-- CreateIndex
CREATE INDEX "TrustFlag_user_active_idx" ON "TrustFlag"("user", "active");

-- CreateIndex
CREATE UNIQUE INDEX "TrustScore_user_key" ON "TrustScore"("user");

-- CreateIndex
CREATE INDEX "WalletOperation_wallet_createdAt_idx" ON "WalletOperation"("wallet", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Weather_date_key" ON "Weather"("date");
