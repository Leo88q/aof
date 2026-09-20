ALTER TABLE "InboxItem" ADD COLUMN "claimState" TEXT NOT NULL DEFAULT 'unclaimed';
ALTER TABLE "InboxItem" ADD COLUMN "claimSignature" TEXT;
-- Do not assert success for legacy reservations without a chain receipt.
UPDATE "InboxItem" SET "claimState" = 'legacy_claimed' WHERE "claimed" = true;
