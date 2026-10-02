'use strict';
/*
 * Коммит 5 payer-remediation: награды выдаются claim'ом игрока, сезонный пропуск создаёт игрок.
 *
 * Что закрывалось: `MintResourceOnce.player` и `MintResourceOnce.reward_receipt` создавались
 * `payer = authority` (чек награды и профиль игрока оплачивал проект), а `GrantSeasonXp.season_pass`
 * был `init_if_needed, payer = authority` — платный пропуск появлялся бесплатно.
 *
 * Проверяется весь вертикальный срез: Anchor-контексты и handlers, backend (сборка частично
 * подписанной транзакции + подтверждение по on-chain чеку), IDL, интенты кошелька и клиент инбокса.
 *
 * Rust/Anchor не компилировались, validator не запускался — статус
 * «source-aligned manually; generated validation pending» (docs/PAYER_REMEDIATION.md).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

function contextBody(source, name) {
  const start = source.indexOf(`pub struct ${name}<'info> {`);
  assert.notEqual(start, -1, `${name}: контекст не найден`);
  const end = source.indexOf('\n}', start);
  return source.slice(start, end);
}

test('mint_resource_once: платит получатель, а не authority', () => {
  const body = contextBody(read('aof-core/src/lib.rs'), 'MintResourceOnce');
  const payer = body.slice(body.indexOf('/// [PAYER] Получатель награды'), body.indexOf('pub player:'));
  assert.match(payer, /pub payer: Signer<'info>/);
  assert.match(payer, /payer\.key\(\) == token_account\.owner @ AofError::Unauthorized/,
    'подписант обязан быть получателем награды');
  assert.match(payer, /payer\.key\(\) != authority\.key\(\) @ AofError::Unauthorized/,
    'authority не может быть payer или получателем награды');
  assert.match(body, /token_account\.owner != authority\.key\(\) @ AofError::Unauthorized/,
    'authority не может быть destination ATA');
  const playerAttr = body.slice(body.indexOf('/// Профиль игрока: создаётся'), body.indexOf('pub player:'));
  assert.match(playerAttr, /init_if_needed,\s*payer = payer,/, 'профиль игрока оплачивает игрок');
  assert.match(body.slice(body.indexOf('pub player:'), body.indexOf('pub issuance_cap:')),
    /^pub player: Box<Account<'info, Player>>/, 'поле профиля на месте');
  const receipt = body.slice(body.indexOf('pub reward_receipt:'), body.indexOf('pub system_program:'));
  const receiptAttr = body.slice(body.lastIndexOf('#[account(', body.indexOf('pub reward_receipt:')));
  assert.match(receiptAttr, /init, payer = payer,/, 'чек награды оплачивает игрок');
  assert.match(receipt, /pub reward_receipt/, 'поле на месте');
  assert.doesNotMatch(body, /payer = authority/, 'в контексте не должно остаться оплаты проекта');
});

test('ClaimSeasonReward never treats authority as the season-pass recipient', () => {
  const body = contextBody(read('aof-core/src/lib.rs'), 'ClaimSeasonReward');
  assert.match(body, /season_pass\.owner != authority\.key\(\) @ AofError::Unauthorized/);
  assert.match(body, /user_circuit\.owner == season_pass\.owner/,
    'reward destination remains bound to the player who owns the pass');
});

test('grant_season_xp is authority-authorized but player-signed and player-funded', () => {
  const lib = read('aof-core/src/lib.rs');
  const grant = contextBody(lib, 'GrantSeasonXp');
  assert.match(grant, /pub authority: Signer<'info>/, 'the project authority still authorizes the grant');
  assert.match(grant, /pub user: Signer<'info>/, 'the recipient must sign');
  assert.match(grant, /#\[account\(mut\)\]\s*pub user: Signer<'info>/, 'the player is the writable fee payer');
  assert.match(grant, /init_if_needed, payer = user, space = SEASON_PASS_SPACE/,
    'an absent pass is initialized by the player, never the authority');
  assert.match(grant, /init_if_needed, payer = user, space = SEASON_XP_CLAIM_CURSOR_SPACE/,
    'the per-player/per-season replay cursor is also player-funded');
  assert.match(grant, /seeds = \[SEASON_XP_CLAIM_CURSOR_SEED, user\.key\(\)\.as_ref\(\), &season_id\.to_le_bytes\(\)\]/);
  assert.doesNotMatch(grant, /payer\s*=\s*authority/);
  const seasonRs = read('aof-core/src/instructions/season.rs');
  assert.match(seasonRs, /expiry_slot >= current_slot/, 'expired entitlements fail on-chain');
  assert.match(seasonRs, /nonce >= cursor\.next_nonce/, 'the cursor rejects replayed/lower nonces');
  assert.match(seasonRs, /cursor\.next_nonce = next_nonce/, 'successful claims advance the cursor atomically');
  assert.match(seasonRs, /pass\.xp = total_xp/, 'XP settlement is in the same on-chain instruction');
  const init = contextBody(lib, 'InitSeasonPass');
  assert.match(init, /pub player: Signer<'info>/);
  assert.match(init, /init, payer = player, space = SEASON_PASS_SPACE/);
  assert.match(init, /seeds = \[SEASON_PASS_SEED, player\.key\(\)\.as_ref\(\)/);
  assert.doesNotMatch(seasonRs, /season_pass\.owner = Pubkey::default\(\)/);
});

test('backend: claim — частично подписанная транзакция игрока, а не authority-broadcast', () => {
  const inbox = read('aof_backend/src/routes/inbox.ts');
  const claim = inbox.slice(inbox.indexOf('r.post("/claim"'), inbox.indexOf('r.post("/claim/confirm"'));
  assert.match(claim, /payer: ownerPk,/, 'в контекст передаётся кошелёк получателя');
  assert.match(claim, /coSignQuoted\(\[createUserAta, ix\], ownerPk, \[/,
    'fee payer — игрок; quote привязан к exact transaction message');
  assert.match(claim, /createAssociatedTokenAccountIdempotentInstruction\(ownerPk, tokenAccount, ownerPk, mintPk\)/,
    'ATA игрока создаётся в его транзакции');
  assert.match(claim, /name: "player_profile", address: player, size: PLAYER_ACCOUNT_SIZE, strategy: "init_if_needed"/);
  assert.match(claim, /name: "reward_receipt", address: rewardReceiptPda\(id, ownerPk\), size: REWARD_RECEIPT_ACCOUNT_SIZE, strategy: "init"/);
  assert.match(claim, /payerQuote: prepared\.quote/, 'frontend получает network fee/rent/max-cost/expiry quote');
  assert.doesNotMatch(claim, /createAssociatedTokenAccountIdempotentInstruction\(\s*AUTHORITY_PUBKEY,\s*tokenAccount/,
    'ATA игрока не оплачивает проект');
  assert.doesNotMatch(claim, /authorityOnly\(\[createUserAta/, 'claim не отправляется authority-кошельком');
  // ATA казны — инфраструктура проекта: её rent проект платит сам и вне транзакции игрока.
  assert.match(claim, /treasuryInfo/, 'существующая ATA казны не оплачивается повторно');
  const confirm = inbox.slice(inbox.indexOf('r.post("/claim/confirm"'));
  assert.match(confirm, /fetchRewardReceipt\(connection, id, ownerPk\)/,
    'подтверждение опирается на on-chain RewardReceipt, а не на слова клиента');
  assert.match(confirm, /assertRewardReceipt\(/);
  assert.match(confirm, /claimState: "confirmed"/);
});

test('backend: admin grants only an entitlement; the player-authenticated route prepares a co-signed player-paid claim', () => {
  const season = read('aof_backend/src/routes/season.ts');
  const init = season.slice(season.indexOf('r.post("/pass/init"'), season.indexOf('r.post("/reward/claim"'));
  assert.match(init, /initSeasonPass\(seasonId\)/);
  assert.match(init, /coSignQuoted\(\[ix\], player, \[/, 'the pass init quote is player-paid');
  assert.match(init, /strategy: "init"/, 'rent is quoted only when the SeasonPass PDA is absent');
  assert.match(init, /requireWalletProof\("season_pass_init", "player"\)/);
  assert.match(init, /SEASON_PASS_ALREADY_INITIALIZED/);

  const admin = read('aof_backend/src/routes/adminXp.ts');
  assert.match(admin, /r\.post\("\/grant-intent", requireAdmin/,
    'non-admins cannot create XP entitlements');
  assert.match(admin, /createSeasonXpEntitlement\(/);
  assert.doesNotMatch(admin, /authorityOnly\(|coSignQuoted\(|sendConfirmedTransaction/,
    'the admin stage does not send or fund a player transaction');

  const claims = read('aof_backend/src/routes/seasonXpClaims.ts');
  assert.match(claims, /r\.post\("\/claims"/);
  assert.match(claims, /r\.post\("\/claims\/:id\/transaction"/);
  assert.match(claims, /r\.post\("\/claims\/:id\/confirm"/);
  assert.match(claims, /assertSeasonXpOwner\(entitlement\.player, player\)/,
    'another wallet cannot build or confirm the entitlement');
  assert.match(claims, /coSignQuoted\(\[instruction\], playerKey, \[/,
    'the player is the fee payer for the authority-partially-signed transaction');
  assert.match(claims, /name: "season_pass"[\s\S]*?strategy: "init_if_needed"/);
  assert.match(claims, /name: "season_xp_claim_cursor"[\s\S]*?strategy: "init_if_needed"/);
  assert.match(claims, /assertSeasonXpTarget\(entitlement, clusterGenesisHash, programId\)/,
    'the stored genesis and program binding is checked against live runtime');
  assert.match(claims, /transactionHasPlayerPayerAndAuthoritySignature\(transaction, pk\(player\), AUTHORITY_PUBKEY, program\.programId\)/,
    'confirmation rejects a transaction whose fee payer is not the player');
  assert.match(claims, /eventMatches\(event, entitlement, genesisDigest\)/,
    'consumption is recorded only after the matching on-chain event');
  assert.doesNotMatch(claims, /authorityOnly\(/, 'claim settlement is never authority-broadcast');
});

test('IDL and generated client encode the player-paid, co-signed XP claim', () => {
  const idl = JSON.parse(read('aof_backend/src/idl/aof_core.json'));
  const once = idl.instructions.find((i) => i.name === 'mint_resource_once');
  assert.deepEqual(once.accounts.map((a) => a.name), [
    'config', 'material_mints', 'authority', 'auth', 'mint', 'token_account', 'treasury_token',
    'payer', 'player', 'issuance_cap', 'token_program', 'reward_receipt', 'system_program',
  ]);
  assert.deepEqual([once.accounts[7].writable, once.accounts[7].signer], [true, true]);
  const grant = idl.instructions.find((i) => i.name === 'grant_season_xp');
  assert.deepEqual(grant.accounts.map((a) => a.name), [
    'config', 'authority', 'user', 'season', 'season_pass', 'claim_cursor', 'system_program',
  ]);
  assert.deepEqual([grant.accounts[1].writable, grant.accounts[1].signer], [undefined, true],
    'authority signs but is read-only, so it cannot fund rent');
  assert.deepEqual([grant.accounts[2].writable, grant.accounts[2].signer], [true, true],
    'the player signs and is writable as fee payer');
  assert.deepEqual(grant.args.map((a) => a.name), [
    'amount', 'season_id', 'nonce', 'expiry_slot', 'campaign_digest', 'entitlement_id', 'genesis_hash_digest',
  ]);
  assert.deepEqual(grant.accounts.slice(4, 6).map((a) => a.writable), [true, true]);
  assert.ok(idl.accounts.some((a) => a.name === 'SeasonXpClaimCursor'));
  assert.ok(idl.types.some((t) => t.name === 'SeasonXpClaimCursor'));
  assert.ok(idl.events.some((e) => e.name === 'SeasonXpGranted'));
  assert.ok(idl.types.some((t) => t.name === 'SeasonXpGranted'));
  const table = read('frontend/src/lib/coreInstructions.ts');
  const spec = table.slice(table.indexOf('name: "grant_season_xp"'), table.indexOf('name: "harvest_synapse"'));
  assert.match(spec, /signerIndexes: \[1, 2\]/);
  assert.match(spec, /authorityOnly: false/);
  assert.deepEqual(idl.errors.filter((e) => e.name.includes('SeasonXp')).map((e) => e.name), [
    'InvalidSeasonXpEntitlement', 'SeasonXpEntitlementExpired', 'SeasonXpNonceMismatch',
  ]);
  execFileSync('python3', ['scripts/check-idl-drift.py'], { cwd: root, stdio: 'pipe' });
  execFileSync('python3', ['scripts/idl-sync-ts.py', '--check'], { cwd: root, stdio: 'pipe' });
  execFileSync('python3', ['scripts/gen-core-instruction-table.py', '--check'], { cwd: root, stdio: 'pipe' });
});

test('кошелёк подписывает claim и пропуск только по локальному интенту', () => {
  const src = read('frontend/src/lib/transactionIntent.ts');
  assert.match(src, /export interface RewardClaimIntent/);
  assert.match(src, /export interface SeasonPassInitIntent/);
  assert.match(src, /export interface SeasonXpClaimIntent/);
  assert.match(src, /intent\.kind === "rewardClaim"\) return validateRewardClaimIntent/);
  assert.match(src, /intent\.kind === "seasonPassInit"\) return validateSeasonPassInitIntent/);
  assert.match(src, /intent\.kind === "seasonXpClaim"\) return validateSeasonXpClaimIntent/);
  const signerPolicy = src.slice(src.indexOf('export function expectedSigners'), src.indexOf('type Instruction'));
  assert.match(signerPolicy, /intent\?\.kind === "rewardClaim"[\s\S]*?\? 2 : 1/,
    'reward claim требует payer-wallet и authority authorization signature');
  assert.match(signerPolicy, /seasonXpClaim"\s*\? 2 : 1/,
    'XP claim requires both player and authority signatures');
  assert.doesNotMatch(signerPolicy, /seasonPassInit/, 'season-pass init не требует authority signature');
  const claim = src.slice(src.indexOf('function validateRewardClaimIntent'), src.indexOf('function validateSeasonPassInitIntent'));
  assert.match(claim, /keysEqual\(ix\.keys, expected\)/, 'аккаунты claim сверяются позиционно');
  assert.match(claim, /ix\.data\[17 \+ i\] !== rewardId\[i\]/, 'reward_id сверяется с интентом');
  assert.match(claim, /ix\.data\[8\] !== intent\.resourceKind/, 'вид ресурса сверяется с интентом');
  const xp = src.slice(src.indexOf('function validateSeasonXpClaimIntent'), src.indexOf('function validateOrderbookV2Intent'));
  assert.match(xp, /authority\.equals\(user\)/, 'authority cannot also be the player fee payer');
  assert.match(xp, /intent\.programId !== CORE_PROGRAM_ID/);
  assert.match(xp, /ix\.data\.length !== 124/);
  assert.match(xp, /expectedMetas = \[[\s\S]*?\[true, false\][\s\S]*?\[true, true\][\s\S]*?\[false, true\]/,
    'authority is signer/read-only while player is signer/writable and owns the rent-bearing accounts');
  assert.match(xp, /view\.getUint32\(8, true\) !== intent\.amount/);
  assert.match(xp, /matchesBytes\(60, intent\.entitlementId\)/);
  assert.match(xp, /matchesBytes\(92, intent\.genesisHashDigest\)/);
  const api = read('frontend/src/lib/api.ts');
  assert.match(api, /confirmClaim: \(v: any\) => post\("\/inbox\/claim\/confirm", v\)/);
  assert.match(api, /passInit: \(v: any\) => post\("\/season\/pass\/init", v\)/);
  assert.match(api, /xpClaims: \(player: string, seasonId\?\: number\) => post\("\/xp\/claims"/);
  assert.match(api, /xpClaimTransaction:[\s\S]*?post\(`\/xp\/claims\//);
  assert.match(api, /xpClaimConfirm:[\s\S]*?post\(`\/xp\/claims\//);
  assert.match(api, /path: "\/xp\/claims", subject: "season_xp_claim", field: "player"/);
  const seasonPage = read('frontend/src/pages/profile/SeasonPassPage.tsx');
  assert.match(seasonPage, /api\.season\.xpClaims\(user, seasonId\)/,
    'the season page loads the authenticated player inbox');
  assert.match(seasonPage, /api\.season\.xpClaimTransaction\(owner, claim\.id\)/);
  assert.match(seasonPage, /kind: 'seasonXpClaim'/);
  assert.match(seasonPage, /handleTxResponse\(prepared\.response, intent\)/);
  assert.match(seasonPage, /api\.season\.xpClaimConfirm\(/);
  assert.match(seasonPage, /formatLamportsAsSol\(claimQuote\.rentLamports/,
    'the player sees a live rent/network quote before signing');
  const inboxPage = read('frontend/src/pages/inbox/InboxHome.tsx');
  assert.match(inboxPage, /validatePayerQuoteForIntent\(intent, new PublicKey\(user\)\)/,
    'claim quote schema/rent accounts are validated before being shown');
  assert.match(inboxPage, /handleTxResponse\(prepared\.response, prepared\.intent\)/,
    'the wallet signs only the exact prepared transaction after explicit quote confirmation');
  assert.match(inboxPage, /api\.inbox\.confirmClaim\(/, 'подтверждение приходит после подписи клиента');
  const txGuard = read('frontend/src/lib/txGuard.ts');
  assert.match(txGuard, /verifyBoundPayerQuote\(tx, cfg\.intent, connection, fee\.value\)/,
    'pre-sign guard verifies the quote against the decoded transaction');
  assert.match(txGuard, /messageSha256 !== quote\.messageSha256/,
    'message hash must match the signed transaction');
  assert.match(txGuard, /currentFeeLamports\) > BigInt\(quote\.networkFeeLamports\)/,
    'current network fee may not exceed the quote');
  assert.match(txGuard, /currentHeight > quote\.lastValidBlockHeight/,
    'expired quote is rejected');
  assert.match(txGuard, /AOF_SEASON_XP_CAMPAIGN_V1/, 'campaign id is cryptographically bound to its signed digest');
  assert.match(txGuard, /AOF_SEASON_XP_GENESIS_V1/, 'genesis hash is cryptographically bound to its signed digest');
  assert.match(txGuard, /connection\.getGenesisHash\(\)/, 'XP intent is checked against the live cluster genesis hash');
  assert.match(txGuard, /BigInt\(currentSlot\) > BigInt\(cfg\.intent\.expirySlot\)/,
    'expired XP entitlements are rejected before wallet signing');
});

test('validator-тесты покрывают player-funded XP claim invariants (запуск — pending)', () => {
  const extended = read('tests/aof_extended.ts');
  assert.match(extended, /sendPlayerClaim\(grant\(1_500, 0\), user\)/,
    'the player signs and pays while the operator co-signs');
  assert.match(extended, /lamports\(authority\)\)\.to\.equal\(authorityBefore\)/,
    'authority balance does not pay pass/cursor rent or transaction fee');
  assert.match(extended, /seasonXpClaimCursor\.fetch\(claimCursor\)/,
    'the per-player/per-season monotonic cursor is checked');
  assert.match(extended, /seasonPass\)\)\.to\.equal\(passLamports\)/,
    'an existing pass is not rent-funded again');
  assert.match(extended, /SeasonXpEntitlementExpired/);
  assert.match(extended, /SeasonXpNonceMismatch/);
  assert.match(extended, /authoritySigned\.serialize\(\)\)\.to\.throw/,
    'changing amount after authority signing invalidates the message signature');
  assert.match(extended, /Promise\.allSettled\(\[sendPlayerClaim\(race1, racer\), sendPlayerClaim\(race2, racer\)\]\)/,
    'parallel double claims are exercised on the validator');
  assert.doesNotMatch(extended, /SeasonPassNotInitialized/,
    'first XP claim can initialize the pass with the player as payer');
});
