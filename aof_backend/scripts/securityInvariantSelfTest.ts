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
  ["lottery", lottery],
  ["exploration", exploration],
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

// IDL/source flag parity for the account that broke every real auction bid:
// auction_bid.previous_bidder receives lamports and must be writable in the
// IDL the backend and the test suite load.
const auctionBidIx = coreIdl.instructions.find((ix: any) => ix.name === "auction_bid");
assert.ok(auctionBidIx, "auction_bid missing from committed IDL");
assert.equal(auctionBidIx.accounts.find((a: any) => a.name === "previous_bidder")?.writable, true,
  "auction_bid.previous_bidder must be writable in aof_backend/src/idl/aof_core.json");
assert.match(section(core, "pub struct AuctionBidCtx", "pub struct AuctionSettleCtx"),
  /#\[account\(mut, address = auction\.current_bidder\)\]\s*pub previous_bidder/);

// Disabled mechanics must be reflected identically in every layer:
//   on-chain guard  ->  backend 503  ->  site content status:'soon'  ->  app notice.
const siteMechanics = read("frontend/src/site/content/mechanics.ts");
const appNotice = read("frontend/src/components/ui/FeatureDisabledNotice.tsx");
const siteStatus = (id: string) => {
  const m = siteMechanics.match(new RegExp(`\\{id:'${id}',name:'[^']*',status:'(live|soon)'`));
  assert.ok(m, `site mechanic ${id} missing from mechanics.ts`);
  return m![1];
};
const backendRoute = (file: string) => read(`aof_backend/src/routes/${file}`);
const disabledLayers: Array<{ id: string; route: string; code: RegExp; guard: [string, RegExp] }> = [
  { id: "lottery", route: "lottery.ts", code: /LOTTERY_TICKETS_DISABLED/, guard: ["aof-core/src/instructions/lottery.rs", /require!\(false, AofError::FeatureDisabled\)/] },
  { id: "exploration", route: "exploration.ts", code: /EXPLORATION_COMMITS_DISABLED/, guard: ["aof-core/src/instructions/exploration.rs", /require!\(false, AofError::FeatureDisabled\)/] },
  { id: "drum", route: "drum.ts", code: /DRUM_COMMITS_DISABLED/, guard: ["programs/aof-quests/src/instructions/drum/drum_commit.rs", /require!\(false, QuestError::FeatureDisabled\)/] },
  { id: "hot_market", route: "hotMarket.ts", code: /HOT_MARKET_DISABLED/, guard: ["programs/aof-market/src/lib.rs", /err!\(MarketError::TradingDisabled\)/] },
  { id: "collectors", route: "collectors.ts", code: /COLLECTOR_STAKING_DISABLED/, guard: ["aof-core/src/instructions/collector_stake.rs", /require!\(false, AofError::CollectorNotConfigured\)/] },
  { id: "rebirth", route: "rebirth.ts", code: /REBIRTH_DISABLED/, guard: ["programs/aof-rebirth/src/instructions/do_rebirth.rs", /require!\(false, RebirthError::FeatureDisabled\)/] },
  { id: "trust", route: "session.ts", code: /503/, guard: ["programs/aof-session-keys/src/lib.rs", /require!\(false, SkError::AtomicBindingRequired\)/] },
];
for (const layer of disabledLayers) {
  assert.match(read(layer.guard[0]), layer.guard[1], `${layer.id}: on-chain guard missing`);
  assert.match(backendRoute(layer.route), layer.code, `${layer.id}: backend route is not fail-closed`);
  assert.equal(siteStatus(layer.id), "soon", `${layer.id}: site content must be status:'soon' while the on-chain guard exists`);
}
for (const id of ["lottery", "exploration", "reroll", "drum", "hot_market", "collectors", "rebirth", "session"]) {
  assert.match(appNotice, new RegExp(`^  ${id}: \\{`, "m"), `${id}: missing from DISABLED_MECHANICS in the app`);
}
// Packs are live again: the price must be escrowed on the PackCommit PDA (no
// treasury account in the commit context), released to the treasury only in
// reveal, and refundable through pack_open_expire after the reveal window.
assert.doesNotMatch(pack, /require!\(false, .*FeatureDisabled/, "packs: stale FeatureDisabled guard");
assert.doesNotMatch(section(core, "pub struct PackOpenCommit", "pub struct PackOpenReveal"), /treasury/,
  "pack_open_commit must not pay the treasury before reveal");
assert.match(section(core, "pub struct PackOpenReveal", "pub struct PackOpenExpire"), /address = config\.treasury/);
const packExpireCtx = section(core, "pub struct PackOpenExpire", "// ----- Reroll");
assert.match(packExpireCtx, /close = user/);
assert.match(packExpireCtx, /address = pack_commit\.user/);
assert.match(packExpireCtx, /constraint = !pack_commit\.revealed/);
assert.match(read("aof-core/src/instructions/pack_open_expire.rs"), /COMMIT_EXPIRY_SLOTS/);
assert.match(read("aof-core/src/instructions/pack_open_expire.rs"), /AofError::CommitNotExpired/);
assert.ok(coreIdl.instructions.some((ix: any) => ix.name === "pack_open_expire"), "pack_open_expire missing from committed IDL");
assert.ok(coreIdl.errors.some((error: any) => error.name === "CommitNotExpired"));
assert.equal(siteStatus("packs"), "live");
assert.doesNotMatch(backendRoute("packs.ts"), /PACK_COMMITS_DISABLED/);
assert.match(backendRoute("packs.ts"), /packOpenExpire/);
assert.doesNotMatch(appNotice, /^  packs: \{/m, "packs must not be listed in DISABLED_MECHANICS");

// Forge: same escrow contract as packs, plus the burned resources must be
// recorded on the commit and re-minted by the expire path.
assert.doesNotMatch(forge, /require!\(false, .*FeatureDisabled/, "forge: stale FeatureDisabled guard");
assert.doesNotMatch(section(core, "pub struct ForgeAttemptCommit", "pub struct ForgeAttemptReveal"), /treasury/,
  "forge_attempt_commit must not pay the treasury before reveal");
assert.match(section(core, "pub struct ForgeAttemptReveal", "pub struct ForgeAttemptExpire"), /address = config\.treasury/);
const forgeExpireCtx = section(core, "pub struct ForgeAttemptExpire", "// ----- Лотерея");
assert.match(forgeExpireCtx, /close = user/);
assert.match(forgeExpireCtx, /address = forge_commit\.user/);
assert.match(forgeExpireCtx, /user_wood\.owner == forge_commit\.user/);
assert.match(forgeExpireCtx, /user_stone\.owner == forge_commit\.user/);
assert.match(forge, /fc\.wood_burned = wood_cost/);
assert.match(forge, /fc\.stone_burned = stone_cost/);
assert.match(forge, /pub fn expire_handler[\s\S]*COMMIT_EXPIRY_SLOTS[\s\S]*AofError::CommitNotExpired[\s\S]*token::mint_to/);
assert.ok(coreIdl.instructions.some((ix: any) => ix.name === "forge_attempt_expire"), "forge_attempt_expire missing from committed IDL");
assert.equal(siteStatus("forge"), "live");
assert.doesNotMatch(backendRoute("forge.ts"), /FORGE_COMMITS_DISABLED/);
assert.match(backendRoute("forge.ts"), /forgeAttemptExpire/);
assert.doesNotMatch(appNotice, /^  forge: \{/m, "forge must not be listed in DISABLED_MECHANICS");

// Random reroll has no separate site entry; it is covered on-chain + backend + app notice.
assert.match(backendRoute("reroll.ts"), /REROLL_COMMITS_DISABLED/);

console.log("security invariant self-test: rental/auction constraints, fail-closed guards, IDL flag parity, disabled-mechanic layer parity passed");
