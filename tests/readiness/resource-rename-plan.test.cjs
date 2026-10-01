'use strict';
/*
 * План переименования ресурсов (scripts/resource-rename-plan.mjs, шаг C пункта 12).
 *
 * Канонический mapping утверждён владельцем, Rust и IDL уже переименованы; гейт держит документ
 * точным (таблица «было → стало» на все 27 ресурсов, честный статус по слоям) и требует ноль
 * farming-идентификаторов в active code. Старые имена инструкций тоже являются долгом; только
 * Anchor-механика `seeds` и явные mapping/evidence-документы исключены из скана.
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
    'scripts/resource-drift.mjs', 'scripts/resource-rename-plan.mjs', 'scripts/resource-manifest.mjs', 'scripts/resource-usage.mjs',
    'scripts/idl-from-source.py', 'scripts/layout-baseline.mjs']) {
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
  if (built.left === 0) assert.match(doc, /Результат rename-scan: \*\*чисто/);
  else assert.match(doc, /Результат rename-scan: \*\*есть остатки —/);
  assert.match(doc, /Статус шага C: \*\*ОТКРЫТ — не завершён и не принят/);
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

test('старое имя инструкции роняет гейт, Anchor-механика seeds остаётся исключением', () => {
  withRoot((tmp) => {
    assert.equal(run(['--write', '--root', tmp]).code, 0, 'документ в копии обязан быть свежим');
    append(tmp, 'aof-core/src/state.rs', `
pub fn seeds_machinery<'a>(seeds: &'a [&'a [u8]]) -> &'a [&'a [u8]] { seeds }
#[account(seeds = [b"material_mints"], bump)]
`);
    append(tmp, 'aof_backend/src/lib/pda.ts', `
const seeds: (Buffer | Uint8Array)[] = [Buffer.from('x')];
export const find = () => PublicKey.findProgramAddressSync(seeds, PROGRAM_ID);
`);
    let planResult = run(['--root', tmp]);
    assert.equal(planResult.code, 0, planResult.out);
    assert.equal(JSON.parse(planResult.out).left, 0, 'Anchor PDA seeds не считаются ресурсом Neuron');

    append(tmp, 'aof-core/src/instructions/init_material_mints.rs', '\nmaterial_mints.seeds = neuron;\n');
    planResult = run(['--root', tmp]);
    assert.equal(planResult.code, 0, planResult.out);
    assert.ok(JSON.parse(planResult.out).layers.flatMap((layer) => layer.hits)
      .some((hit) => hit.resource === 'Neuron' && hit.text.includes('material_mints.seeds')),
      'resource field material_mints.seeds must be detected, not hidden as PDA syntax');

    append(tmp, 'aof-core/src/lib.rs', `
pub fn plant_seeds(ctx: Context<PlantSeeds>) -> Result<()> { Ok(()) }
`);
    planResult = run(['--root', tmp]);
    assert.equal(planResult.code, 0, planResult.out);
    const current = JSON.parse(planResult.out);
    assert.ok(current.layers.flatMap((layer) => layer.hits)
      .some((hit) => hit.rule === 'instruction' && hit.token === 'plant_seeds'),
      'старое имя инструкции должно быть явным hit гейта');
    const result = run(['--check', '--root', tmp]);
    assert.equal(result.code, 1, result.out);
    assert.match(result.out, /legacy-идентификаторов в active code: 2/);
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
      'Статус шага C: **ОТКРЫТ — не завершён и не принят**', 'Статус шага C: **ЗАВЕРШЁН**'));
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
