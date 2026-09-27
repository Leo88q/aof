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

// Rebirth has no safe settlement yet and must fail closed in the program itself.
// API 503 responses alone are not a security boundary.
assert.match(rebirth, /require!\(false, .*FeatureDisabled/, "rebirth must fail closed on-chain");

// [F-06] Randomness mechanics are live only through the program-owned
// Switchboard pool: commit via vrf::commit, permissionless reveal via
// vrf::reveal, refund only after the window via vrf::release_for_refund.
for (const [name, source, steps] of [
  ["packs", read("aof-core/src/instructions/pack_open_commit.rs") + read("aof-core/src/instructions/pack_open_reveal.rs")
    + read("aof-core/src/instructions/pack_open_expire.rs"), 3],
  ["random reroll", randomReroll, 3],
  ["exploration", exploration, 3],
  ["forge", forge, 3],
  ["lottery", lottery, 3],
  ["drum", questsDrum + read("programs/aof-quests/src/instructions/drum/drum_reveal.rs")
    + read("programs/aof-quests/src/instructions/drum/drum_expire.rs"), 3],
] as const) {
  assert.doesNotMatch(source, /require!\(false/, `${name} is still hard-disabled`);
  assert.doesNotMatch(source, /hash_secret|get_slot_hash|slot_hashes/, `${name} still uses the legacy commit-reveal`);
  const used = ["vrf::commit(", "vrf::reveal(", "vrf::release_for_refund("].filter((f) => source.includes(f));
  assert.equal(used.length, steps, `${name}: commit, reveal and refund must all go through vrf.rs`);
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
  { id: "hot_market", route: "hotMarket.ts", code: /HOT_MARKET_DISABLED/, guard: ["programs/aof-market/src/lib.rs", /err!\(MarketError::TradingDisabled\)/] },
  { id: "rebirth", route: "rebirth.ts", code: /REBIRTH_DISABLED/, guard: ["programs/aof-rebirth/src/instructions/do_rebirth.rs", /require!\(false, RebirthError::FeatureDisabled\)/] },
  { id: "trust", route: "session.ts", code: /503/, guard: ["programs/aof-session-keys/src/lib.rs", /require!\(false, SkError::AtomicBindingRequired\)/] },
];
for (const layer of disabledLayers) {
  assert.match(read(layer.guard[0]), layer.guard[1], `${layer.id}: on-chain guard missing`);
  assert.match(backendRoute(layer.route), layer.code, `${layer.id}: backend route is not fail-closed`);
  assert.equal(siteStatus(layer.id), "soon", `${layer.id}: site content must be status:'soon' while the on-chain guard exists`);
}
for (const id of ["hot_market", "collectors", "rebirth", "session"]) {
  assert.match(appNotice, new RegExp(`^  ${id}: \\{`, "m"), `${id}: missing from DISABLED_MECHANICS in the app`);
}
// [F-06] Live VRF mechanics are enabled identically in every layer:
//   on-chain vrf.rs  ->  backend route builds a pool commit  ->  site status:'live'  ->  no app notice.
const liveVrf: Array<{ id: string; route: string; builder: RegExp }> = [
  { id: "packs", route: "packs.ts", builder: /packOpenCommit/ },
  { id: "forge", route: "forge.ts", builder: /forgeAttemptCommit/ },
  { id: "lottery", route: "lottery.ts", builder: /commitLotteryDraw/ },
  { id: "exploration", route: "exploration.ts", builder: /startExplorationCommit/ },
  { id: "drum", route: "drum.ts", builder: /drumCommit/ },
];
for (const layer of liveVrf) {
  const route = backendRoute(layer.route);
  assert.match(route, layer.builder, `${layer.id}: route does not build the commit`);
  assert.match(route, /reservePoolSlot\(/, `${layer.id}: route must lock a healthy pool slot (circuit breaker)`);
  assert.match(route, /vrfCommitAccounts\(/, `${layer.id}: route must pass the Switchboard commit accounts`);
  const live = route.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(live, /(PACK|FORGE|LOTTERY|EXPLORATION|DRUM|REROLL)[A-Z_]*_DISABLED/, `${layer.id}: route still answers a disabled code`);
  assert.doesNotMatch(live, /newCommit\(|peekSecret\(/, `${layer.id}: legacy server secret`);
  assert.equal(siteStatus(layer.id), "live", `${layer.id}: site content must be status:'live'`);
  assert.doesNotMatch(appNotice, new RegExp(`^  ${layer.id}: \\{`, "m"), `${layer.id}: still listed in DISABLED_MECHANICS`);
}
assert.match(backendRoute("reroll.ts"), /reservePoolSlot\(/);
assert.doesNotMatch(appNotice, /^  reroll: \{/m);


// [AUDIT F-16] Collector perks are no longer hard-disabled: the on-chain
// `require!(false, AofError::CollectorNotConfigured)` is gone and eligibility is
// a per-mint allowlist entry created by the authority. The invariant that must
// hold is the opposite of the disabled layers above - the gate has to stay
// fail-closed while becoming reachable once a canonical mint is registered.
{
  const stake = read("aof-core/src/instructions/collector_stake.rs");
  assert.doesNotMatch(stake, /require!\(false, AofError::CollectorNotConfigured\)/,
    "collector_stake is hard-disabled again: historian/medallion perks are dead");
  assert.match(stake, /CollectorAllowEntry/, "collector_stake must bind the allowlist entry");
  assert.match(section(core, "pub struct CollectorStake", "pub struct CollectorUnstake"),
    /pub collector_allow:/, "CollectorStake must require the collector_allow PDA");
  // Unregistered mints must be rejected by the program, not by the route.
  const idlIx = coreIdl.instructions.find((ix: any) => ix.name === "collector_stake");
  assert.ok(idlIx.accounts.find((a: any) => a.name === "collector_allow"),
    "collector_allow missing from the committed IDL");
  const route = backendRoute("collectors.ts");
  assert.doesNotMatch(route, /COLLECTOR_STAKING_DISABLED/, "collectors route is disabled again");
  assert.match(route, /collectorAllowPda/, "collectors.ts must derive the allowlist PDA");
  assert.match(route, /collectorAllow,/, "collectors.ts must pass the allowlist account");
  // Registration/revocation stays authority-only.
  const admin = backendRoute("admin-config.ts");
  assert.match(admin, /registerCollectorMint/);
  assert.match(admin, /revokeCollectorMint/);
}
// [F-06] Escrow contract of the paid commits: nothing reaches the treasury
// before the outcome is final; the refund contexts pay only the committing user.
assert.doesNotMatch(section(core, "pub struct PackOpenCommit", "pub struct PackOpenReveal"), /treasury/,
  "pack_open_commit must not pay the treasury before reveal");
assert.match(section(core, "pub struct PackOpenReveal", "pub struct PackOpenExpire"), /address = config\.treasury/);
const packExpireCtx = section(core, "pub struct PackOpenExpire", "// ----- Reroll");
assert.match(packExpireCtx, /close = user/);
assert.match(packExpireCtx, /address = pack_commit\.user/);
assert.match(read("aof-core/src/instructions/pack_open_expire.rs"), /vrf::release_for_refund/);
assert.ok(coreIdl.instructions.some((ix: any) => ix.name === "pack_open_expire"), "pack_open_expire missing from committed IDL");
assert.ok(coreIdl.errors.some((error: any) => error.name === "CommitNotExpired"));
assert.ok(coreIdl.errors.some((error: any) => error.name === "RevealWindowClosed"));
assert.match(backendRoute("packs.ts"), /selfSettleTransaction\("pack"/, "players can settle their own pack");

assert.doesNotMatch(section(core, "pub struct ForgeAttemptCommit", "pub struct ForgeAttemptReveal"), /treasury/,
  "forge_attempt_commit must not pay the treasury before reveal");
assert.match(section(core, "pub struct ForgeAttemptReveal", "pub struct ForgeAttemptExpire"), /address = config\.treasury/);
const forgeExpireCtx = section(core, "pub struct ForgeAttemptExpire", "// ----- Лотерея");
assert.match(forgeExpireCtx, /close = user/);
assert.match(forgeExpireCtx, /address = forge_commit\.user/);
assert.match(forgeExpireCtx, /associated_token::authority = user/);
assert.match(forge, /fc\.wood_burned = wood_cost/);
assert.match(forge, /fc\.stone_burned = stone_cost/);
assert.match(forge, /pub fn expire_handler[\s\S]*vrf::release_for_refund[\s\S]*check_supply_cap[\s\S]*token::mint_to/);
assert.ok(coreIdl.instructions.some((ix: any) => ix.name === "forge_attempt_expire"), "forge_attempt_expire missing from committed IDL");

// Lottery: player money only goes back to players or into the prize.
assert.doesNotMatch(section(core, "pub struct BuyLotteryTicket", "pub struct DrawLottery"), /treasury/,
  "ticket money must stay escrowed on the round until the draw");
assert.match(lottery, /pub fn refund_ticket_handler[\s\S]*transfer_owned_lamports[\s\S]*buyer/);
assert.match(section(core, "pub struct RefundLotteryTicket", "#[derive(Accounts)]\npub struct ClaimLotteryPrize"),
  /close = buyer/);

// The settler worker replaced the legacy commit-expirer.
assert.ok(fs.existsSync(path.join(repo, "aof_backend/services/vrf-settler/index.ts")));
assert.ok(!fs.existsSync(path.join(repo, "aof_backend/services/commit-expirer/index.ts")));
assert.match(read("docker-compose.prod.yml"), /vrf-settler:\n    build/, "the settler runs by default in production");
assert.match(read("docker-compose.prod.yml"), /vrf-settler\.heartbeat/, "the settler has a liveness healthcheck");
{
  const settler = read("aof_backend/services/vrf-settler/index.ts");
  assert.match(settler, /CONCURRENCY/, "settlements run in parallel (a serial loop trips the circuit breaker under load)");
  assert.match(settler, /watchdog_exit/, "a stuck cycle restarts the worker");
  assert.match(settler, /low_balance/, "the settler wallet balance is monitored");
  assert.match(settler, /resolveSettlerSigner\(/, "the settler signs with its own fee-only wallet");
  assert.doesNotMatch(settler, /authorityOnly|AUTHORITY_PUBKEY/, "the settler never signs with the operator key");
  // Every reveal / refund transaction carries the compute budget (CU + priority fee).
  const settlement = read("aof_backend/src/lib/vrfSettlement.ts");
  assert.match(settlement, /return \[\.\.\.vrfComputeBudget\(\), await refundInstruction\(c, cranker\)\]/);
  assert.match(settlement, /return \[\.\.\.vrfComputeBudget\(\), ix\]/);
}

console.log("security invariant self-test: rental/auction constraints, fail-closed guards, IDL flag parity, disabled/live mechanic layer parity, VRF escrow contracts passed");
