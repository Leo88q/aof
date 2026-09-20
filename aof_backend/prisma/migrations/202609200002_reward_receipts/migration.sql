-- Historical rewards may have been minted with the replayable legacy instruction.
-- Never automatically retry them against a fresh receipt; quarantine for review.
ALTER TABLE "InboxItem" ADD COLUMN "rewardVersion" INTEGER NOT NULL DEFAULT 1;
UPDATE "InboxItem" SET "rewardVersion" = 0;
ALTER TABLE "InboxItem" ADD COLUMN "claimMint" TEXT;
