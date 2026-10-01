'use strict';
/*
 * Коммит 4 payer-remеdiation: player-owned аккаунты платит игрок.
 *
 * Что закрывал долг: `MintTool.tool_data` создавался `init_if_needed, payer = authority`
 * (rent инструмента платил проект), а `MintResource.player` создавал профиль игрока за счёт
 * кошелька оператора. Здесь проверяется весь вертикальный срез: Anchor-контекст и handler,
 * сборщики транзакций бэкенда, IDL, таблица инструкций фронтенда и интент кошелька.
 *
 * Это source-level тесты: Rust/Anchor не компилировались и validator не запускался
 * (см. статус «source-aligned manually; generated validation pending» в docs/PAYER_REMEDIATION.md).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

/** Тело контекста `pub struct <Name>` (до закрывающей скобки на нулевом отступе). */
function contextBody(source, name) {
  const start = source.indexOf(`pub struct ${name}<'info> {`);
  assert.notEqual(start, -1, `${name}: контекст не найден`);
  const end = source.indexOf('\n}', start);
  assert.notEqual(end, -1, `${name}: не найден конец контекста`);
  return source.slice(start, end);
}

/** Тело роута: от `r.post("<route>"` до следующего `r.post(`/`r.get(`. */
function routeBody(source, route) {
  const start = source.indexOf(`r.post("${route}"`);
  assert.notEqual(start, -1, `${route}: роут не найден`);
  const rest = source.slice(start + 10);
  const next = rest.search(/\nr\.(post|get|put)\(/);
  return next < 0 ? rest : rest.slice(0, next);
}

test('MintTool: ToolData платит и подписывает получатель, а не authority', () => {
  const lib = read('aof-core/src/lib.rs');
  const body = contextBody(lib, 'MintTool');
  const payer = body.slice(body.indexOf('/// [PAYER] Плательщик'), body.indexOf('pub tool_data:'));
  assert.match(payer, /pub payer: Signer<'info>/, 'payer обязан быть подписантом');
  assert.match(payer, /payer\.key\(\) == recipient\.key\(\) @ AofError::Unauthorized/,
    'player-mint: платит и подписывает именно получатель');
  const toolData = body.slice(body.indexOf('pub tool_data:'), body.indexOf('pub token_program:'));
  assert.match(toolData, /^pub tool_data/, 'поле ToolData на месте');
  const toolDataAttr = body.slice(body.lastIndexOf('#[account(', body.indexOf('pub tool_data:')));
  assert.match(toolDataAttr, /init_if_needed,\s*payer = payer,/, 'ToolData оплачивает payer');
  assert.doesNotMatch(payer, /payer = authority/, 'authority не платит за аккаунт получателя');
  assert.doesNotMatch(toolDataAttr, /payer = authority/, 'authority не платит за аккаунт получателя');
  // Порядок аккаунтов — часть IDL: payer идёт сразу после recipient, tool_data после payer.
  const names = [...body.matchAll(/pub (\w+):/g)].map((m) => m[1]);
  assert.deepEqual(names.indexOf('payer'), names.indexOf('recipient') + 1);
  assert.deepEqual(names.indexOf('tool_data'), names.indexOf('payer') + 1);
});

test('MintResource: профиль игрока больше не создаётся и не оплачивается выдачей', () => {
  const lib = read('aof-core/src/lib.rs');
  const body = contextBody(lib, 'MintResource');
  const player = body.slice(body.indexOf('pub player:'), body.indexOf('pub issuance_cap:'));
  assert.doesNotMatch(player, /init_if_needed/, 'выдача не создаёт Player');
  assert.doesNotMatch(player, /payer =/, 'выдача не платит за Player');
  assert.match(player, /UncheckedAccount<'info>/, 'аккаунт может отсутствовать — читает handler');
  const handler = read('aof-core/src/instructions/mint_resource.rs');
  assert.match(handler, /pub fn read_optional_player/, 'handler читает профиль как Option');
  assert.match(handler, /let player = read_optional_player\(&ctx\.accounts\.player\)\?;/);
  assert.match(handler, /player: Option<&Player>/, 'execute_mint не пишет в аккаунт игрока');
  assert.doesNotMatch(handler, /player\.owner = |player\.villagers = /, 'инициализация профиля ушла из execute_mint');
});

test('backend /tools/mint: player — payer, authority только подписывает авторизацию', () => {
  const tools = read('aof_backend/src/routes/tools.ts');
  const body = routeBody(tools, '/mint');
  assert.match(body, /payer: owner,/, 'в контекст передаётся кошелёк получателя');
  assert.match(body, /createAssociatedTokenAccountIdempotentInstruction\(\s*owner, tokenAccount, owner, mint,?\s*\)/,
    'ATA получателя создаётся в его транзакции');
  assert.match(body, /coSign\(\[createOwnerAta, ix\], owner\)/, 'fee payer — игрок, authority добавляет подпись');
  assert.doesNotMatch(body, /authorityOnly/, 'authorityOnly отправил бы транзакцию без подписи получателя');
  assert.doesNotMatch(body, /createAssociatedTokenAccountIdempotentInstruction\(\s*AUTHORITY_PUBKEY/,
    'rent чужого ATA не платит ни один кошелёк проекта');
});

test('backend /test-grant-tools: минт, ATA и ToolData оплачивает получатель', () => {
  const admin = read('aof_backend/src/routes/admin.ts');
  const body = routeBody(admin, '/test-grant-tools');
  assert.doesNotMatch(body, /createMint\(connection, AUTHORITY/, 'mint-аккаунт больше не оплачивается authority');
  assert.match(body, /fromPubkey: recipient/, 'mint-аккаунт создаётся со счёта получателя');
  assert.match(body, /payer: recipient/, 'ToolData оплачивает получатель');
  assert.match(body, /coSign\(instructions, recipient, mintKeypairs\)/, 'подпись authority — частичная, отправляет игрок');
  assert.doesNotMatch(body, /authorityOnly/, 'authority не имеет права завершить транзакцию сам');
});

test('IDL и таблица фронтенда: у mint_tool появился payer, и он не authority-only', () => {
  const idl = JSON.parse(read('aof_backend/src/idl/aof_core.json'));
  const ix = idl.instructions.find((i) => i.name === 'mint_tool');
  assert.deepEqual(ix.accounts.map((a) => a.name),
    ['config', 'authority', 'auth', 'mint', 'token_account', 'recipient', 'payer', 'tool_data', 'token_program', 'system_program']);
  assert.deepEqual([ix.accounts[6].writable, ix.accounts[6].signer], [true, true]);
  const table = read('frontend/src/lib/coreInstructions.ts');
  const spec = table.slice(table.indexOf('name: "mint_tool"'), table.indexOf('name: "mint_tool"') + 700);
  assert.match(spec, /authorityOnly: false/, 'игрок подписывает минт в свой кошелёк за свой счёт');
  assert.match(spec, /accounts: \["config", "authority", "auth", "mint", "token_account", "recipient", "payer", "tool_data"/);
  // Таблица и IDL не разъехались с Rust.
  execFileSync('python3', ['scripts/check-idl-drift.py'], { cwd: root, stdio: 'pipe' });
  execFileSync('python3', ['scripts/gen-core-instruction-table.py', '--check'], { cwd: root, stdio: 'pipe' });
});

test('кошелёк игрока подписывает минт инструмента только по локальному интенту', () => {
  const src = read('frontend/src/lib/transactionIntent.ts');
  assert.match(src, /export interface ToolMintIntent/, 'интент описан рядом с остальными');
  assert.match(src, /intent\.kind === "toolMint"\) return validateToolMintIntent/, 'интент подключён к валидации');
  assert.match(src, /intent\?\.kind === "toolMint"\s*\n?\s*\|\| intent\?\.kind === "rewardClaim" \? 2 : 1/,
    'в транзакции две подписи: игрок и authority');
  const body = src.slice(src.indexOf('function validateToolMintIntent'), src.indexOf('function validateOrderbookV2Intent'));
  assert.match(body, /keysEqual\(ix\.keys, expected\)/, 'аккаунты сверяются позиционно');
  assert.match(body, /ix\.data\[12 \+ toolType\.length\] !== RARITY\[intent\.rarity\]/, 'редкость из payload сверяется с интентом');
  assert.match(body, /ix\.data\[0\] !== 1/, 'принимается только идемпотентное создание ATA');
});
