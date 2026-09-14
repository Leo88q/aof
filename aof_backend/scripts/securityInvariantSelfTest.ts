import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(__dirname, "../..");
const read = (relative: string) => fs.readFileSync(path.join(repo, relative), "utf8");
const section = (source: string, start: string, end: string) => {
  const startAt = source.indexOf(start);
  assert.notEqual(startAt, -1, `missing section: ${start}`);
  const endAt = source.indexOf(end, startAt + start.length);
  assert.notEqual(endAt, -1, `missing section end: ${end}`);
  return source.slice(startAt, endAt);
};

const core = read("aof-core/src/lib.rs");
const rental = read("aof-core/src/instructions/rental.rs");
const forge = read("aof-core/src/instructions/forge.rs");
const lottery = read("aof-core/src/instructions/lottery.rs");
const exploration = read("aof-core/src/instructions/exploration.rs");
const pack = read("aof-core/src/instructions/pack_open_commit.rs");
const randomReroll = read("aof-core/src/instructions/reroll_random.rs");
const questsDrum = read("programs/aof-quests/src/instructions/drum/drum_commit.rs");
const rebirth = read("programs/aof-rebirth/src/instructions/do_rebirth.rs");

// Rental regression: a listing must not hand out an active tool, and a sale
// cannot settle over an active rental and leave a stale operator behind.
const rentalStart = section(core, "pub struct RentalStartCtx", "pub struct RentalEndCtx");
const rentalRevoke = section(core, "pub struct RentalRevokeCtx", "pub struct InitMaterialMints");
assert.match(rentalStart, /constraint = !tool\.staked/);
assert.match(rentalStart, /constraint = !tool\.is_mining/);
assert.match(rentalStart, /constraint = tool\.owner == rental_listing\.owner/);
assert.match(rentalStart, /constraint = rental_listing\.mint == mint\.key\(\)/);
assert.doesNotMatch(rentalRevoke, /close = renter_refund/);
assert.match(rentalRevoke, /constraint = tool\.operator == rental_agreement\.renter/);
assert.match(rental, /rental_agreement\s*\.close\(ctx\.accounts\.renter_refund\.to_account_info\(\)\)/s);
assert.match(section(core, "pub struct MarketplaceBuy", "pub struct MarketplaceCancel"), /constraint = tool\.operator == tool\.owner/);
assert.match(section(core, "pub struct AuctionSettleCtx", "pub struct OfferCreateCtx"), /constraint = tool\.operator == tool\.owner/);
assert.match(rental, /let current_owner = ctx\.accounts\.tool\.owner;/g);
assert.equal((rental.match(/let current_owner = ctx\.accounts\.tool\.owner;/g) ?? []).length, 2);

// Paid commit/reveal flows with no on-chain expiry/refund path must fail closed
// in the program itself. API 503 responses alone are not a security boundary.
for (const [name, source] of [
  ["forge", forge],
  ["lottery", lottery],
  ["exploration", exploration],
  ["pack", pack],
  ["random reroll", randomReroll],
  ["drum", questsDrum],
  ["rebirth", rebirth],
] as const) {
  assert.match(source, /require!\(false, .*FeatureDisabled/,
    `${name} must fail closed on-chain`);
}

const coreIdl = JSON.parse(read("aof_backend/src/idl/aof_core.json"));
assert.ok(coreIdl.errors.some((error: any) => error.name === "FeatureDisabled"));
const questsIdl = JSON.parse(read("aof_backend/src/idl/aof_quests.json"));
assert.ok(questsIdl.errors.some((error: any) => error.name === "FeatureDisabled"));
const rebirthIdl = JSON.parse(read("aof_backend/src/idl/aof_rebirth.json"));
assert.ok(rebirthIdl.errors.some((error: any) => error.name === "FeatureDisabled"));

console.log("security invariant self-test: passed");
