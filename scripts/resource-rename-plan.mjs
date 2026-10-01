#!/usr/bin/env node
/**
 * План переименования ресурсов (шаг C пункта 12) — документ на утверждение владельцу.
 *
 * Зачем отдельный артефакт. Переименование затрагивает шесть слоёв (Rust → IDL → backend →
 * frontend → game → скрипты/тесты), и до утверждения канонического mapping его начинать
 * запрещено. Этот файл — единственное место, где видно, ЧТО именно будет переименовано и в
 * какое имя, с точным списком старых идентификаторов и без обещаний совместимости.
 *
 *   node scripts/resource-rename-plan.mjs --write   пересобрать docs/RESOURCE_RENAME_PLAN.md
 *   node scripts/resource-rename-plan.mjs --check   гейт: план существует и не устарел
 *   --root <dir>                                    считать репозиторий из другого каталога
 *
 * Источники (оба гейтятся своими проверками): docs/RESOURCE_MANIFEST.json (канонические
 * имена, место хранения минта, legacy-алиасы) и docs/RESOURCE_EVIDENCE.json (классификация
 * и флаги). Никаких ручных списков здесь нет: имена выводятся из канона.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const rootIndex = argv.indexOf('--root');
const ROOT = rootIndex >= 0 ? path.resolve(argv[rootIndex + 1]) : path.resolve(HERE, '..');
const PLAN = 'docs/RESOURCE_RENAME_PLAN.md';
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));

const camel = (s) => s.charAt(0).toLowerCase() + s.slice(1);
const snake = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();

/** Целевое имя поля минта: `config.<snake>_mint` или `material_mints.<snake>`. */
export function targetMintField(resource) {
  const [holder] = String(resource.mintSource ?? '').split('.');
  return holder === 'config' ? `config.${snake(resource.kind)}_mint` : `material_mints.${snake(resource.kind)}`;
}

/** Старые идентификаторы ресурса в backend-картах и IDL (без дублей и уже канонических). */
export function legacyNames(resource, idlNames) {
  const names = new Set();
  const idlName = idlNames[resource.id];
  if (idlName && idlName !== resource.kind) names.add(idlName);
  for (const alias of resource.legacyAliases ?? []) {
    if (alias !== resource.kind && alias !== camel(resource.kind) && alias !== snake(resource.kind)) names.add(alias);
  }
  return [...names].sort();
}

/** Типы полей `Config`/`MaterialMints` из state.rs — для колонки «Field type» (rename их не меняет). */
export function parseMintFieldTypes() {
  const src = read('aof-core/src/state.rs');
  const types = new Map();
  for (const name of ['Config', 'MaterialMints']) {
    const block = new RegExp(`pub struct ${name}\\s*\\{([\\s\\S]*?)\\n\\}`).exec(src)?.[1] ?? '';
    for (const line of block.split('\n')) {
      const m = /pub\s+(\w+)\s*:\s*([A-Za-z0-9_<>:]+)/.exec(line.trim());
      if (m) types.set(`${name}.${m[1]}`, m[2]);
    }
  }
  return types;
}

export function buildPlan() {
  const manifest = JSON.parse(read('docs/RESOURCE_MANIFEST.json'));
  const drift = manifest.drift ?? [];
  const evidence = JSON.parse(read('docs/RESOURCE_EVIDENCE.json'));
  const idl = JSON.parse(read('aof_backend/src/idl/aof_core.json'));
  const idlNames = (idl.types.find((t) => t.name === 'ResourceKind')?.type.variants ?? []).map((v) => v.name);
  const byKind = new Map(evidence.resources.map((r) => [r.kind, r]));
  const fieldTypes = parseMintFieldTypes();
  const backendDrift = drift.filter((d) => d.type === 'backend-legacy-name');
  const rows = manifest.resources.map((r) => {
    const flow = byKind.get(r.kind) ?? { status: 'unknown', flow: { flags: {} } };
    const [holder, before] = String(r.mintSource ?? '').split('.');
    const after = targetMintField(r).split('.')[1];
    return {
      index: r.id,
      kind: r.kind,
      display: r.display,
      apiName: r.apiName,
      idlBefore: idlNames[r.id] ?? null,
      idlAfter: r.kind,
      backendBefore: backendDrift.filter((d) => d.kind === r.kind).map((d) => ({ key: d.name, file: d.file })),
      mintBefore: r.mintSource,
      mintAfter: targetMintField(r),
      fieldHolder: holder,
      fieldBefore: before ?? null,
      fieldAfter: after,
      fieldType: fieldTypes.get(`${holder === 'config' ? 'Config' : 'MaterialMints'}.${before}`) ?? '?',
      // Rename не трогает ни порядок вариантов, ни порядок полей структуры.
      orderUnchanged: true,
      status: flow.status,
      flags: flow.flow?.flags ?? {},
    };
  });
  // Условие владельца: mapping — биекция. Один старый идентификатор → ровно один
  // канонический, и никакие два старых поля не ведут в одно каноническое.
  const seenOld = new Map();
  const seenNew = new Map();
  const collisions = [];
  for (const row of rows) {
    for (const old of [row.fieldBefore, row.idlBefore, ...row.backendBefore.map((b) => b.key)].filter(Boolean)) {
      if (seenOld.has(old)) collisions.push({ old, kinds: [seenOld.get(old), row.kind] });
      else seenOld.set(old, row.kind);
    }
    if (seenNew.has(row.fieldAfter)) collisions.push({ new: row.fieldAfter, kinds: [seenNew.get(row.fieldAfter), row.kind] });
    else seenNew.set(row.fieldAfter, row.kind);
  }
  return {
    schemaVersion: 1,
    state: drift.length === 0 ? 'done' : 'not-started',
    drift,
    bijection: collisions.length === 0,
    collisions,
    rows,
  };
}

