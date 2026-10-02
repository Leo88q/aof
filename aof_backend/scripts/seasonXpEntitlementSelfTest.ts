import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  assertSeasonXpEntitlementShape,
  assertSeasonXpOwner,
  assertSeasonXpPending,
  assertSeasonXpTarget,
  expirySlotFrom,
  parseNewSeasonXpEntitlement,
  seasonXpCampaignDigest,
  seasonXpGenesisDigest,
  seasonXpSequenceKey,
} from "../src/lib/seasonXpEntitlement";

const input = parseNewSeasonXpEntitlement({
  player: "11111111111111111111111111111111",
  seasonId: 4,
  amount: 2_500,
  campaignId: "season-4-daily-01",
});
assert.equal(input.ttlSlots, 40_000, "the bounded default TTL is selected");
assert.equal(parseNewSeasonXpEntitlement({ ...input, ttlSlots: 150_000 }).ttlSlots, 150_000);
for (const bad of [
  { ...input, amount: 0 },
  { ...input, amount: 100_001 },
  { ...input, ttlSlots: 150_001 },
  { ...input, ttlSlots: 0 },
  { ...input, seasonId: -1 },
  { ...input, campaignId: "../admin" },
  { ...input, player: "x" },
]) assert.throws(() => parseNewSeasonXpEntitlement(bad), /INVALID_XP_ENTITLEMENT/);

const expectedCampaign = createHash("sha256")
  .update("AOF_SEASON_XP_CAMPAIGN_V1\0season-4-daily-01", "utf8").digest("hex");
const genesisA = "genesis-A-0123456789-abcdefghijklmnopqrstuvwxyz";
const genesisB = "genesis-B-0123456789-abcdefghijklmnopqrstuvwxyz";
const expectedGenesis = createHash("sha256")
  .update(`AOF_SEASON_XP_GENESIS_V1\0${genesisA}`, "utf8").digest("hex");
assert.equal(seasonXpCampaignDigest(input.campaignId), expectedCampaign);
assert.equal(seasonXpGenesisDigest(genesisA), expectedGenesis);
assert.notEqual(seasonXpCampaignDigest(input.campaignId), seasonXpGenesisDigest(genesisA),
  "domain separation prevents campaign/genesis digest reuse");
assert.notEqual(seasonXpGenesisDigest(genesisA), seasonXpGenesisDigest(genesisB),
  "genesis is cryptographically bound");

assert.equal(expirySlotFrom(100n, 150_000), "150100");
assert.throws(() => expirySlotFrom((1n << 64n) - 1n, 1), /INVALID_XP_ENTITLEMENT_EXPIRY/);

const record = {
  id: "11".repeat(32),
  clusterGenesisHash: genesisA,
  programId: "program-A",
  seasonId: input.seasonId,
  player: input.player,
  amount: input.amount,
  campaignId: input.campaignId,
  campaignDigest: expectedCampaign,
  nonce: 0,
  expirySlot: "150100",
  status: "pending",
};
assert.doesNotThrow(() => assertSeasonXpEntitlementShape(record));
assert.throws(() => assertSeasonXpEntitlementShape({ ...record, campaignId: "season-4-other" }), /INVALID_XP_ENTITLEMENT_RECORD/,
  "database tampering cannot substitute a campaign while retaining its signature digest");
assert.throws(() => assertSeasonXpEntitlementShape({ ...record, nonce: 0xffff_ffff }), /INVALID_XP_ENTITLEMENT_RECORD/,
  "u32::MAX is unavailable because the on-chain cursor stores nonce + 1");
assert.throws(() => assertSeasonXpEntitlementShape({ ...record, expirySlot: "18446744073709551616" }), /INVALID_XP_ENTITLEMENT_RECORD/);

assert.doesNotThrow(() => assertSeasonXpTarget(record, genesisA, "program-A"));
assert.throws(() => assertSeasonXpTarget(record, genesisB, "program-A"), /XP_CLAIM_WRONG_CLUSTER/);
assert.throws(() => assertSeasonXpTarget(record, genesisA, "program-B"), /XP_CLAIM_WRONG_PROGRAM/);
assert.doesNotThrow(() => assertSeasonXpOwner(record.player, record.player));
assert.throws(() => assertSeasonXpOwner(record.player, "another-player"), /XP_CLAIM_NOT_YOURS/);
assert.doesNotThrow(() => assertSeasonXpPending(record, 150_100n), "the expiry slot itself remains claimable");
assert.throws(() => assertSeasonXpPending(record, 150_101n), /XP_CLAIM_EXPIRED/);
assert.throws(() => assertSeasonXpPending({ ...record, status: "consumed" }, 150_100n), /XP_CLAIM_NOT_PENDING/);

const sequence = seasonXpSequenceKey(record);
assert.equal(sequence.length, 64);
assert.notEqual(sequence, seasonXpSequenceKey({ ...record, seasonId: record.seasonId + 1 }));
assert.notEqual(sequence, seasonXpSequenceKey({ ...record, player: "another-player" }));
assert.notEqual(sequence, seasonXpSequenceKey({ ...record, clusterGenesisHash: genesisB }));

console.log("season XP entitlement self-test passed (bounds, digest domains, target, owner, expiry, nonce, sequence scope)");
