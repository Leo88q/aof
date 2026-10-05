'use strict';
/*
 * Bootstrap-скрипты aof_backend запускаются через ts-node С проверкой типов
 * (`npx ts-node scripts/initConfig.ts`), поэтому ошибка типов — это отказ
 * посреди включения девнета, а не предупреждение.
 *
 * Реальный случай: `AUTHORITY: Keypair | null` не сужается внутри функций,
 * потому что проверка `if (!AUTHORITY)` стоит на верхнем уровне модуля
 * (TS18047 / TS2345) — шаг 5/10 падал ещё до Config. Гейт ловит это офлайн:
 *
 *  1) статически: у каждого скрипта с guard'ом `if (!AUTHORITY)` есть локальный
 *     `const authority = AUTHORITY;` и нет других обращений к голому AUTHORITY;
 *  2) компиляцией (когда установлены зависимости backend'а): tsc по
 *     aof_backend/tsconfig.bootstrap.json обязан пройти с кодом 0.
 *     В CI зависимостей backend'а нет — компиляционная часть пропускается,
 *     статическая работает всегда.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '../..');
const SCRIPTS = path.join(ROOT, 'aof_backend/scripts');
const TSCONFIG = path.join(ROOT, 'aof_backend/tsconfig.bootstrap.json');
const TSC = path.join(ROOT, 'aof_backend/node_modules/.bin/tsc');

const GUARD = 'if (!AUTHORITY) {';
const NARROW = 'const authority = AUTHORITY;';

function bootstrapScripts() {
  return fs.readdirSync(SCRIPTS)
    .filter((name) => name.endsWith('.ts'))
    .sort();
}

function guardedScripts() {
  return bootstrapScripts().filter((name) =>
    fs.readFileSync(path.join(SCRIPTS, name), 'utf8').includes(GUARD));
}

function bareAuthorityLines(source) {
  return source.split('\n').flatMap((line, index) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return [];
    if (!/\bAUTHORITY\b/.test(line)) return [];
    if (/^import\b/.test(trimmed)) return [];
    if (trimmed === GUARD) return [];
    if (trimmed === NARROW) return [];
    return [`${index + 1}: ${trimmed}`];
  });
}

test('каждый скрипт с guard\'ом hot-authority сужает AUTHORITY локально (TS18047)', () => {
  const guarded = guardedScripts();
  assert.ok(guarded.length > 0, 'не найдено ни одного скрипта с guard\'ом if (!AUTHORITY)');
  for (const name of guarded) {
    const source = fs.readFileSync(path.join(SCRIPTS, name), 'utf8');
    assert.ok(source.includes(NARROW),
      `${name}: нет «${NARROW}» — ts-node упадёт с TS18047 внутри функций`);
    const bare = bareAuthorityLines(source);
    assert.deepEqual(bare, [],
      `${name}: голый AUTHORITY вне guard'а (TS не сужает импорт внутри функций):\n${bare.join('\n')}`);
  }
});

test('все guarded-скрипты перечислены в tsconfig.bootstrap.json', () => {
  const tsconfig = JSON.parse(fs.readFileSync(TSCONFIG, 'utf8'));
  const files = new Set(tsconfig.files || []);
  for (const name of guardedScripts()) {
    assert.ok(files.has(`scripts/${name}`),
      `${name}: добавьте его в aof_backend/tsconfig.bootstrap.json (иначе компиляция его не увидит)`);
  }
  assert.equal(tsconfig.compilerOptions.noEmit, true, 'tsconfig.bootstrap.json должен быть noEmit');
  assert.deepEqual(tsconfig.include, [], 'include: [] обязателен: иначе extends тянет src/** и шумит');
});

test('tsconfig.bootstrap.json компилируется без ошибок (нужен tsc backend\'а)', (t) => {
  if (!fs.existsSync(TSC)) {
    t.skip('нет aof_backend/node_modules/.bin/tsc — компиляционная часть пропущена (CI без зависимостей backend\'а)');
    return;
  }
  const done = spawnSync(TSC, ['-p', 'tsconfig.bootstrap.json'], {
    cwd: path.join(ROOT, 'aof_backend'), encoding: 'utf8',
  });
  assert.equal(done.status, 0, `tsc -p tsconfig.bootstrap.json:\n${done.stdout}${done.stderr}`);
});

test('bringup отказывает без CAP_PER_EPOCH и пропускает шаг, когда потолки уже созданы', () => {
  const bringup = fs.readFileSync(path.join(ROOT, 'scripts/devnet-bringup.sh'), 'utf8');
  assert.ok(bringup.includes('CAP_PER_EPOCH'), 'шаг caps должен называть CAP_PER_EPOCH');
  assert.ok(bringup.includes('docs/ISSUANCE_CAPS_DESIGN.md'), 'в отказе должна быть ссылка на дизайн потолков');
  assert.ok(bringup.includes('caps_configured'), 'нужен идемпотентный пропуск, когда все виды configured');
  const caps = fs.readFileSync(path.join(SCRIPTS, 'initIssuanceCaps.ts'), 'utf8');
  const skipIndex = caps.indexOf('already initialised');
  const parseIndex = caps.indexOf('const override =');
  assert.ok(skipIndex > 0 && parseIndex > 0 && skipIndex < parseIndex,
    'initIssuanceCaps.ts должен пропускать существующие потолки ДО разбора CAP_* (идемпотентность)');
});
