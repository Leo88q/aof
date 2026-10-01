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

test('grant_season_xp больше не создаёт пропуск, а init_season_pass делает это за игрока', () => {
  const lib = read('aof-core/src/lib.rs');
  const grant = contextBody(lib, 'GrantSeasonXp');
  assert.doesNotMatch(grant, /init_if_needed/, 'выдача XP не создаёт чужой аккаунт');
  assert.doesNotMatch(grant, /payer\s*=/, 'выдача XP ничего не оплачивает');
  assert.match(grant, /season_pass\.owner == user\.key\(\) @ AofError::Unauthorized/);
  const init = contextBody(lib, 'InitSeasonPass');
  assert.match(init, /pub player: Signer<'info>/);
  assert.match(init, /init, payer = player, space = SEASON_PASS_SPACE/);
  assert.match(init, /seeds = \[SEASON_PASS_SEED, player\.key\(\)\.as_ref\(\)/);
  const seasonRs = read('aof-core/src/instructions/season.rs');
  assert.match(seasonRs, /AofError::SeasonPassNotInitialized/, 'отсутствие пропуска — понятная ошибка');
  assert.match(seasonRs, /pub fn init_pass_handler/);
  assert.doesNotMatch(seasonRs, /season_pass\.owner = Pubkey::default\(\)/);
  assert.match(read('aof-core/src/errors.rs'), /SeasonPassNotInitialized/);
});

test('backend: claim — частично подписанная транзакция игрока, а не authority-broadcast', () => {
  const inbox = read('aof_backend/src/routes/inbox.ts');
  const claim = inbox.slice(inbox.indexOf('r.post("/claim"'), inbox.indexOf('r.post("/claim/confirm"'));
  assert.match(claim, /payer: ownerPk,/, 'в контекст передаётся кошелёк получателя');
  assert.match(claim, /coSign\(\[createUserAta, ix\], ownerPk\)/, 'fee payer и подписант — игрок');
  assert.match(claim, /createAssociatedTokenAccountIdempotentInstruction\(ownerPk, tokenAccount, ownerPk, mintPk\)/,
    'ATA игрока создаётся в его транзакции');
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

test('backend: пропуск создаёт игрок, выдача XP только проверяет наличие', () => {
  const season = read('aof_backend/src/routes/season.ts');
  const init = season.slice(season.indexOf('r.post("/pass/init"'), season.indexOf('r.post("/xp/grant"'));
  assert.match(init, /initSeasonPass\(seasonId\)/);
  assert.match(init, /coSign\(\[ix\], player\)/, 'подпись и оплата — игрок, authority не нужен');
  assert.match(init, /requireWalletProof\("season_pass_init", "player"\)/);
  const grant = season.slice(season.indexOf('r.post("/xp/grant"'));
  assert.match(grant, /getAccountInfo\(seasonPass/, 'предварительная проверка существования пропуска');
  assert.match(grant, /SEASON_PASS_NOT_INITIALIZED/);
  assert.doesNotMatch(grant, /systemProgram: SystemProgram\.programId/, 'системная программа больше не нужна: init убран');
});

test('IDL: payer в claim, init_season_pass, ошибка SeasonPassNotInitialized', () => {
  const idl = JSON.parse(read('aof_backend/src/idl/aof_core.json'));
  const once = idl.instructions.find((i) => i.name === 'mint_resource_once');
  assert.deepEqual(once.accounts.map((a) => a.name), [
    'config', 'material_mints', 'authority', 'auth', 'mint', 'token_account', 'treasury_token',
    'payer', 'player', 'issuance_cap', 'token_program', 'reward_receipt', 'system_program',
  ]);
  assert.deepEqual([once.accounts[7].writable, once.accounts[7].signer], [true, true]);
  const grant = idl.instructions.find((i) => i.name === 'grant_season_xp');
  assert.equal(grant.accounts.some((a) => a.name === 'system_program'), false);
  const init = idl.instructions.find((i) => i.name === 'init_season_pass');
  assert.deepEqual(init.accounts.map((a) => a.name), ['config', 'player', 'season', 'season_pass', 'system_program']);
  assert.deepEqual([init.accounts[1].writable, init.accounts[1].signer], [true, true]);
  assert.ok(idl.errors.some((e) => e.name === 'SeasonPassNotInitialized'));
  assert.ok(idl.events.some((e) => e.name === 'SeasonPassInitialized'));
  execFileSync('python3', ['scripts/check-idl-drift.py'], { cwd: root, stdio: 'pipe' });
  execFileSync('python3', ['scripts/gen-core-instruction-table.py', '--check'], { cwd: root, stdio: 'pipe' });
});

test('кошелёк подписывает claim и пропуск только по локальному интенту', () => {
  const src = read('frontend/src/lib/transactionIntent.ts');
  assert.match(src, /export interface RewardClaimIntent/);
  assert.match(src, /export interface SeasonPassInitIntent/);
  assert.match(src, /intent\.kind === "rewardClaim"\) return validateRewardClaimIntent/);
  assert.match(src, /intent\.kind === "seasonPassInit"\) return validateSeasonPassInitIntent/);
  assert.match(src, /intent\?\.kind === "rewardClaim" \? 2 : 1/, 'claim ко-подписан оператором');
  const claim = src.slice(src.indexOf('function validateRewardClaimIntent'), src.indexOf('function validateSeasonPassInitIntent'));
  assert.match(claim, /keysEqual\(ix\.keys, expected\)/, 'аккаунты claim сверяются позиционно');
  assert.match(claim, /ix\.data\[17 \+ i\] !== rewardId\[i\]/, 'reward_id сверяется с интентом');
  assert.match(claim, /ix\.data\[8\] !== intent\.resourceKind/, 'вид ресурса сверяется с интентом');
  const api = read('frontend/src/lib/api.ts');
  assert.match(api, /confirmClaim: \(v: any\) => post\("\/inbox\/claim\/confirm", v\)/);
  assert.match(api, /passInit: \(v: any\) => post\("\/season\/pass\/init", v\)/);
  const inboxPage = read('frontend/src/pages/inbox/InboxHome.tsx');
  assert.match(inboxPage, /handleTxResponse\(res, intent\)/, 'кошелёк подписывает только проверенную транзакцию');
  assert.match(inboxPage, /api\.inbox\.confirmClaim\(/, 'подтверждение приходит после подписи клиента');
});

test('validator-тесты обновлены под новые подписи (запуск — pending)', () => {
  const core = read('tests/aof_core.ts');
  assert.match(core, /payer: user\.publicKey/, 'claim в тестах подписывает игрок');
  assert.match(core, /balance\(user\.publicKey\)\)\.to\.be\.lessThan/, 'тест проверяет, что rent платит игрок');
  const extended = read('tests/aof_extended.ts');
  assert.match(extended, /initSeasonPass\(seasonId\)/, 'пропуск создаёт игрок');
  assert.match(extended, /SeasonPassNotInitialized/, 'выдача XP без пропуска — понятная ошибка');
});
