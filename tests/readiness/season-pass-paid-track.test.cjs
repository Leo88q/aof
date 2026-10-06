'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const idl = JSON.parse(read('aof_backend/src/idl/aof_core.json'));

test('paid season sales stay fail-closed while claims use independent premium ledgers', () => {
  const rust = read('aof-core/src/instructions/season.rs');
  const lib = read('aof-core/src/lib.rs');
  const route = read('aof_backend/src/routes/season.ts');
  const intent = read('frontend/src/lib/transactionIntent.ts');
  const page = read('frontend/src/pages/profile/SeasonPassPage.tsx');
  const purchase = rust.slice(rust.indexOf('pub fn purchase_pass_handler'), rust.indexOf('/// XP is earned'));
  const premiumClaim = rust.slice(rust.indexOf('pub fn claim_premium_reward_handler'));

  assert.match(purchase, /require!\(false, AofError::SeasonPremiumRequired\)/,
    'the on-chain purchase instruction stays closed until the separate acceptance gate passes');
  assert.ok(purchase.indexOf('require!(false') < purchase.indexOf('system_program::transfer'),
    'the closed purchase path must fail before any SOL transfer');
  for (const guard of ['SeasonNotStarted', 'SeasonEnded', 'SeasonPassAlreadyPremium', 'SEASON_LENGTH_SECONDS']) {
    assert.ok(purchase.includes(guard), `purchase handler is missing ${guard}`);
  }
  assert.ok(purchase.indexOf('SeasonPassAlreadyPremium') < purchase.indexOf('system_program::transfer'),
    'duplicate purchase must be rejected before SOL moves');
  assert.match(purchase, /SEASON_PASS_PREMIUM_PRICE_LAMPORTS/);
  assert.match(purchase, /premium_claims\.claimed_bitmap\s*=\s*0/);
  assert.match(lib, /pub premium_claims: Account<'info, SeasonPremiumClaims>/);
  assert.match(lib, /pub struct ClaimPremiumSeasonReward/);
  assert.match(premiumClaim, /premium_claims\.claimed_bitmap/);
  assert.match(premiumClaim, /check_supply_cap\(/);
  assert.match(premiumClaim, /SeasonPremiumRewardClaimed/);

  assert.match(route, /r\.post\("\/pass\/purchase", requirePaidSeasonPassSales, requireWalletProof\("season_pass_purchase", "user"\)/);
  assert.match(route, /requireNoFraudHold\("user", "season_pass_purchase"\)/);
  assert.match(route, /SEASON_PREMIUM_CLAIMS_ACCOUNT_SIZE/);
  assert.match(route, /coSignQuoted\(\[ix\], user/);
  const salesGate = read('aof_backend/src/middleware/seasonPassSales.ts');
  assert.match(salesGate, /env\.PAID_PASS_SALES_ENABLED === "true"/);
  assert.match(salesGate, /SEASON_PASS_SALES_CLOSED/);
  assert.match(read('aof_backend/.env.example'), /PAID_PASS_SALES_ENABLED=false/);
  const server = read('aof_backend/src/server.ts');
  assert.ok(server.indexOf('app.use("/season/pass/purchase", requirePaidSeasonPassSales)') <
    server.indexOf('app.use(requireMappedWalletProof())'),
  'closed paid-pass sales must reject before consuming a wallet proof');

  assert.match(route, /requireWalletProof\("season_reward_claim", "owner"\)/);
  assert.match(route, /requireNoFraudHold\("owner", "season_reward_claim"\)/);
  assert.doesNotMatch(route.slice(route.indexOf('r.post("\/reward\/claim"'), route.indexOf('export default r;')), /requireAdmin/);
  assert.match(route, /createAssociatedTokenAccountIdempotentInstruction\(\s*AUTHORITY_PUBKEY,\s*userCircuit,\s*owner/);
  assert.match(route, /authorityOnly\(\[ataIx, rewardIx\]\)/);
  assert.match(route, /TransactionOutcomeUnknown/);
  assert.match(route, /TransactionExecutionFailed/);
  assert.match(route, /res\.status\(202\)\.json\(\{\s*pending: true,\s*signature: e\.signature/);
  assert.doesNotMatch(route, /coSignQuoted\(\[ataIx, rewardIx\], owner/);
  assert.match(route, /premiumClaimsState\.claimedBitmap/);
  assert.match(read('aof_backend/src/security/walletProof.ts'), /path: "\/season\/reward\/claim", subject: "season_reward_claim", selector: "owner"/);
  assert.match(read('frontend/src/lib/api.ts'), /path: "\/season\/reward\/claim", subject: "season_reward_claim", field: "owner"/);
  assert.match(read('aof_backend/src/routes/vipStatus.ts'), /premiumClaims: premiumClaimsData \?/);
  assert.match(page, /submitSeasonRewardClaim/);
  assert.match(page, /createWalletProof\(owner, 'season_reward_claim'/);
  assert.match(page, /premiumLedgerUnavailable/);
  assert.match(page, /const SEASON_REWARD_UNITS_PER_LEVEL = 100/);
  const seasonCopy = read('frontend/src/i18n/seasonPassCopy.ts');
  assert.equal((seasonCopy.match(/preparingRewardClaim:/g) || []).length, 8, 'all seven locales and the type must define claim submission copy');
  assert.equal((seasonCopy.match(/rewardPayerNote:/g) || []).length, 8, 'all seven locales and the type must explain the operator-paid flow');
  assert.equal((seasonCopy.match(/rewardAmount: \(amount\)/g) || []).length, 7, 'all seven locales must show the on-chain reward amount');
  assert.doesNotMatch(intent, /SeasonRewardClaimIntent|seasonRewardClaim/);
  assert.match(intent, /season_premium_claims/);
  assert.match(intent, /SEASON_PREMIUM_CLAIMS_ACCOUNT_SIZE = 53/);
  assert.match(page, /preparePassPurchase/);
  assert.match(page, /confirmPassPurchase/);
  assert.match(page, /quote: purchaseQuote/);
  assert.match(page, /const PAID_PASS_READY = false/,
    'the Devnet acceptance gate stays closed until release evidence exists');

  const purchaseIx = idl.instructions.find((ix) => ix.name === 'purchase_season_pass');
  const premiumIx = idl.instructions.find((ix) => ix.name === 'claim_premium_season_reward');
  assert.ok(purchaseIx.accounts.some((account) => account.name === 'premium_claims'));
  assert.ok(premiumIx.accounts.some((account) => account.name === 'premium_claims'));
  assert.equal(idl.accounts.some((account) => account.name === 'SeasonPremiumClaims'), true);
  assert.equal(idl.types.some((type) => type.name === 'SeasonPremiumClaims'), true);
});
