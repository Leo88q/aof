'use strict';
/*
 * План переименования ресурсов (scripts/resource-rename-plan.mjs, шаг C пункта 12).
 *
 * Переименование затрагивает шесть слоёв и до утверждения владельцем не начинается. Гейт
 * держит документ на утверждение точным: каждый старый идентификатор (IDL-вариант, ключ
 * backend-карты, поле минта) обязан иметь ровно один канонический преемник, план не вправе
 * обещать алиасы или объявлять работу выполненной, пока drift в манифесте не пуст.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const script = path.join(root, 'scripts/resource-rename-plan.mjs');
const PLAN = 'docs/RESOURCE_RENAME_PLAN.md';
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

function run(args, cwd = root) {
  try {
    return { code: 0, out: execFileSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
  } catch (error) {
    return { code: error.status ?? 1, out: `${error.stdout ?? ''}${error.stderr ?? ''}` };
  }
}

function makeRoot() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aof-rename-'));
  for (const rel of ['aof_backend/src/idl', 'docs', 'scripts/resource-rename-plan.mjs', 'aof-core/src']) {
    const from = path.join(root, rel);
    fs.cpSync(from, path.join(tmp, rel), { recursive: true });
  }
  return tmp;
}
const withRoot = (fn) => { const tmp = makeRoot(); try { return fn(tmp); } finally { fs.rmSync(tmp, { recursive: true, force: true }); } };

test('план актуален и требует утверждения владельцем, пока долг не закрыт', () => {
  const result = run(['--check']);
  assert.equal(result.code, 0, result.out);
  const plan = read(PLAN);
  assert.match(plan, /не начато — требуется утверждение владельцем канонического mapping/);
  assert.match(plan, /Долг, который план закрывает: \*\*43\*\* расхождений/);
  assert.match(plan, /без алиасов и совместимости/);
  assert.doesNotMatch(plan, /временно поддерживаем оба имени|alias keeps/i);
});

test('у каждого из 27 ресурсов ровно один канонический преемник во всех слоях', () => {
  const plan = read(PLAN);
  const manifest = JSON.parse(read('docs/RESOURCE_MANIFEST.json'));
  const idl = JSON.parse(read('aof_backend/src/idl/aof_core.json'));
  const idlNames = idl.types.find((t) => t.name === 'ResourceKind').type.variants.map((v) => v.name);
  assert.equal(manifest.resources.length, 27);
  for (const resource of manifest.resources) {
    const before = idlNames[resource.id];
    assert.ok(before && before !== resource.kind, `${resource.kind}: ожидался legacy-IDL-вариант`);
    // Строка таблицы соответствий: все старые имена, → канонический kind и целевое поле.
    const line = plan.split('\n').find((l) => l.startsWith(`| ${resource.id} |`));
    assert.ok(line, `${resource.kind}: нет строки ${resource.id} в таблице соответствий`);
    assert.ok(line.includes(`\`${before}\``), `${resource.kind}: в строке нет legacy-IDL-имени ${before}`);
    assert.ok(line.includes(`\`${resource.mintSource.split('.')[1]}\``), `${resource.kind}: в строке нет старого поля ${resource.mintSource}`);
    assert.ok(line.includes(`${resource.kind} (`), `${resource.kind}: в строке нет канонической цели`);
    assert.ok(line.includes(`| ${resource.fieldType ?? 'Pubkey'} |`), `${resource.kind}: в строке нет типа поля`);
    assert.ok(plan.includes(`\`${resource.mintSource}\` → \``), `${resource.kind}: нет переименования минт-поля`);
  }
  for (const entry of manifest.drift.filter((d) => d.type === 'backend-legacy-name')) {
    const target = manifest.resources.find((r) => r.kind === entry.kind).apiName;
    assert.ok(plan.includes(`\`${entry.name}\` → \`${target}\``), `${entry.name} → ${target}: нет в плане`);
  }
});

test('три прямых переименования минтов и запреты шага C зафиксированы в плане', () => {
  const plan = read(PLAN);
  for (const direct of [
    '`config.food_mint` → `config.data_mint`',
    '`config.wood_mint` → `config.circuit_mint`',
    '`config.stone_mint` → `config.silicon_mint`',
  ]) assert.ok(plan.includes(direct), `нет прямого переименования ${direct}`);
  assert.match(plan, /варианты enum не переставлять/);
  assert.match(plan, /удалять AmberQuartz, SoulCore, Data, Dataset, Compute, Mind/);
  assert.match(plan, /семь отключённых инструкций/);
  assert.match(plan, /layout (не меняется|обязателен)/);
});

test('правка цели переименования или преждевременное «выполнено» роняет гейт', () => {
  withRoot((tmp) => {
    const file = path.join(tmp, PLAN);
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(
      '`config.food_mint` → `config.data_mint`', '`config.food_mint` → `config.wood_mint`'));
    const result = run(['--check', '--root', tmp]);
    assert.equal(result.code, 1, result.out);
    assert.match(result.out, /устарел|нет переименования минт-поля/);
  });
  withRoot((tmp) => {
    const file = path.join(tmp, PLAN);
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(
      'не начато — требуется утверждение владельцем канонического mapping', 'выполнено'));
    const result = run(['--check', '--root', tmp]);
    assert.equal(result.code, 1, result.out);
    assert.match(result.out, /устарел/);
  });
});

test('отсутствующий план — ошибка гейта', () => {
  withRoot((tmp) => {
    fs.rmSync(path.join(tmp, PLAN));
    const result = run(['--check', '--root', tmp]);
    assert.equal(result.code, 1, result.out);
    assert.match(result.out, /нет docs\/RESOURCE_RENAME_PLAN\.md/);
  });
});
