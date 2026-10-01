#!/usr/bin/env node
/**
 * План переименования ресурсов (шаг C пункта 12) и гейт «farming-идентификаторов в active code нет».
 *
 * Канонический mapping утверждён владельцем; здесь он зафиксирован один раз и проверяется
 * автоматически:
 *
 *   node scripts/resource-rename-plan.mjs --write   пересобрать docs/RESOURCE_RENAME_PLAN.md
 *   node scripts/resource-rename-plan.mjs --check   гейт: план точен, долг в active code равен 0
 *   --root <dir>                                    считать репозиторий из другого каталога
 *
 * Источники (оба гейтятся своими проверками): docs/RESOURCE_MANIFEST.json (канон имён, место
 * хранения минта, исторические имена `historicalField`/`historicalIdlName`/`legacyAliases`) и
 * docs/RESOURCE_EVIDENCE.json (классификация и флаги). Никаких ручных списков здесь нет.
 *
 * Что именно считается остатком. Legacy-идентификатор — это старое имя ресурса, использованное
 * как идентификатор ресурса: `<alias>_mint`, `user_<alias>`, `mm.<alias>`, `<alias>Mint`,
 * литерал `"<alias>"`/`"<PascalAlias>"` как имя ресурса и т. п. НЕ считаются остатком:
 *  * старые имена инструкций НЕ исключаются: farming-инструкции переименованы во всех слоях,
 *    discriminator пересчитан (deployment не выполнялся), старые формы обязаны ронять гейт;
 *  * Anchor/PDA-механика `seeds` (`seeds = [..]`, `let seeds`, `&[seeds]`, `findProgramAddressSync(seeds…)`)
 *    — это не ресурс `Neuron`; текст регулярного выражения, который проверяет эти атрибуты,
 *    также не считается использованием ресурса;
 *  * комментарии (не active code) и строковые PDA-литералы `b"…"`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
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
const pascal = (s) => s.replace(/(^|_)([a-z0-9])/g, (_, __, c) => c.toUpperCase());

/** Старые Anchor-инструкции: остаток в active code роняет гейт; исключений нет. */
/** Старые имена инструкций: после шага C не должны встречаться в active code ни в одном слое. */
const LEGACY_INSTRUCTION_NAMES = [
  'plant_seeds', 'harvest_wheat', 'collect_flour', 'collect_bread', 'collect_well_water',
  'start_milling', 'start_baking',
  'init_potato_bank', 'potato_spin_commit', 'potato_spin_reveal', 'potato_spin_expire',
  'set_potato_bank_paused',
];

/** Формы старого имени инструкции: snake, camel и Pascal (для `Context<PlantSeeds>`). */
function legacyInstructionForms(name) {
  const pascal = name.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  const camel = name.charAt(0).toLowerCase() + pascal.slice(1);
  return [name, camel, pascal];
}