export function toMarkdown(plan) {
  const renames = plan.rows.filter((r) => r.idlBefore && r.idlBefore !== r.kind);
  const backendKeys = plan.rows.flatMap((r) => r.backendBefore.map((entry) => ({ kind: r.kind, key: entry.key, file: entry.file })));
  const mintFields = plan.rows.filter((r) => r.mintBefore !== r.mintAfter);
  const players = plan.rows.filter((r) => r.status === 'active-player').map((r) => r.kind);
  const internal = plan.rows.filter((r) => r.status === 'active-internal').map((r) => r.kind);
  const candidates = plan.rows.filter((r) => r.status === 'candidate-dead').map((r) => r.kind);
  const lines = [
    '# План переименования ресурсов (шаг C пункта 12)',
    '',
    `Статус: **${plan.state === 'done' ? 'выполнено' : 'не начато — требуется утверждение владельцем канонического mapping'}**.`,
    'Документ собирается `node scripts/resource-rename-plan.mjs --write`, гейт — `--check`',
    '(`tests/readiness/resource-rename-plan.test.cjs`). Источники: `docs/RESOURCE_MANIFEST.json`',
    '(канон имён и мест хранения) и `docs/RESOURCE_EVIDENCE.json` (классификация и флаги).',
    '',
    `Долг, который план закрывает: **${plan.drift.length}** расхождений — ${renames.length} IDL-вариантов`,
    `и ${backendKeys.length} legacy-ключей backend-карт (в ${new Set(backendKeys.map((k) => k.file)).size} файле(ах)).`,
    '',
    '## Порядок работ (шаг C владельца, сверху вниз, один вертикальный срез за раз)',
    '',
    '1. **Rust**: поля структур `Config`/`MaterialMints` и `mint_for_kind` — переименование полей',
    '   (байтовый layout не меняется, порядок не меняется);',
    '2. **таблицы программы**: `expected_resource_mint` в ордербуке, `resource_kind_for_tool` в майнинге,',
    '   рецепты `craft_recipe.rs`, аргументы `init_material_mints`;',
    '3. **seeds/константы/события/ошибки**: только если строка содержит farming-имя; варианты enum не',
    '   переставлять, ошибки не сдвигать;',
    '4. **backend**: карты kind (`routes/resources.ts` и др.) и любые `cfg.foodMint`-подобные обращения —',
    '   на канонические (`cfg.dataMint`);',
    '5. **frontend**: каталоги, i18n, интенты, ключи API;',
    '6. **game**: каталоги Godot-клиента;',
    '7. **скрипты/тесты**: гейты, фикстуры, ожидания;',
    '8. **IDL**: перегенерация из Rust (`python3 scripts/idl-from-source.py aof_core --types ResourceKind`,',
    '   затем `python3 scripts/idl-sync-ts.py`, `python3 scripts/check-idl-drift.py`);',
    '9. **docs**: `docs/RESOURCE_MANIFEST.md`, этот файл, `docs/RESOURCE_EVIDENCE.md`.',
    '',
    'Правила: **без алиасов и совместимости** (`food_mint → data_mint`, `wood_mint → circuit_mint`,',
    '`stone_mint → silicon_mint` — прямо), варианты enum не переставлять, layout-report обязателен только',
    'если поле удаляется или меняет порядок (в этом плане таких изменений нет).',
    '',
    '## Полная таблица соответствий (27 строк)',
    '',
    'Ни один идентификатор не остаётся алиасом: старые имена удаляются из active code целиком.',
    '`Old Rust/IDL/backend name` перечисляет все старые написания ресурса, которые существуют в коде',
    '(поле структуры, вариант IDL, ключи backend-карт). Тип поля и порядок берутся из `state.rs`;',
    'переименование поля не меняет ни тип, ни место в структуре, ни дискриминанты enum.',
    '',
    '| Index | Old Rust/IDL/backend name | Canonical ResourceKind | Field type | Order unchanged |',
    '|---:|---|---|---|---:|',
  ];
  for (const r of plan.rows) {
    const olds = [r.fieldBefore, r.idlBefore, ...r.backendBefore.map((b) => b.key)].filter(Boolean);
    const oldText = olds.map((o) => `\`${o}\``).join(', ');
    lines.push(`| ${r.index} | ${oldText} | ${r.kind} (\`${r.fieldHolder}.${r.fieldAfter}\`) | ${r.fieldType} | yes (rename only) |`);
  }
  lines.push('', `Минт-поля к переименованию (${mintFields.length}):`, '');
  for (const r of mintFields) lines.push(`* \`${r.mintBefore}\` → \`${r.mintAfter}\` (${r.kind})`);
  lines.push('', `Legacy-ключи backend-карт (${backendKeys.length}):`, '');
  for (const r of backendKeys) lines.push(`* \`${r.key}\` → \`${plan.rows.find((x) => x.kind === r.kind).apiName}\` (${r.kind}, ${r.file})`);
  lines.push('', '## Что запрещено в этом плане', '',
    '* оставлять алиасы или читать оба имени «на время перехода»;',
    '* переставлять варианты `ResourceKind` или сдвигать коды ошибок;',
    '* удалять AmberQuartz, SoulCore, Data, Dataset, Compute, Mind и связанные mint-поля/капы до отдельного',
    '  решения владельца;',
    '* трогать семь отключённых инструкций из `docs/DEAD_CODE_EVIDENCE.md`;',
    '* смешивать переименование с изменением экономики (формулы, капы, награды).',
    '',
    '## Классификация на момент утверждения',
    '',
    `* active-player (${players.length}): ${players.join(', ')};`,
    `* active-internal (${internal.length}): ${internal.join(', ')};`,
    `* candidate-dead (${candidates.length}): ${candidates.join(', ')}.`,
    '',
    'Статусы выведены из кода (`docs/RESOURCE_EVIDENCE.md`), а не назначены руками; удаление кандидатов',
    'делается отдельным шагом после утверждения, не вместе с переименованием.',
    '',
    '## Проверка после переименования',
    '',
    '```bash',
    'node scripts/resource-manifest.mjs --write && node scripts/resource-manifest.mjs --check  # drift 43 → 0',
    'python3 scripts/idl-from-source.py aof_core --types ResourceKind',
    'python3 scripts/idl-sync-ts.py && python3 scripts/check-idl-drift.py',
    'python3 scripts/gen-core-instruction-table.py --check',
    'node scripts/resource-usage.mjs --write && node scripts/resource-usage.mjs --check',
    'node --test tests/readiness/*.test.cjs',
    '```',
    '',
    'Готовность шага C: `drift` в манифесте пуст, в active-коде нет farming-идентификаторов,',
    '`unclassified` в инвентаре инструкций — 0, readiness зелёный, затем `anchor build` +',
    '`git diff -- idls/` на машине с тулчейном.',
    '');
  return `${lines.join('\n')}\n`;
}

