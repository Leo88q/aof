-- HISTORICAL TRANSITION: rename legacy Potato metric columns to canonical MIND fields.
-- This migration preserves existing EconomySnapshot values; it does not change token economics.
ALTER TABLE "EconomySnapshot" RENAME COLUMN "potatoSupply" TO "mindSupply";
ALTER TABLE "EconomySnapshot" RENAME COLUMN "potatoBurned24h" TO "mindBurned24h";
ALTER TABLE "EconomySnapshot" RENAME COLUMN "potatoMinted24h" TO "mindMinted24h";