/** Anchor/PDA-механика `seeds` — не ресурс Neuron. */
const NEURON_MACHINERY = /(?<![A-Za-z0-9_.])seeds\s*=\s*\\?\[|(?:let|const|var)\s+seeds\b|\b(?:config|signer)_seeds\b|&\s*\[seeds\]|\[seeds\b|\(seeds\b|seeds\s*\)|seeds\.[a-z]|\.\.\.seeds|findProgramAddressSync|createProgramAddressSync|find\(seeds|(?<![A-Za-z0-9_.])seeds\s*:\s*(?:\(|&|Buffer|Uint8Array)|["']seeds["']\s*:\s*seeds\b|lookup\([^,]+,\s*["']seeds["']\)|seeds\s*===\s*null|\bseeds\s*\+|seeds\\s\*[:=]/;

/**
 * Файлы, которые *описывают* legacy-имена (mapping, alias-списки, негативные фикстуры гейта),
 * а не используют их как ресурсные идентификаторы. Список виден в плане вместе с причиной;
 * runtime-кода продукта в нём быть не может (это проверяет гейт `--check`).
 */
const SCAN_EXEMPT_FILES = new Map([
  ['scripts/resource-drift.mjs', 'drift detector contains its own legacy tokens, explicit mapping parser, and detector-level Anchor syntax rules; not product source'],
  ['scripts/resource-manifest.mjs', 'список farming-алиасов, запрещённых в player-facing `display`'],
  ['scripts/resource-usage.mjs', 'список алиасов для evidence-скана (кто где встречается)'],
  ['scripts/resource-rename-plan.mjs', 'список legacy-форм и этот перечень — правила гейта'],
  ['scripts/layout-baseline.mjs', 'явная таблица old→canonical для доказательства rename без смены layout; не runtime'],
  ['scripts/idl-from-source.py', 'Anchor PDA `seeds` в генераторе IDL — не ресурс Neuron'],
  ['tests/readiness/resource-rename-plan.test.cjs', 'негативные фикстуры: остаток обязан ронять гейт'],
  ['tests/readiness/resource-manifest.test.cjs', 'негативные фикстуры алиасов в `display`'],
  ['tests/readiness/layout-baseline.test.cjs', 'checks the historical `MaterialMints.seeds → neuron` rename against the pre-rename layout; mapping test, not product code'],
]);

/** Слои из порядка работ владельца; порядок = порядок переименования. */
const LAYERS = [
  { id: 'rust', label: 'Rust (aof-core/src, programs/*/src)', prefixes: ['aof-core/src', 'programs'] },
  { id: 'idl', label: 'IDL и TS-типы (aof_backend/src/idl)', prefixes: ['aof_backend/src/idl'] },
  { id: 'backend', label: 'Backend (aof_backend/src, aof_backend/scripts)', prefixes: ['aof_backend/src', 'aof_backend/scripts'] },
  { id: 'frontend', label: 'Frontend (frontend/src)', prefixes: ['frontend/src'] },
  { id: 'game', label: 'Game (game/)', prefixes: ['game'] },
  { id: 'tests-scripts', label: 'Тесты и скрипты (tests, scripts)', prefixes: ['tests', 'scripts'] },
];
const SCAN_EXT = new Set(['.rs', '.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.gd', '.cs', '.tscn', '.py', '.sh']);

/** Убрать комментарии: они не active code (в них имена шага C упоминаются законно). */
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1')
    .replace(/(^|[^:'"\\])#[^\n]*/gm, '$1');
}

/** Все legacy-написания ресурса: историческое поле, алиасы, историческое имя в IDL. */
export function legacyForms(resource) {
  const aliases = new Set((resource.legacyAliases ?? []).map(String));
  const forms = { snake: new Set(), camel: new Set(), pascal: new Set() };
  if (resource.historicalField) forms.snake.add(resource.historicalField);
  if (resource.historicalIdlName) forms.pascal.add(resource.historicalIdlName);
  for (const alias of aliases) {
    forms.snake.add(alias);
    forms.camel.add(camel(alias));
    forms.pascal.add(pascal(alias));
  }
  return forms;
}

const SUFFIXES = ['mint', 'supply', 'cost', 'needed', 'base', 'mult', 'amount', 'burned', 'minted24h', 'price', 'unit', 'cap'];
const ACCESSORS = ['mm', 'materials', 'material_mints', 'config', 'cfg', 'roles', 'mints'];

/**
 * Правила поиска остатка. Границы не включают `-`, `.`, `_`: иначе Tailwind-классы
 * (`bg-wheat-500`) и `material_mints.neuron` дают ложные срабатывания. Литерал-ключ
 * `"seeds": [` — это PDA-механика Anchor, а не ресурс (см. исключения в scanLayer).
 */
export function legacyPatterns(resource) {
  const { snake: snakes, camel: camels, pascal: pascals } = legacyForms(resource);
  const rules = [];
  const add = (id, source, flags = 'g') => rules.push({ id, re: new RegExp(source, flags) });
  for (const s of snakes) {
    const forms = [s, `user_${s}`, ...SUFFIXES.map((suffix) => `${s}_${suffix}`)];
    add('field', `(?<![A-Za-z0-9_-])(${forms.join('|')})(?![A-Za-z0-9_-])`);
    add('accessor', `(?:${ACCESSORS.join('|')})[.]${s}(?![A-Za-z0-9_])`);
    add('literal', `(['"])${s}\\1`);
    add('key', `(?<![A-Za-z0-9_-])${s}(?=\\s*:)`);
  }
  for (const c of camels) {
    const forms = [c, `user${pascal(c)}`, ...SUFFIXES.map((suffix) => `${c}${pascal(suffix)}`)];
    add('field', `(?<![A-Za-z0-9_-])(${forms.join('|')})(?![A-Za-z0-9_-])`);
    add('literal', `(['"])${c}\\1`);
  }
  for (const p of pascals) add('literal', `(['"])${p}\\1`);
  return rules;
}

/** Отслеживаемые файлы: `git ls-files`, а вне git-репозитория (тесты на временной копии) — обход. */
export function trackedFiles() {
  try {
    return execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
      cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).split('\0').filter((rel) => rel && fs.existsSync(path.join(ROOT, rel)));
  } catch {
    const skip = /(^|\/)(node_modules|target|dist|build|\.git|__pycache__)(\/|$)/;
    const out = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        const rel = dir ? `${dir}/${entry.name}` : entry.name;
        if (skip.test(rel)) continue;
        if (entry.isDirectory()) walk(rel);
        else out.push(rel);
      }
    };
    walk('');
    return out.sort();
  }
}

/** Найти остатки legacy-идентификаторов в файлах слоя. */
export function scanLayer(files, resources) {
  const byResource = resources.map((r) => ({ resource: r, rules: legacyPatterns(r) }));
  const hits = [];
  for (const rel of files) {
    const text = stripComments(read(rel));
    for (const { resource, rules } of byResource) {
      for (const { id: rule, re } of rules) {
        re.lastIndex = 0;
        for (const m of text.matchAll(re)) {
          const start = m.index ?? 0;
          const line = text.slice(0, start).split('\n').length;
          const raw = text.split('\n')[line - 1] ?? '';
          const after = text.slice(start + m[0].length, start + m[0].length + 12);
          const token = (m[1] ?? m[0]).trim();
          if (NEURON_MACHINERY.test(raw)) continue;
          if (/^["']?\s*:\s*\[/.test(after)) continue;                  // "seeds": [ — PDA Anchor
          if (/className|tailwind|bg-|text-|from-|to-/.test(raw) && /-/.test(m[0])) continue;
          if (/b"[^"]*"/.test(raw)) continue;                            // PDA-литералы Rust
          hits.push({ file: rel, line, rule, resource: resource.kind, token, text: raw.trim().slice(0, 120) });
        }
      }
    }
  }
  for (const rel of files) {
    const text = stripComments(read(rel));
    for (const name of LEGACY_INSTRUCTION_NAMES) {
      for (const form of legacyInstructionForms(name)) {
        const re = new RegExp(`(?<![A-Za-z0-9_])${form}(?![A-Za-z0-9_])`, 'g');
        for (const m of text.matchAll(re)) {
          const line = text.slice(0, m.index).split('\n').length;
          const raw = text.split('\n')[line - 1] ?? '';
          if (NEURON_MACHINERY.test(raw)) continue;                       // Anchor-механика, не инструкция
          hits.push({ file: rel, line, rule: 'instruction', resource: '—', token: name, text: raw.trim().slice(0, 120) });
        }
      }
    }
  }
  const unique = new Map();
  for (const hit of hits) {
    const key = `${hit.file}:${hit.line}:${hit.resource === '—' ? hit.token : hit.resource}`;
    unique.set(key, hit);
  }
  return [...unique.values()].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}

/** Типы полей `Config`/`MaterialMints` из state.rs — rename их не меняет. */
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
  const byKind = new Map(evidence.resources.map((r) => [r.kind, r]));
  const fieldTypes = parseMintFieldTypes();
  const files = trackedFiles().filter((rel) => SCAN_EXT.has(path.extname(rel)) && !rel.startsWith('docs/')
    && !SCAN_EXEMPT_FILES.has(rel));
  const resources = manifest.resources;
  const layers = LAYERS.map((layer) => {
    const layerFiles = files.filter((rel) => layer.prefixes.some((p) => rel === p || rel.startsWith(`${p}/`))
      && !(layer.id === 'backend' && rel.startsWith('aof_backend/src/idl/')));
    const hits = scanLayer(layerFiles, resources);
    return { ...layer, files: layerFiles.length, hits };
  });
  const rows = resources.map((r) => {
    const flow = byKind.get(r.kind) ?? { status: 'unknown', flow: { flags: {} } };
    const [holder] = String(r.mintSource ?? '').split('.');
    const fieldAfter = String(r.mintSource ?? '').split('.')[1] ?? null;
    const holderStruct = holder === 'config' ? 'Config' : 'MaterialMints';
    const fieldBefore = r.historicalField ?? fieldAfter;
    return {
      index: r.id,
      kind: r.kind,
      apiName: r.apiName,
      display: r.display,
      idlBefore: r.historicalIdlName ?? r.kind,
      idlAfter: r.kind,
      fieldHolder: holder,
      fieldBefore,
      fieldAfter,
      mintBefore: `${holder}.${fieldBefore}`,
      mintAfter: r.mintSource,
      fieldType: fieldTypes.get(`${holderStruct}.${fieldAfter}`) ?? '?',
      orderUnchanged: true,
      status: flow.status,
      flags: flow.flow?.flags ?? {},
    };
  });
  // Условие владельца: mapping — биекция. Один старый идентификатор → ровно один канонический.
  const seenOld = new Map();
  const seenNew = new Map();
  const collisions = [];
  for (const row of rows) {
    for (const old of [row.fieldBefore, row.idlBefore].filter(Boolean)) {
      if (seenOld.has(old) && seenOld.get(old) !== row.kind) collisions.push({ old, kinds: [seenOld.get(old), row.kind] });
      else seenOld.set(old, row.kind);
    }
    if (seenNew.has(row.fieldAfter)) collisions.push({ new: row.fieldAfter, kinds: [seenNew.get(row.fieldAfter), row.kind] });
    else seenNew.set(row.fieldAfter, row.kind);
  }
  const left = layers.reduce((sum, layer) => sum + layer.hits.length, 0);
  return {
    schemaVersion: 1,
    canonApproved: true,
    exempt: [...SCAN_EXEMPT_FILES.entries()].map(([file, reason]) => ({ file, reason })),
    state: drift.length === 0 && left === 0 ? 'done' : 'in-progress',
    drift,
    left,
    layers,
    bijection: collisions.length === 0,
    collisions,
    rows,
  };
}

export function toMarkdown(plan) {
  const renames = plan.rows.filter((r) => r.idlBefore !== r.idlAfter).length;
  const mintFields = plan.rows.filter((r) => r.mintBefore !== r.mintAfter);
  const players = plan.rows.filter((r) => r.status === 'active-player').map((r) => r.kind);
  const internal = plan.rows.filter((r) => r.status === 'active-internal').map((r) => r.kind);
  const candidates = plan.rows.filter((r) => r.status === 'candidate-dead').map((r) => r.kind);
  const lines = [
    '# План переименования ресурсов (шаг C пункта 12)',
    '',
    plan.state === 'done'
      ? 'Результат rename-scan: **чисто — legacy-идентификаторов в active code: 0**.'
      : `Результат rename-scan: **есть остатки — ${plan.left} legacy-идентификаторов в active code** (см. таблицу слоёв).`,
    'Статус шага C: **ОТКРЫТ — не завершён и не принят**. Нулевой scan подтверждает только отсутствие активных legacy identifiers; это не закрывает остальные acceptance gates.',
    'Документ собирается `node scripts/resource-rename-plan.mjs --write`, гейт — `--check`',
    '(`tests/readiness/resource-rename-plan.test.cjs`). Источники: `docs/RESOURCE_MANIFEST.json`',
    '(канон имён и мест хранения) и `docs/RESOURCE_EVIDENCE.json` (классификация и флаги).',
    '',
    `Канонический mapping: **${plan.rows.length} ресурсов**, переименованных IDL-вариантов — ${renames},`,
    `переименованных полей минта — ${mintFields.length}. Расхождений в манифесте: **${plan.drift.length}**.`,
    '',
    '## Слои (порядок работ владельца)',
    '',
    '| Слой | Файлов проверено | Остатков | Статус |',
    '|---|---:|---:|---|',
  ];
  for (const layer of plan.layers) {
    lines.push(`| ${layer.label} | ${layer.files} | ${layer.hits.length} | ${layer.hits.length === 0 ? '✅ чисто' : '⚠️ переименовать'} |`);
  }
  for (const layer of plan.layers.filter((l) => l.hits.length)) {
    const byFile = new Map();
    for (const hit of layer.hits) byFile.set(hit.file, [...(byFile.get(hit.file) ?? []), hit]);
    lines.push('', `Остатки в слое «${layer.label}»: **${layer.hits.length}** в ${byFile.size} файле(ах).`, '',
      '| Файл | Найдено | Примеры (строка → токен) |', '|---|---:|---|');
    const files = [...byFile.entries()].sort((a, b) => b[1].length - a[1].length);
    for (const [file, hits] of files.slice(0, 40)) {
      const samples = hits.slice(0, 3).map((h) => `\`${h.line}: ${h.token}\``).join(', ');
      lines.push(`| \`${file}\` | ${hits.length} | ${samples} |`);
    }
    if (files.length > 40) lines.push(`| … ещё ${files.length - 40} файлов | | полный список: \`node scripts/resource-rename-plan.mjs\` |`);
  }
  lines.push(
    '',
    'Правило гейта: остаток — это имя ресурса или старое имя инструкции, использованное как идентификатор.',
    'Шаг C переименовал все farming-инструкции (deployment не выполнялся, дискриминаторы пересчитаны',
    'и совпадают с `sha256(\"global:<canonical>\")[0..8]`); старые имена обязаны ронять гейт.',
    'Anchor-механика `seeds` (`seeds = [...]`, `findProgramAddressSync(seeds, …)`, `signer_seeds`) не',
    'переименовывается и остатком не считается.',
    '',
    '## Порядок работ (шаг C владельца, сверху вниз, один вертикальный срез за раз)',
    '',
    '1. **Rust**: поля структур `Config`/`MaterialMints` и `mint_for_kind` — переименование полей',
    '   (байтовый layout не меняется, порядок не меняется);',
    '2. **таблицы программы**: `expected_resource_mint` в ордербуке, `resource_kind_for_tool` в майнинге,',
    '   рецепты `craft_recipe.rs`, аргументы `init_material_mints`;',
    '3. **seeds/константы/события/ошибки**: только если строка содержит farming-имя; варианты enum не',
    '   переставлять, ошибки не сдвигать;',
    '4. **backend**: карты kind (`resourceRegistryCore.ts`, `routes/*.ts`) и любые `cfg.foodMint`-подобные',
    '   обращения — на канонические (`cfg.dataMint`);',
    '5. **frontend**: каталоги, i18n, интенты, ключи API;',
    '6. **game**: каталоги Godot-клиента;',
    '7. **скрипты/тесты**: гейты, фикстуры, ожидания;',
    '8. **IDL**: перегенерация из Rust (`python3 scripts/idl-from-source.py aof_core --instructions … --types …`,',
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
    '`Old Rust/IDL/backend name` перечисляет все старые написания ресурса, которые существовали в коде',
    '(поле структуры, вариант IDL, ключи backend-карт). Тип поля и порядок берутся из `state.rs`;',
    'переименование поля не меняет ни тип, ни место в структуре, ни дискриминанты enum.',
    '',
    '| Index | Old Rust/IDL/backend name | Canonical ResourceKind | Field type | Order unchanged |',
    '|---:|---|---|---|---:|',
  );
  for (const r of plan.rows) {
    const olds = [...new Set([r.fieldBefore, r.idlBefore, camel(r.idlBefore), snake(r.idlBefore)].filter(Boolean))];
    lines.push(`| ${r.index} | ${olds.map((o) => `\`${o}\``).join(', ')} | ${r.kind} (\`${r.fieldHolder}.${r.fieldAfter}\`) | ${r.fieldType} | yes (rename only) |`);
  }
  lines.push('', `Минт-поля: было → стало (${mintFields.length}):`, '');
  for (const r of mintFields) lines.push(`* \`${r.mintBefore}\` → \`${r.mintAfter}\` (${r.kind})`);
  lines.push('', '## Файлы, которые описывают legacy-имена (исключены из скана)', '',
    'Это не использование ресурсных идентификаторов, а их описание: mapping-таблицы, alias-списки',
    'для запрета в player-facing тексте и негативные фикстуры гейта. Ни один файл отсюда не является',
    'runtime-кодом продукта — это проверяется тем же гейтом.', '',
    '| Файл | Почему исключён |', '|---|---|');
  for (const item of plan.exempt) lines.push(`| \`${item.file}\` | ${item.reason} |`);
  lines.push('', '## Что запрещено в этом плане', '',
    '* оставлять алиасы или читать оба имени «на время перехода»;',
    '* переставлять варианты `ResourceKind` или сдвигать коды ошибок;',
    '* удалять AmberQuartz, SoulCore, Data, Dataset, Compute, Mind и связанные mint-поля/капы до отдельного',
    '  решения владельца;',
    '* трогать семь отключённых инструкций из `docs/DEAD_CODE_EVIDENCE.md`;',
    '* возвращать старые имена инструкций или создавать compatibility alias — шаг C их удалил;',
    '* смешивать переименование с изменением экономики (формулы, капы, награды).',
    '', '## Классификация на момент утверждения', '',
    `* active-player (${players.length}): ${players.join(', ')};`,
    `* active-internal (${internal.length}): ${internal.join(', ') || '—'};`,
    `* candidate-dead (${candidates.length}): ${candidates.join(', ')}.`, '',
    'Статусы выведены из кода (`docs/RESOURCE_EVIDENCE.md`), а не назначены руками; удаление кандидатов',
    'делается отдельным шагом после утверждения, не вместе с переименованием.', '',
    '## Проверка после переименования', '', '```bash',
    'node scripts/resource-manifest.mjs --write && node scripts/resource-manifest.mjs --check  # drift 43 → 0',
    'python3 scripts/idl-from-source.py aof_core --instructions "$(…)" --types "$(…)"',
    'python3 scripts/idl-sync-ts.py && python3 scripts/check-idl-drift.py',
    'python3 scripts/gen-core-instruction-table.py --check',
    'node scripts/resource-rename-plan.mjs --check   # legacy-идентификаторов в active code — 0',
    'node scripts/resource-usage.mjs --check',
    'node --test tests/readiness/*.test.cjs', '```', '',
    '## Приёмка шага C (отдельно от чистоты rename-scan)', '',
    'Этот отчёт не объявляет Step C завершённым. Итоговая приёмка требует все 13 пунктов плана,',
    'включая согласованные canonical discriminators во всех слоях, `global_active_resource_drift = 0`,',
    'backend/frontend typecheck + frontend build + generated-client compile (или честный pending при',
    'недоступном toolchain), payer/ownership/F-CURRENCY lamport-delta проверки и `anchor build` +',
    '`anchor test --skip-build` с Anchor-generated IDL validation на Mac/CI. Deployment запрещён.', '');
  return `${lines.join('\n').trimEnd()}\n`;
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
    if (row.mintBefore !== row.mintAfter && !text.includes(`\`${row.mintBefore}\` → \`${row.mintAfter}\``)) {
      errors.push(`${row.kind}: нет переименования минт-поля ${row.mintBefore} → ${row.mintAfter}`);
    }
    if (row.idlBefore !== row.idlAfter && !text.includes(`\`${row.idlBefore}\``)) {
      errors.push(`${row.kind}: в таблице нет исторического IDL-имени ${row.idlBefore}`);
    }
  }
  if (!plan.bijection) for (const c of plan.collisions) errors.push(`mapping не биекция: ${JSON.stringify(c)}`);
  // Исключения обязаны существовать и не быть runtime-кодом продукта: иначе «исключение»
  // превратилось бы в тихий allowlist на боевом коде.
  const runtimePrefixes = ['aof-core/src', 'programs/', 'aof_backend/src/', 'frontend/src/', 'game/'];
  for (const item of plan.exempt) {
    if (!exists(item.file)) errors.push(`исключение из скана указывает на несуществующий файл: ${item.file}`);
    if (runtimePrefixes.some((prefix) => item.file.startsWith(prefix))) {
      errors.push(`исключение ${item.file} — runtime-код продукта; он обязан быть переименован, а не исключён`);
    }
  }
  if (plan.rows.some((r) => r.fieldType === '?')) errors.push('у части минт-полей не определён тип — план не готов к утверждению');
  if (plan.rows.some((r) => !r.orderUnchanged)) errors.push('план не фиксирует неизменность порядка полей');
  if (plan.drift.length) errors.push(`долг переименования в манифесте не пуст: ${plan.drift.length} — node scripts/resource-manifest.mjs --write`);
  if (plan.left !== 0) errors.push(`legacy-идентификаторов в active code: ${plan.left} — переименовать, а не обновлять allowlist/отчёт`);
  for (const layer of plan.layers) {
    if (layer.hits.length && !text.includes(`| ${layer.label} | ${layer.files} | ${layer.hits.length} |`)) {
      errors.push(`${layer.label}: остатки (${layer.hits.length}) не отражены в плане`);
    }
  }
  if (plan.state === 'done' && plan.left !== 0) errors.push('rename-scan объявлен чистым, но остатки есть');
  if (plan.state !== 'done' && !text.includes('есть остатки —')) {
    errors.push('rename-scan обязан честно показывать активные остатки');
  }
  if (plan.state === 'done' && !text.includes('Результат rename-scan: **чисто')) {
    errors.push('нулевой rename-scan обязан быть отражён в отчёте');
  }
  if (!text.includes('Статус шага C: **ОТКРЫТ — не завершён и не принят**')) {
    errors.push('этот отчёт не может закрывать Step C; итоговая приёмка остаётся открытой');
  }
  return errors;
}

function main() {
  const plan = buildPlan();
  if (argv.includes('--write')) {
    fs.writeFileSync(path.join(ROOT, PLAN), toMarkdown(plan));
    console.log(`план переименования записан: ${plan.rows.length} ресурсов, остатков в active code — ${plan.left}`);
    return;
  }
  if (argv.includes('--check')) {
    const errors = check();
    if (errors.length) { console.error(`resource-rename-plan: ${errors.length} проблем(а):`); for (const e of errors) console.error(`  - ${e}`); process.exit(1); }
    console.log(`resource-rename-plan: ${plan.rows.length} ресурсов, legacy-идентификаторов в active code — ${plan.left}`);
    return;
  }
  console.log(JSON.stringify(plan, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