export function check() {
  const errors = [];
  if (!exists(PLAN)) return [`нет ${PLAN}: node scripts/resource-rename-plan.mjs --write`];
  const plan = buildPlan();
  if (read(PLAN) !== toMarkdown(plan)) errors.push(`${PLAN} устарел: node scripts/resource-rename-plan.mjs --write`);
  const text = read(PLAN);
  for (const row of plan.rows) {
    if (!text.includes(`| ${row.index} |`) || !text.includes(`| ${row.kind} (`)) {
      errors.push(`${row.kind}: нет строки в таблице соответствий`);
    }
    if (!text.includes(`| ${row.fieldType} | yes (rename only) |`)) {
      errors.push(`${row.kind}: в строке не зафиксирован тип поля и неизменность порядка`);
    }
    if (row.mintBefore && !text.includes(`\`${row.mintBefore}\` → \`${row.mintAfter}\``)) {
      errors.push(`${row.kind}: нет переименования минт-поля ${row.mintBefore} → ${row.mintAfter}`);
    }
  }
  if (!plan.bijection) {
    for (const c of plan.collisions) errors.push(`mapping не биекция: ${JSON.stringify(c)}`);
  }
  if (plan.rows.some((r) => r.fieldType === '?')) errors.push('у части минт-полей не определён тип — план не готов к утверждению');
  if (plan.rows.some((r) => !r.orderUnchanged)) errors.push('план не фиксирует неизменность порядка полей');
  if (plan.state !== 'not-started' && plan.state !== 'done') errors.push(`неизвестное состояние плана: ${plan.state}`);
  if (plan.state === 'not-started' && !text.includes('требуется утверждение владельцем')) {
    errors.push('план обязан явно требовать утверждения владельца, пока drift не пуст');
  }
  if (plan.state === 'done' && text.includes('требуется утверждение владельцем')) {
    errors.push('переименование выполнено, но план всё ещё просит утверждение');
  }
  return errors;
}

function main() {
  const plan = buildPlan();
  const md = toMarkdown(plan);
  if (argv.includes('--write')) {
    fs.writeFileSync(path.join(ROOT, PLAN), md);
    console.log(`план переименования записан: ${plan.rows.length} ресурсов, долг ${plan.drift.length}, состояние ${plan.state}`);
    return;
  }
  if (argv.includes('--check')) {
    const errors = check();
    if (errors.length) { console.error(`resource-rename-plan: ${errors.length} проблем(а):`); for (const e of errors) console.error(`  - ${e}`); process.exit(1); }
    console.log(`resource-rename-plan: план актуален (${plan.rows.length} ресурсов, долг ${plan.drift.length}, состояние ${plan.state})`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
