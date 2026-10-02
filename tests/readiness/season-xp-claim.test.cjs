'use strict';

// Cross-layer acceptance tripwires for the two-stage player-facing XP claim.
// These checks verify wiring and source invariants only; Anchor/validator
// execution is tracked separately and remains pending until it actually runs.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const json = (rel) => JSON.parse(read(rel));

function rustContext(source, name) {
  const start = source.indexOf(`pub struct ${name}<'info> {`);
  assert.notEqual(start, -1, `${name} Accounts context missing`);
  return source.slice(start, source.indexOf('\n}', start));
}

test('admin stage only creates bounded metadata and retains requireAdmin', () => {
  const admin = read('aof_backend/src/routes/adminXp.ts');
  assert.match(admin, /r\.post\("\/grant-intent", requireAdmin/);
  assert.match(admin, /parseNewSeasonXpEntitlement\(req\.body\)/);
  assert.match(admin, /createSeasonXpEntitlement\(/);
  assert.match(admin, /connection\.getGenesisHash\(\)/);
  assert.match(admin, /program\.programId\.toBase58\(\)/);
  assert.doesNotMatch(admin, /authorityOnly\(|coSignQuoted\(|sendConfirmedTransaction/,
    'the admin endpoint must not broadcast or pay for a player transaction');

  const entitlements = read('aof_backend/src/lib/seasonXpEntitlement.ts');
  assert.match(entitlements, /MAX_SEASON_XP_ENTITLEMENT_AMOUNT = 100_000/);
  assert.match(entitlements, /MAX_SEASON_XP_ENTITLEMENT_TTL_SLOTS = 150_000/);
  assert.match(entitlements, /MAX_PENDING_SEASON_XP_ENTITLEMENTS = 20/);
  assert.match(entitlements, /AOF_SEASON_XP_CAMPAIGN_V1/);
  assert.match(entitlements, /AOF_SEASON_XP_GENESIS_V1/);
  assert.match(entitlements, /entitlement\.campaignDigest !== seasonXpCampaignDigest\(entitlement\.campaignId\)/);
  const entitlementTest = read('aof_backend/scripts/seasonXpEntitlementSelfTest.ts');
  for (const needle of ['database tampering cannot substitute a campaign', 'u32::MAX is unavailable',
    'XP_CLAIM_WRONG_CLUSTER', 'XP_CLAIM_WRONG_PROGRAM', 'XP_CLAIM_NOT_YOURS']) {
    assert.ok(entitlementTest.includes(needle), `entitlement test missing ${needle}`);
  }
  assert.match(read('aof_backend/package.json'), /test:season-xp-entitlement/);

  const schema = read('aof_backend/prisma/schema.prisma');
  assert.match(schema, /model SeasonXpEntitlement/);
  assert.match(schema, /@@unique\(\[clusterGenesisHash, programId, seasonId, player, nonce\]/);
  assert.match(schema, /@@unique\(\[clusterGenesisHash, programId, seasonId, player, campaignId\]/);
  assert.match(schema, /model SeasonXpNonceSequence/);
  const migration = read('aof_backend/prisma/migrations/202610020001_season_xp_entitlements/migration.sql');
  assert.match(migration, /season_xp_scope_nonce_uq/);
  assert.match(migration, /season_xp_campaign_uq/);
  const postgresMigration = read('aof_backend/prisma/postgres/migrations/202610020001_season_xp_entitlements/migration.sql');
  assert.match(postgresMigration, /CREATE TABLE IF NOT EXISTS "SeasonXpEntitlement"/);
  assert.match(postgresMigration, /season_xp_scope_nonce_uq/);
  assert.doesNotMatch(postgresMigration, /\b(DROP|DELETE|TRUNCATE)\b/i, 'migration is additive only');
  assert.doesNotMatch(migration, /lamports|balance|tokenAccount/i, 'entitlement storage is not a custody ledger');
});

test('player routes require the authenticated player and reconcile the exact on-chain event', () => {
  const server = read('aof_backend/src/server.ts');
  assert.ok(server.indexOf('app.use("/admin/xp", adminXp)') < server.indexOf('app.use("/admin", admin)'));
  assert.match(server, /app\.use\("\/xp", txLimiter\)/);
  assert.match(server, /app\.use\("\/xp", seasonXpClaims\)/);
  assert.match(server, /app\.use\(requireMappedWalletProof\(\)\)/);

  const proof = read('aof_backend/src/security/walletProof.ts');
  assert.match(proof, /\{ path: "\/xp\/claims", subject: "season_xp_claim", selector: "player" \}/);
  assert.match(proof, /\{ path: "\/xp\/claims\/", subject: "season_xp_claim", selector: "player" \}/);
  const routes = read('aof_backend/src/routes/seasonXpClaims.ts');
  assert.match(routes, /function authenticatedPlayer\(req: any\)/);
  assert.match(routes, /req\.body\?\.player !== wallet/);
  assert.match(routes, /assertSeasonXpOwner\(entitlement\.player, player\)/);
  assert.match(routes, /coSignQuoted\(\[instruction\], playerKey, \[/,
    'the backend sets the player wallet as fee payer');
  assert.match(routes, /transactionHasPlayerPayerAndAuthoritySignature\(transaction, pk\(player\), AUTHORITY_PUBKEY, program\.programId\)/,
    'confirm independently checks player fee payer + authority signature');
  const confirmation = read('aof_backend/src/lib/seasonXpClaimConfirmation.ts');
  assert.match(confirmation, /requiredSignatures !== 2/);
  assert.match(confirmation, /signatures\.length !== requiredSignatures/);
  assert.match(confirmation, /!accountKeys\[0\]\.equals\(player\)/);
  assert.match(confirmation, /signerKeys\.some\(\(key\) => key\.equals\(authority\)\)/);
  assert.match(confirmation, /instructions\.length !== 1/);
  assert.match(confirmation, /accountKeys\[programIndex\]\?\.equals\(expectedProgram\)/);
  const confirmationTest = read('aof_backend/scripts/seasonXpClaimConfirmationSelfTest.ts');
  for (const needle of ['base58 RPC account key strings are parsed', 'a different fee payer is rejected',
    'an absent authority signature is rejected', 'an extra top-level instruction is rejected',
    'versioned RPC response with staticAccountKeys/compiledInstructions is recognized']) {
    assert.ok(confirmationTest.includes(needle), `confirmation response-shape test missing ${needle}`);
  }
  assert.match(read('aof_backend/package.json'), /test:season-xp-confirmation/);
  assert.match(routes, /eventMatches\(event, entitlement, genesisDigest\)/);
  assert.match(routes, /markSeasonXpEntitlementConsumed\(entitlement\.id, signature\)/);
  const confirmRoute = routes.slice(routes.indexOf('r.post("/claims/:id/confirm"'));
  assert.ok(confirmRoute.indexOf('if (transaction.meta?.err)') < confirmRoute.indexOf('eventMatches(event, entitlement, genesisDigest)'),
    'failed transaction status returns before any consumption');
  assert.ok(confirmRoute.indexOf('eventMatches(event, entitlement, genesisDigest)') < confirmRoute.indexOf('markSeasonXpEntitlementConsumed(entitlement.id, signature)'),
    'entitlement is consumed only after the exact confirmed event');
  const store = read('aof_backend/src/lib/seasonXpEntitlementStore.ts');
  assert.match(store, /updateMany\(\{\s*where: \{ id, status: "pending" \}/);
  assert.match(store, /existing\?\.status === "consumed"/,
    'conditional settlement is idempotent when two confirm requests race');
  assert.doesNotMatch(routes, /authorityOnly\(/);

  const oldSeasonRouter = read('aof_backend/src/routes/season.ts');
  assert.doesNotMatch(oldSeasonRouter, /\/xp\/grant/);
});

test('on-chain grant requires both signers, charges the player, creates one replay cursor, and settles atomically', () => {
  const lib = read('aof-core/src/lib.rs');
  const context = rustContext(lib, 'GrantSeasonXp');
  assert.match(context, /pub authority: Signer<'info>/);
  assert.match(context, /pub user: Signer<'info>/);
  assert.match(context, /#\[account\(mut\)\]\s*pub user: Signer<'info>/);
  assert.match(context, /init_if_needed, payer = user, space = SEASON_PASS_SPACE/);
  assert.match(context, /init_if_needed, payer = user, space = SEASON_XP_CLAIM_CURSOR_SPACE/);
  assert.doesNotMatch(context, /payer\s*=\s*authority/);

  const season = read('aof-core/src/instructions/season.rs');
  assert.match(season, /expiry_slot >= current_slot/);
  assert.match(season, /nonce >= cursor\.next_nonce/);
  assert.match(season, /cursor\.next_nonce = next_nonce/);
  assert.match(season, /pass\.xp = total_xp/);
  assert.match(season, /emit!\(SeasonXpGranted/);
});

test('generated IDL/client binds every entitlement field and both signer privileges', () => {
  const idl = json('aof_backend/src/idl/aof_core.json');
  const grant = idl.instructions.find((ix) => ix.name === 'grant_season_xp');
  assert.ok(grant);
  assert.deepEqual(grant.accounts.map((account) => account.name), [
    'config', 'authority', 'user', 'season', 'season_pass', 'claim_cursor', 'system_program',
  ]);
  assert.deepEqual([grant.accounts[1].writable, grant.accounts[1].signer], [undefined, true]);
  assert.deepEqual([grant.accounts[2].writable, grant.accounts[2].signer], [true, true]);
  assert.deepEqual(grant.args.map((arg) => arg.name), [
    'amount', 'season_id', 'nonce', 'expiry_slot', 'campaign_digest', 'entitlement_id', 'genesis_hash_digest',
  ]);
  assert.ok(idl.accounts.some((account) => account.name === 'SeasonXpClaimCursor'));
  assert.ok(idl.types.some((type) => type.name === 'SeasonXpClaimCursor'));
  assert.ok(idl.events.some((event) => event.name === 'SeasonXpGranted'));

  const client = read('frontend/src/lib/coreInstructions.ts');
  const entry = client.slice(client.indexOf('name: "grant_season_xp"'), client.indexOf('name: "harvest_synapse"'));
  assert.match(entry, /signerIndexes: \[1, 2\]/);
  assert.match(entry, /actorIndexes: \[2\]/);
  assert.match(entry, /authorityOnly: false/);
  for (const command of [
    ['python3', 'scripts/check-idl-drift.py'],
    ['python3', 'scripts/idl-sync-ts.py', '--check'],
    ['python3', 'scripts/gen-core-instruction-table.py', '--check'],
  ]) execFileSync(command[0], command.slice(1), { cwd: root, stdio: 'pipe' });
});

test('wallet guard cryptographically binds campaign/genesis, live cluster, exact accounts, fee payer and expiry', () => {
  const intent = read('frontend/src/lib/transactionIntent.ts');
  assert.match(intent, /export interface SeasonXpClaimIntent/);
  assert.match(intent, /function validateSeasonXpClaimIntent/);
  assert.match(intent, /ix\.data\.length !== 124/);
  assert.match(intent, /\[true, false\][\s\S]*?\[true, true\][\s\S]*?\[false, true\]/);
  assert.match(intent, /intent\.campaignDigest/);
  assert.match(intent, /intent\.genesisHashDigest/);
  assert.match(intent, /MAX_QUOTED_PAYER_COST_LAMPORTS = 20_000_000n/);

  const guard = read('frontend/src/lib/txGuard.ts');
  assert.match(guard, /AOF_SEASON_XP_CAMPAIGN_V1/);
  assert.match(guard, /AOF_SEASON_XP_GENESIS_V1/);
  assert.match(guard, /connection\.getGenesisHash\(\)/);
  assert.match(guard, /BigInt\(currentSlot\) > BigInt\(cfg\.intent\.expirySlot\)/);
  assert.match(guard, /transactionFeePayer|feePayer/);
});

test('SeasonPass page is the real wallet-authenticated caller and displays pending XP + live payer quote', () => {
  const api = read('frontend/src/lib/api.ts');
  assert.match(api, /xpClaims: \(player: string/);
  assert.match(api, /xpClaimTransaction:/);
  assert.match(api, /xpClaimConfirm:/);
  assert.match(api, /path: "\/xp\/claims", subject: "season_xp_claim", field: "player"/);

  const page = read('frontend/src/pages/profile/SeasonPassPage.tsx');
  assert.match(page, /api\.season\.xpClaims\(user, seasonId\)/);
  assert.match(page, /api\.season\.xpClaimTransaction\(owner, claim\.id\)/);
  assert.match(page, /kind: 'seasonXpClaim'/);
  assert.match(page, /handleTxResponse\(prepared\.response, intent\)/);
  assert.match(page, /api\.season\.xpClaimConfirm\(/);
  assert.match(page, /claimQuote\.rentLamports/);
  assert.match(page, /c\.xpClaimExpiry\(claim\.expirySlot\)/);

  const copy = read('frontend/src/i18n/seasonPassCopy.ts');
  for (const field of ['xpRewardsTitle', 'xpClaimButton', 'xpClaimConfirm', 'xpClaimRent', 'xpClaimQueue', 'xpClaimCheckStatus']) {
    assert.equal((copy.match(new RegExp(`${field}:`, 'g')) || []).length, 8,
      `${field} must be defined in the Copy type and all seven locales`);
  }
  assert.match(copy, /Цена пропуска: 0 игровых токенов\. Сетевые расходы и rent аккаунта-пропуска оплачивает игрок\./);
});

test('validator suite now covers payer, repeated rent, replay, expiry, tamper, failure atomicity and race', () => {
  const payer = read('tests/aof_payer_funding.ts');
  const extended = read('tests/aof_extended.ts');
  for (const needle of [
    'SeasonXpNonceMismatch', 'SeasonXpEntitlementExpired', 'pass + replay cursor once',
    'Authority signature is over the exact instruction data',
  ]) assert.ok(payer.includes(needle), `payer acceptance test missing ${needle}`);
  assert.match(payer, /grantDelta\(user\.publicKey\)\)\.to\.equal\(-\(passRent \+ cursorRent \+ grantDelta\.fee\)/);
  assert.match(payer, /secondDelta\(user\.publicKey\)\)\.to\.equal\(-secondDelta\.fee/);
  assert.match(extended, /Promise\.allSettled\(\[sendPlayerClaim\(race1, racer\), sendPlayerClaim\(race2, racer\)\]\)/);
  assert.match(extended, /SeasonXpNonceMismatch/);
  assert.match(extended, /SeasonXpEntitlementExpired/);
});
