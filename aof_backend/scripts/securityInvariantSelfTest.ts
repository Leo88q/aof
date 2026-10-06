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

/** Тело функции: от открывающей скобки `pub fn name(` до парной закрывающей. */
const fnBodyOf = (source: string, name: string) => {
  const startAt = source.indexOf(`pub fn ${name}(`);
  assert.notEqual(startAt, -1, `missing fn: ${name}`);
  const open = source.indexOf("{", startAt);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open, index + 1);
    }
  }
  assert.fail(`unterminated fn: ${name}`);
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

// [§3.4] Rebirth is enabled, but only as an atomic pair: the permanent bonus is
// signed by the rebirth authority and the same transaction must carry the full
// `aof_core::reset_for_rebirth`. Hard-disabled would be wrong (the reset now
// exists), and an unsigned `do_rebirth` would hand out bonuses without the reset.
assert.doesNotMatch(fnBodyOf(rebirth, "handler"), /require!\(\s*false/, "rebirth is disabled again by a stub");
assert.match(section(rebirth, "pub struct DoRebirth", "pub fn handler"),
  /address = rebirth_config\.authority @ RebirthError::Unauthorized/,
  "do_rebirth must require the authority signature, otherwise the bonus is reachable without the reset");
assert.match(fnBodyOf(rebirth, "handler"), /rebirth_cost_lamports/,
  "rebirth must stay paid: the on-chain price is part of the promise");
assert.match(fnBodyOf(rebirth, "handler"), /cooldown_seconds/,
  "rebirth must stay rate-limited");
const rebirthReset = read("aof-core/src/instructions/rebirth_reset.rs");
for (const guard of ["is_resource_mint", "get_associated_token_address", "TokenState::unpack", "ZeroAmount"]) {
  assert.ok(rebirthReset.includes(guard), `the atomic reset must validate ${guard} before burning`);
}
assert.match(read("aof_backend/src/routes/rebirth.ts"), /remainingAccounts/,
  "the backend must hand the surplus list to the atomic reset");

// The historical raw-atom drum and the proposed whole-MIND V2 both remain
// closed for NEW payments. Neither the presence of VRF paths nor a bank pause
// switch is sufficient to open sales; paid refunds/reveals still use vrf.rs.
const v2Spin = read("programs/aof-quests/src/instructions/drum/mind_spin.rs");
assert.match(questsDrum, /require!\(false, QuestError::Paused\)/, "legacy drum must stay disabled");
assert.match(v2Spin, /require!\(false, QuestError::FeatureDisabled\)/, "V2 paid spin must stay disabled");
assert.match(read("aof_backend/src/routes/drum.ts"), /r\.post\("\/commit"[^\n]*\n\s*res\.status\(503\)/,
  "the backend must reject new drum payments");
for (const [name, source] of [
  ["legacy drum", questsDrum + read("programs/aof-quests/src/instructions/drum/drum_reveal.rs")
    + read("programs/aof-quests/src/instructions/drum/drum_expire.rs")],
  ["MIND V2", v2Spin],
] as const) {
  assert.doesNotMatch(source, /hash_secret|get_slot_hash|slot_hashes/, `${name} must use Switchboard`);
  for (const fn of ["vrf::commit(", "vrf::reveal(", "vrf::release_for_refund("])
    assert.ok(source.includes(fn), `${name} needs ${fn} for already-paid spins`);
}

// [F-06] Other randomness mechanics are live only through the program-owned
// Switchboard pool: commit via vrf::commit, permissionless reveal via
// vrf::reveal, refund only after the window via vrf::release_for_refund.
for (const [name, source, steps] of [
  ["packs", read("aof-core/src/instructions/pack_open_commit.rs") + read("aof-core/src/instructions/pack_open_reveal.rs")
    + read("aof-core/src/instructions/pack_open_expire.rs"), 3],
  ["random reroll", randomReroll, 3],
  ["exploration", exploration, 3],
  ["forge", forge, 3],
  ["lottery", lottery, 3],
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

// Disabled mechanics must have on-chain and API guards. The editorial site
// now has localized guides and stable routes, NOT a live/soon status table;
// never infer sale readiness from the presence of an editorial link.
const siteMechanics = read("frontend/src/site/content/mechanics.ts");
assert.match(siteMechanics, /does not imply that any instruction is enabled on-chain/);
const appNotice = read("frontend/src/components/ui/FeatureDisabledNotice.tsx");
const backendRoute = (file: string) => read(`aof_backend/src/routes/${file}`);
const disabledLayers: Array<{ id: string; route: string; code: RegExp; guard: [string, RegExp] }> = [
  { id: "trust", route: "session.ts", code: /503/, guard: ["programs/aof-session-keys/src/lib.rs", /require!\(false, SkError::AtomicBindingRequired\)/] },
];
for (const layer of disabledLayers) {
  assert.match(read(layer.guard[0]), layer.guard[1], `${layer.id}: on-chain guard missing`);
  assert.match(backendRoute(layer.route), layer.code, `${layer.id}: backend route is not fail-closed`);
}
// [AUDIT F-19] The event market left the fail-closed list: both sides build a
// real instruction and ownership follows the NFT through aof_core::transfer_tool
// (CPI from aof_market). The reverse invariant matters just as much - a live
// button must not carry a "temporarily unavailable" notice, and a route that
// still answers a disabled code must not pretend to be live.
{
  const hotRoute = backendRoute("hotMarket.ts");
  const liveHotRoute = hotRoute.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(liveHotRoute, /hotMarketBuy\(/, "hot_market: the buy route does not build the instruction");
  assert.match(liveHotRoute, /hotMarketSellIntoQueue\(/, "hot_market: the sell route does not build the instruction");
  assert.match(liveHotRoute, /requireQuote\(/, "hot_market: both sides must sign a price bound");
  assert.match(liveHotRoute, /createAssociatedTokenAccountIdempotentInstruction/,
    "hot_market: the recipient/pool token account must be created idempotently");
  assert.doesNotMatch(liveHotRoute, /HOT_MARKET_DISABLED/, "hot_market: the route still answers the placeholder");
  const marketProgram = read("programs/aof-market/src/lib.rs");
  assert.doesNotMatch(section(marketProgram, "pub fn hot_market_buy", "pub fn hot_market_skip"), /TradingDisabled/,
    "hot_market: buy or sell is still behind the stub");
  assert.match(marketProgram, /transfer_tool_cpi/, "hot_market: ownership must move through aof_core::transfer_tool");
  assert.match(read("programs/aof-market/src/tools.rs"), /read_canonical_tool/,
    "hot_market: a tool must be proven canonical through its ToolData before it is priced");
  assert.match(read("aof-core/src/instructions/tool_transfer.rs"), /tool\.owner = recipient/,
    "transfer_tool must rewrite the owner together with the NFT");
  assert.doesNotMatch(appNotice, /^  hot_market: \{/m, "hot_market: the mechanic is live, the notice must be gone");
}

// Rebirth is no longer in DISABLED_MECHANICS: the atomic reset exists, so the
// app must not warn about it (see the §3.4 block above). Collectors left the
// same list for the same reason - the allowlist-backed stake is live, and the
// app must not claim otherwise while the button works.
for (const id of ["session"]) {
  assert.match(appNotice, new RegExp(`^  ${id}: \\{`, "m"), `${id}: missing from DISABLED_MECHANICS in the app`);
}
assert.doesNotMatch(appNotice, /^  collectors: \{/m,
  "collectors: the mechanic is live behind the allowlist, the notice must be gone");
assert.match(read("frontend/src/components/CollectorsPanel.tsx"), /api\.collectors\.stake/,
  "collectors: the panel must stake through the live route");
// [F-06] Other VRF mechanics have pool commit builders, not just editorial links:
//   on-chain vrf.rs  ->  backend route builds a pool commit  ->  no app notice.
const liveVrf: Array<{ id: string; route: string; builder: RegExp }> = [
  { id: "packs", route: "packs.ts", builder: /packOpenCommit/ },
  { id: "forge", route: "forge.ts", builder: /forgeAttemptCommit/ },
  { id: "lottery", route: "lottery.ts", builder: /commitLotteryDraw/ },
  { id: "exploration", route: "exploration.ts", builder: /startExplorationCommit/ },
];
for (const layer of liveVrf) {
  const route = backendRoute(layer.route);
  assert.match(route, layer.builder, `${layer.id}: route does not build the commit`);
  assert.match(route, /reservePoolSlot\(/, `${layer.id}: route must lock a healthy pool slot (circuit breaker)`);
  assert.match(route, /vrfCommitAccounts\(/, `${layer.id}: route must pass the Switchboard commit accounts`);
  const live = route.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(live, /(PACK|FORGE|LOTTERY|EXPLORATION|DRUM|REROLL)[A-Z_]*_DISABLED/, `${layer.id}: route still answers a disabled code`);
  assert.doesNotMatch(live, /newCommit\(|peekSecret\(/, `${layer.id}: legacy server secret`);
  assert.doesNotMatch(appNotice, new RegExp(`^  ${layer.id}: \\{`, "m"), `${layer.id}: still listed in DISABLED_MECHANICS`);
}
assert.match(backendRoute("reroll.ts"), /reservePoolSlot\(/);
assert.doesNotMatch(appNotice, /^  reroll: \{/m);


// [AUDIT F-33] Test tool grants are no longer a stub. The old route answered
// TOOL_GRANT_DISABLED* because it had an empty account map; the map now exists,
// so the route must build aof_core::mint_tool, and the on-chain guard that keeps
// a grant out of a wallet that never asked for it must keep holding.
{
  const adminRoute = backendRoute("admin.ts");
  assert.doesNotMatch(adminRoute, /TOOL_GRANT_DISABLED/,
    "test-grant-tools must build the instruction instead of answering a disabled code");
  assert.match(adminRoute, /mintTool\(/, "test-grant-tools must build aof_core::mint_tool");
  assert.match(adminRoute, /fromPubkey: recipient/,
    "the granted mint account must be paid for by the recipient, not authority");
  assert.match(adminRoute, /createInitializeMintInstruction\(mint, 0, auth, null\)/,
    "the granted tool must be a 0-decimal mint whose authority is the auth PDA");
  assert.match(adminRoute, /createAssociatedTokenAccountIdempotentInstruction\(recipient, tokenAccount, recipient, mint\)/,
    "the grant must create the recipient's ATA with recipient as payer and owner");
  assert.match(adminRoute, /recipient,/,
    "the grant must name the recipient: mint_tool checks token_account.owner == recipient");
  assert.match(adminRoute, /payer: recipient/,
    "the current test-grant self-mint uses the recipient as ToolData payer");
  assert.match(adminRoute, /recipient\.equals\(AUTHORITY_PUBKEY\)/,
    "authority cannot be the tool recipient");
  assert.match(adminRoute, /TOOL_KIND_IDS/,
    "the grant must reject tool ids the program does not canonicalise");
  assert.match(section(core, "pub struct MintTool", "pub struct BurnTool"),
    /token_account\.owner == recipient\.key\(\)[\s\S]*recipient\.key\(\) != authority\.key\(\)[\s\S]*payer\.key\(\) != authority\.key\(\)/,
    "mint_tool must bind the recipient ATA and keep authority separate from both recipient and payer");
}

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
assert.match(forge, /fc\.circuit_burned = circuit_cost/);
assert.match(forge, /fc\.silicon_burned = silicon_cost/);
const forgeExpire = fnBodyOf(forge, "expire_handler");
assert.match(forgeExpire, /vrf::release_for_refund/);
assert.equal((forgeExpire.match(/refund_auth_escrow\(/g) ?? []).length, 2,
  "a timed-out forge attempt returns both escrowed resources to the user exactly once");
assert.match(forge, /fn refund_auth_escrow[\s\S]*token::transfer/,
  "refunds transfer pre-existing escrowed tokens instead of minting them");
assert.match(forgeExpire, /circuit_refunded: circuit/);
assert.match(forgeExpire, /silicon_refunded: silicon/);
assert.doesNotMatch(forgeExpire, /check_supply_cap|token::mint_to|token::burn/);
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
  assert.match(settlement, /return \[\.\.\.vrfComputeBudget\(\), \.\.\.ataSetup, await refundInstruction\(c, cranker\)\]/);
  assert.match(settlement, /return \[\.\.\.vrfComputeBudget\(\), ix\]/);
}

console.log("security invariant self-test: rental/auction constraints, fail-closed guards, IDL flag parity, disabled/live mechanic layer parity, VRF escrow contracts passed");
