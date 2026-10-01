'use strict';
/*
 * Коммит 6 payer-remediation: backend перестаёт оплачивать ATA игрока.
 *
 * Что закрывал долг: роуты собирали `createAssociatedTokenAccountIdempotentInstruction(
 * AUTHORITY_PUBKEY, <ata игрока>, <игрок>, ...)` и отправляли это `authorityOnly` — rent
 * пользовательского ATA платил кошелёк проекта. Теперь ATA игрока создаётся лениво в
 * транзакции самого игрока (fee payer = payer = игрок), authority подписывает только
 * авторизацию, а ATA казны/пула остаётся инфраструктурой проекта.
 *
 * Source-level тесты: Rust/Anchor не компилировались, validator не запускался, TS не
 * собирался (`pending compilation` в docs/PAYER_REMEDIATION.md).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

/** Тело роута: от `r.post("<route>"` до следующего объявления роута. */
function routeBody(source, route) {
  const start = source.indexOf(`r.post("${route}"`);
  assert.notEqual(start, -1, `${route}: роут не найден`);
  const rest = source.slice(start + 10);
  const next = rest.search(/\nr\.(post|get|put)\(/);
  return next < 0 ? rest : rest.slice(0, next);
}

/** Аргументы вызова верхнего уровня (учёт вложенных скобок и строк). */
function splitTopLevel(body) {
  const args = [];
  let depth = 0;
  let current = '';
  let quote = null;
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (quote) {
      current += ch;
      if (ch === '\\') { current += body[++i] ?? ''; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; current += ch; continue; }
    if (ch === '(' || ch === '[' || ch === '{') depth += 1;
    if (ch === ')' || ch === ']' || ch === '}') depth -= 1;
    if (ch === ',' && depth === 0) { args.push(current.trim()); current = ''; continue; }
    current += ch;
  }
  if (current.trim()) args.push(current.trim());
  return args;
}

/** Все вызовы создания ATA в исходнике: file:line + три первых аргумента. */
function ataCreations(source, file) {
  const found = [];
  const re = /createAssociatedTokenAccount(?:Idempotent)?Instruction\(/g;
  let match = re.exec(source);
  while (match) {
    const open = match.index + match[0].length - 1;
    let depth = 0;
    let quote = null;
    let i = open;
    for (; i < source.length; i += 1) {
      const ch = source[i];
      if (quote) {
        if (ch === '\\') i += 1;
        else if (ch === quote) quote = null;
        continue;
      }
      if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
      if (ch === '(') depth += 1;
      if (ch === ')') { depth -= 1; if (depth === 0) break; }
    }
    const args = splitTopLevel(source.slice(open + 1, i));
    found.push({
      file,
      line: source.slice(0, match.index).split('\n').length,
      payer: (args[0] ?? '').replace(/\s+/g, ' '),
      ata: (args[1] ?? '').replace(/\s+/g, ' '),
      owner: (args[2] ?? '').replace(/\s+/g, ' '),
    });
    re.lastIndex = i + 1;
    match = re.exec(source);
  }
  return found;
}

function backendRoutes() {
  const dir = path.join(root, 'aof_backend/src/routes');
  return fs.readdirSync(dir).filter((f) => f.endsWith('.ts')).sort()
    .map((f) => ({ file: f, source: fs.readFileSync(path.join(dir, f), 'utf8') }));
}

function allCreations() {
  return backendRoutes().flatMap(({ file, source }) => ataCreations(source, file));
}

/**
 * Аккаунты проекта: deployment, Config, registries, treasury/vault/pool-инфраструктура.
 * Их ATA проект оплачивает сам — это не субсидия игроку. Список закрытый и точный:
 * появление нового владельца здесь обязано быть осознанным решением, а не побочным
 * эффектом рефакторинга.
 */
const INFRA_OWNERS = new Set([
  'cfg.treasury',
  'treasury',
  'marketConfig.treasury',
  'pool',
  'rentalListing',
  'auction',
  'listing',
]);

const AUTHORITY_PAID_ATAS = [
  'admin.ts|cfg.treasury',
  'admin.ts|treasury',
  'admin.ts|treasury',
  'hotMarket.ts|marketConfig.treasury',
  'hotMarket.ts|pool',
  'inbox.ts|treasury',
  'resources.ts|treasury',
].sort();

test('ни один ATA игрока не оплачивается кошельком проекта', () => {
  const violations = allCreations()
    .filter((c) => c.payer === 'AUTHORITY_PUBKEY' && !INFRA_OWNERS.has(c.owner))
    .map((c) => `${c.file}:${c.line} payer=authority owner=${c.owner}`);
  assert.deepEqual(violations, [],
    'authority оплачивает ATA игрока: user ATA обязан создаваться в транзакции игрока');
});

test('authority-funded ATA — ровно инфраструктурный allowlist (казны и пулы)', () => {
  const actual = allCreations()
    .filter((c) => c.payer === 'AUTHORITY_PUBKEY')
    .map((c) => `${c.file}|${c.owner}`)
    .sort();
  assert.deepEqual(actual, AUTHORITY_PAID_ATAS,
    'изменился список ATA, которые оплачивает проект: проверьте, что это инфраструктура, а не аккаунт игрока');
});

test('/resources/mint: ATA игрока — в его транзакции, ATA казны — лениво и за проект', () => {
  const body = routeBody(read('aof_backend/src/routes/resources.ts'), '/mint');
  assert.match(body, /createAssociatedTokenAccountIdempotentInstruction\(\s*owner,\s*tokenAccount,\s*owner,\s*mint\s*,?\s*\)/,
    'ATA игрока платит и подписывает owner');
  const treasuryBlock = body.slice(body.indexOf('treasuryInfo'), body.indexOf('createUserAta'));
  assert.match(treasuryBlock, /getAccountInfo\(treasuryToken, "confirmed"\)/,
    'ATA казны создаётся только если её ещё нет');
  assert.match(treasuryBlock, /authorityOnly\(\[[\s\S]*?createAssociatedTokenAccountIdempotentInstruction\(\s*AUTHORITY_PUBKEY,\s*treasuryToken,\s*treasury,\s*mint\s*,?\s*\)/,
    'ATA казны — инфраструктура проекта, вне транзакции игрока');
  assert.match(body, /coSign\(\[createUserAta, ix\], owner\)/, 'fee payer — игрок');
  assert.match(body, /res\.json\(\{ tx \}\)/, 'клиент получает частично подписанную транзакцию');
  assert.doesNotMatch(body, /authorityOnly\(\[[^\]]*createUserAta/, 'ATA игрока не отправляется транзакцией оператора');
});

test('/admin/mint-resource: ATA игрока — в его транзакции', () => {
  const body = routeBody(read('aof_backend/src/routes/admin.ts'), '/mint-resource');
  assert.match(body, /createAssociatedTokenAccountIdempotentInstruction\(\s*owner,\s*userAta,\s*owner,\s*mintPk/,
    'ATA игрока платит owner');
  assert.match(body, /coSign\(\[createAtaIx, ix\], owner\)/, 'fee payer — игрок');
  assert.match(body, /res\.json\(\{ tx \}\)/, 'клиент получает транзакцию, а не чужую подпись');
  assert.match(body, /const treasuryAtaInfo = await connection\.getAccountInfo\(treasuryAta, "confirmed"\)/,
    'ATA казны проверяется перед созданием');
  assert.doesNotMatch(body, /authorityOnly\(\[createTreasuryAtaIx, createAtaIx/, 'старая схема «authority платит за ATA игрока» не вернулась');
});

test('/admin/test-grant: ATAs игрока уходят игроку, казна — за проект', () => {
  const body = routeBody(read('aof_backend/src/routes/admin.ts'), '/test-grant');
  assert.match(body, /if \(!userInfo\) \{[\s\S]*?createAssociatedTokenAccountIdempotentInstruction\(\s*user,\s*userAta,\s*user,\s*mintPk/,
    'отсутствующий ATA игрока создаётся за счёт игрока');
  assert.match(body, /if \(!treasuryInfo\) \{[\s\S]*?treasurySetup\.push\(/,
    'ATA казны собирается отдельно от транзакции игрока');
  assert.match(body, /if \(treasurySetup\.length\) await authorityOnly\(treasurySetup\)/,
    'ATA казны создаёт проект');
  assert.match(body, /txs\.push\(await coSign\(batch, user\)\)/, 'каждая пачка подписывается игроком');
  assert.doesNotMatch(body, /signatures\.push\(sig\)/, 'подписей оператора за игрока больше нет');
  assert.match(body, /res\.json\(\{[\s\S]*?\btxs,/, 'ответ отдаёт транзакции игроку');
});

test('/admin/test-grant-potato: ATA игрока — в его транзакции', () => {
  const body = routeBody(read('aof_backend/src/routes/admin.ts'), '/test-grant-potato');
  assert.match(body, /createAssociatedTokenAccountIdempotentInstruction\(\s*user,\s*userAta,\s*user,\s*mintPk/,
    'ATA игрока платит user');
  assert.match(body, /coSign\(instructions, user\)/, 'fee payer — игрок');
  assert.match(body, /res\.json\(\{ success: true, tx, amount \}\)/, 'ответ отдаёт транзакцию игроку');
  assert.doesNotMatch(body, /authorityOnly\(instructions\)/, 'оператор не отправляет минт за игрока');
});

test('/inbox/claim: ATA получателя — в его транзакции, ATA казны — инфраструктура', () => {
  const body = routeBody(read('aof_backend/src/routes/inbox.ts'), '/claim');
  assert.match(body, /const createUserAta = createAssociatedTokenAccountIdempotentInstruction\(\s*ownerPk,\s*tokenAccount,\s*ownerPk,\s*mintPk\s*,?\s*\)/,
    'ATA получателя платит ownerPk');
  assert.match(body, /coSign\(\[createUserAta, ix\], ownerPk\)/, 'fee payer — получатель награды');
  assert.match(body, /res\.json\(\{\s*tx,\s*reward: rewardResult,/, 'ответ отдаёт транзакцию игроку');
  const treasuryBlock = body.slice(body.indexOf('treasuryToken'), body.indexOf('createUserAta'));
  assert.match(treasuryBlock, /authorityOnly\(\[/, 'ATA казны — отдельная транзакция проекта');
});

test('/tools/mint: инструмент получателя оплачивает получатель (коммит 4 не откатился)', () => {
  const body = routeBody(read('aof_backend/src/routes/tools.ts'), '/mint');
  assert.match(body, /createAssociatedTokenAccountIdempotentInstruction\(\s*owner,\s*tokenAccount,\s*owner,\s*mint\s*,?\s*\)/,
    'ATA получателя платит owner');
  assert.match(body, /payer: owner/, 'ToolData оплачивает получатель');
  assert.match(body, /coSign\(/, 'инструмент выдаётся частично подписанной транзакцией');
  assert.doesNotMatch(body, /authorityOnly\(\[/, 'оператор не отправляет инструмент за игрока');
});

test('клиент: бесплатный сезонный пропуск создаёт сам игрок своей транзакцией', () => {
  const page = read('frontend/src/pages/profile/SeasonPassPage.tsx');
  assert.match(page, /api\.season\.passInit\(\{ player: user, seasonId \}\)/,
    'страница запрашивает player-funded init у бэкенда');
  assert.match(page, /const intent: SeasonPassInitIntent = \{ kind: 'seasonPassInit', user, seasonId \}/,
    'кошелёк проверяет транзакцию по локальному интенту');
  assert.match(page, /handleTxResponse\(resp, intent\)/, 'ответ `{ tx }` подписывает кошелёк игрока');
  assert.doesNotMatch(page, /PAID_PASS_READY[^\n]*initFreePass/, 'бесплатная ветка не заблокирована флагом платного пропуска');
  const intent = read('frontend/src/lib/transactionIntent.ts');
  assert.match(intent, /validateSeasonPassInitIntent/, 'интент сезонного пропуска подключён к валидатору транзакции');
  const season = routeBody(read('aof_backend/src/routes/season.ts'), '/pass/init');
  assert.match(season, /requireWalletProof\("season_pass_init", "player"\)/, 'init защищён подписью игрока');
  assert.match(season, /coSign\(\[ix\], player\)/, 'fee payer — игрок');
  assert.match(season, /res\.json\(\{ tx \}\)/, 'authority не подписывает init вовсе');
});
