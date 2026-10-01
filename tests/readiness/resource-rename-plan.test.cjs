'use strict';
/*
 * План переименования ресурсов (scripts/resource-rename-plan.mjs, шаг C пункта 12).
 *
 * Канонический mapping утверждён владельцем, Rust и IDL уже переименованы; гейт держит документ
 * точным (таблица «было → стало» на все 27 ресурсов, честный статус по слоям) и требует ноль
 * farming-идентификаторов в active code. Ложные срабатывания запрещены: имена инструкций
 * (`plant_seeds`, `harvest_wheat`, `collect_flour`, `collect_bread`, `collect_well_water`,
 * `claim_flour`, `potato_*`) и Anchor-механика `seeds` остатком не считаются.
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
const plan = () => JSON.parse(run([]).out);

/** Копия репозитория в объёме, который читает resource-rename-plan.mjs. */
function makeRoot() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aof-rename-'));
  for (const rel of ['docs', 'aof-core/src', 'aof_backend/src', 'frontend/src', 'game', 'tests',
    'scripts/resource-rename-plan.mjs', 'scripts/resource-manifest.mjs', 'scripts/resource-usage.mjs',
    'scripts/rebrand.mjs', 'scripts/idl-from-source.py']) {
    fs.cpSync(path.join(root, rel), path.join(tmp, rel), { recursive: true });
  }
  return tmp;
}
const withRoot = (fn) => { const tmp = makeRoot(); try { return fn(tmp); } finally { fs.rmSync(tmp, { recursive: true, force: true }); } };
const append = (tmp, rel, text) => fs.appendFileSync(path.join(tmp, rel), text);

test('гейт зелёный, документ честно отражает состояние переименования', () => {
  const result = run(['--check']);
  assert.equal(result.code, 0, result.out);
  const doc = read(PLAN);
  const built = plan();
  const wording = built.left === 0 ? 'выполнено' : 'в работе — канон утверждён';
  assert.match(doc, new RegExp(`Статус: \\*\\*${wording}`));
  let sum = 0;
  for (const layer of built.layers) {
    sum += layer.hits.length;
    assert.ok(doc.includes(`| ${layer.label} | ${layer.files} | ${layer.hits.length} |`),
      `${layer.label}: строка слоя не совпадает с автосканом`);
  }
  assert.equal(built.left, sum);
});

test('все 27 ресурсов имеют строку «было → стало» с типом поля и неизменным порядком', () => {
  const doc = read(PLAN);
  const built = plan();
  assert.equal(built.rows.length, 27);
  for (const row of built.rows) {
    const line = doc.split('\n').find((l) => l.startsWith(`| ${row.index} |`));
    assert.ok(line, `${row.kind}: нет строки ${row.index}`);
    assert.ok(line.includes(`\`${row.fieldBefore}\``), `${row.kind}: нет исторического поля ${row.fieldBefore}`);
    assert.ok(line.includes(`\`${row.idlBefore}\``), `${row.kind}: нет исторического IDL-имени ${row.idlBefore}`);
    assert.ok(line.includes(`${row.kind} (\`${row.fieldHolder}.${row.fieldAfter}\`)`), `${row.kind}: нет канонической цели`);
    assert.ok(line.includes(`| ${row.fieldType} | yes (rename only) |`), `${row.kind}: нет типа поля/неизменности порядка`);
    assert.ok(doc.includes(`\`${row.mintBefore}\` → \`${row.mintAfter}\``), `${row.kind}: нет переименования минт-поля`);
  }
  assert.equal(built.bijection, true, 'mapping обязан быть биекцией');
});

test('прямые переименования и запреты шага C зафиксированы в плане', () => {
  const doc = read(PLAN);
  for (const direct of [
    '`config.food_mint` → `config.data_mint`',
    '`config.wood_mint` → `config.circuit_mint`',
    '`config.stone_mint` → `config.silicon_mint`',
  ]) assert.ok(doc.includes(direct), `нет прямого переименования ${direct}`);
  assert.match(doc, /без алиасов и совместимости/);
  assert.match(doc, /варианты enum не переставлять/);
  assert.match(doc, /удалять AmberQuartz, SoulCore, Data, Dataset, Compute, Mind/);
  assert.match(doc, /семь отключённых инструкций/);
  assert.match(doc, /layout-report обязателен/);
  assert.doesNotMatch(doc, /временно поддерживаем оба имени|alias keeps/i);
});

test('имена инструкций и Anchor-механика seeds остатком не считаются', () => {
  withRoot((tmp) => {
    assert.equal(run(['--write', '--root', tmp]).code, 0, 'документ в копии обязан быть свежим');
    append(tmp, 'aof-core/src/lib.rs', `
pub fn plant_seeds(ctx: Context<PlantSeeds>) -> Result<()> { harvest_wheat(ctx) }
pub fn harvest_wheat(ctx: Context<HarvestWheat>) -> Result<()> { collect_flour(ctx) }
pub fn collect_flour(ctx: Context<CollectFlour>) -> Result<()> { collect_bread(ctx) }
pub fn collect_bread(ctx: Context<CollectBread>) -> Result<()> { collect_well_water(ctx) }
pub fn collect_well_water(ctx: Context<CollectWellWater>) -> Result<()> { Ok(()) }
`);
    append(tmp, 'aof-core/src/state.rs', `
pub fn seeds_machinery<'a>(seeds: &'a [&'a [u8]]) -> &'a [&'a [u8]] { seeds }
#[account(seeds = [b"material_mints"], bump)]
`);
    append(tmp, 'aof_backend/src/lib/pda.ts', `
const seeds: (Buffer | Uint8Array)[] = [Buffer.from('x')];
export const find = () => PublicKey.findProgramAddressSync(seeds, PROGRAM_ID);
`);
    const result = run(['--check', '--root', tmp]);
    assert.equal(result.code, 0, result.out);
  });
});

test('реальный остаток в active code роняет гейт', () => {
  withRoot((tmp) => {
    assert.equal(run(['--write', '--root', tmp]).code, 0, 'документ в копии обязан быть свежим');
    append(tmp, 'aof_backend/src/lib/leftover.ts', '\nexport const woodMint = 1;\nexport const user_stone = 2;\n');
    const result = run(['--check', '--root', tmp]);
    assert.equal(result.code, 1, result.out);
    assert.match(result.out, /устарел|не отражены/);
  });
});

test('преждевременное «выполнено» и правка цели роняют гейт', () => {
  withRoot((tmp) => {
    const p = path.join(tmp, PLAN);
    fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(
      'в работе — канон утверждён', 'выполнено'));
    const result = run(['--check', '--root', tmp]);
    assert.equal(result.code, 1, result.out);
    assert.match(result.out, /устарел/);
  });
  withRoot((tmp) => {
    const p = path.join(tmp, PLAN);
    fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(
      '`config.food_mint` → `config.data_mint`', '`config.food_mint` → `config.wood_mint`'));
    const result = run(['--check', '--root', tmp]);
    assert.equal(result.code, 1, result.out);
    assert.match(result.out, /устарел|нет переименования минт-поля/);
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
