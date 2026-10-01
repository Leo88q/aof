'use strict';
/*
 * Контракт и защита bootstrap-preflight (GET /admin/config/bootstrap-preflight).
 *
 * Поведение проверяют aof_backend/scripts/bootstrapPreflightSelfTest.ts (настоящий роутер по HTTP) и
 * scripts/test-devnet-bringup.py (настоящий bash + настоящий curl). Здесь — то, что обязано держаться
 * без установки зависимостей: контракт одинаков в трёх местах (backend, скрипт, тестовый двойник) и
 * маршрут не потерял защиту. Старый замкнутый круг (строгий 200 на GET /mining до деплоя) не вернулся.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const stripComments = (code) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const LIB = 'aof_backend/src/lib/bootstrapPreflight.ts';
const ROUTE = 'aof_backend/src/routes/admin-config.ts';
const BRINGUP = 'scripts/devnet-bringup.sh';
const FAKE = 'scripts/test-devnet-bringup.py';

// Поля контракта, на которые опирается скрипт. Все обязаны быть в backend, в скрипте и в двойнике.
const FIELDS = ['kind', 'schemaVersion', 'service', 'authority', 'pubkey', 'mode', 'canSign', 'rpc', 'genesisHash',
  'genesisMatchesExpected', 'expectedGenesisHash', 'programs', 'programId', 'deployed', 'anomaly', 'config', 'exists', 'pda'];

test('контракт preflight одинаков в backend, в скрипте и в тестовом двойнике', () => {
  const lib = stripComments(read(LIB));
  const fake = read(FAKE);
  const script = read(BRINGUP);
  for (const field of FIELDS) {
    assert.ok(new RegExp(`\\b${field}\\b`).test(lib), `backend не отдаёт поле ${field}`);
    assert.ok(fake.includes(`"${field}"`), `тестовый двойник backend'а не знает поле ${field}`);
  }
  // каждое поле, которое скрипт читает jq-выражением, существует в контракте
  const used = new Set();
  // только jq-вызовы по ответу preflight; остальные jq в скрипте читают другие ответы (.sig и т. п.)
  const preflightLines = script.split('\n').filter((line) => line.includes('PREFLIGHT_BODY')).join('\n');
  for (const match of preflightLines.matchAll(/jq -[a-z]+(?: --arg \w+ "[^"]*")? '([^']+)'/g)) {
    const expression = match[1].replace(/"[^"]*"/g, '""'); // строковые литералы ("aof.bootstrap-preflight") — не пути
    for (const part of expression.matchAll(/\.([A-Za-z]+)/g)) used.add(part[1]);
  }
  for (const name of used) {
    if (['programs', 'address', 'name', 'length'].includes(name) && !FIELDS.includes(name)) continue; // реестр watchtower
    assert.ok(FIELDS.includes(name) || ['name', 'address'].includes(name), `скрипт читает поле .${name}, которого нет в контракте`);
  }
  assert.match(lib, /BOOTSTRAP_PREFLIGHT_KIND = "aof\.bootstrap-preflight"/);
  assert.match(script, /\.kind == "aof\.bootstrap-preflight" and \.schemaVersion == 1/);
});

test('маршрут закрыт ops-токеном и ничего не подписывает', () => {
  const route = stripComments(read(ROUTE));
  assert.match(route, /r\.get\("\/bootstrap-preflight", requireAdminOps, bootstrapPreflightHandler\(/,
    'bootstrap-preflight обязан требовать ops-токен (read-токен раскрывать authority не должен)');
  const lib = stripComments(read(LIB));
  for (const word of ['authorityOnly', 'sendSignedBy', 'coSign', 'partialSign', 'sendTransaction', 'AUTHORITY_SECRET_KEY',
    'ADMIN_TOKEN', 'RPC_URL', 'secretKey']) {
    assert.ok(!lib.includes(word), `${LIB} не должен упоминать ${word}`);
  }
  assert.match(lib, /BOOTSTRAP_PREFLIGHT_RPC_UNAVAILABLE/);
  // санитайзер для ЛОГА читает message намеренно (и вырезает URL); клиенту же обработчик отдаёт только код
  const handler = lib.slice(lib.indexOf('export function bootstrapPreflightHandler'));
  assert.doesNotMatch(handler, /\.message/, 'текст ошибки RPC не должен уходить клиенту: в нём бывает URL с ключом');
  assert.match(handler, /res\.status\(502\)\.json\(\{ error: "BOOTSTRAP_PREFLIGHT_RPC_UNAVAILABLE" \}\)/);
  assert.match(lib, /\[url\]/, 'санитайзер лога обязан вырезать URL');
});

test('bringup проверяет backend preflight-маршрутом, а не строгим 200 на GET /admin/config/mining', () => {
  const script = read(BRINGUP);
  const step1 = script.slice(script.indexOf('step "1/10'), script.indexOf('step "2/10'))
    .split('\n').filter((line) => !/^\s*#/.test(line)).join('\n'); // комментарии объясняют старый маршрут по имени
  assert.match(step1, /\/admin\/config\/bootstrap-preflight/);
  assert.doesNotMatch(step1, /STATE_HTTP/);
  assert.doesNotMatch(step1, /\/admin\/config\/mining/, 'шаг 1 снова зависит от Config: замкнутый круг вернулся');
  // «принимать любой 400» запрещено: единственный успех — 200
  assert.match(step1, /case "\$PREFLIGHT_HTTP" in\s+200\) ;;/);
  for (const refusal of ['backend недоступен', 'backend отклонил ADMIN_TOKEN', 'нет /admin/config/bootstrap-preflight',
    'не похож на bootstrap-preflight', 'не в hot-режиме', 'не совпадает с ключом оператора', 'а в реестре', 'не devnet']) {
    assert.ok(step1.includes(refusal), `шаг 1 потерял отказ «${refusal}»`);
  }
});

test('self-test backend подключён в CI и в общий прогон', () => {
  assert.match(read('.github/workflows/ci.yml'), /npm run test:bootstrap-preflight/);
  assert.match(read('scripts/run-all-tests.sh'), /test:bootstrap-preflight/);
  const pkg = JSON.parse(read('aof_backend/package.json'));
  assert.ok(pkg.scripts['test:bootstrap-preflight'], 'нет npm-скрипта test:bootstrap-preflight');
});

test('десять сценариев bootstrap закреплены в тестах bringup', () => {
  const fake = read(FAKE);
  for (const name of [
    'test_backend_offline_refuses', 'test_foreign_http_service_refuses', 'test_wrong_token_refuses',
    'test_read_only_backend_refuses', 'test_wrong_authority_refuses', 'test_wrong_program_id_refuses',
    'test_fresh_network_without_programs_and_config_proceeds', 'test_programs_deployed_but_no_config_proceeds_to_initialize',
    'test_initialized_config_is_not_recreated', 'test_repeated_run_is_idempotent',
    'test_http_400_is_never_accepted_as_ready', 'test_mainnet_rpc_of_the_backend_refuses',
    'test_mainnet_rpc_of_the_script_refuses_before_the_backend_is_asked',
  ]) {
    assert.ok(fake.includes(`def ${name}(`), `в scripts/test-devnet-bringup.py нет сценария ${name}`);
  }
});
