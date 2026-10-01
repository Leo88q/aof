#!/usr/bin/env node
/**
 * Канонический манифест ресурсов: единственное место, где сведены имя ресурса в Rust
 * (`ResourceKind`), имя в IDL/клиентах (camelCase), место хранения минта (`Config` или
 * `MaterialMints`) и farming-алиасы, которые запрещены в player-facing строках.
 *
 * Зачем: `ResourceKind` (27 вариантов) сам по себе не описывает ни минты, ни старые
 * имена, ни то, какое имя обязано быть в IDL и backend-картах. Из-за этого Rust-enum,
 * IDL и `routes/*.ts` разъехались (см. `drift` в манифесте) — переименование в пункте 12
 * плана делается только по этому манифесту.
 *
 *   node scripts/resource-manifest.mjs --write   пересобрать docs/RESOURCE_MANIFEST.json
 *   node scripts/resource-manifest.mjs --check   гейт (см. ниже)
 *   --root <dir>                                 считать репозиторий из другого каталога (тесты)
 *
 * --check падает, если: изменился набор/порядок вариантов ResourceKind; вариант не описан
 * в манифесте или взял минт из несуществующего поля; список расхождений `drift` в манифесте
 * не совпадает с тем, что реально видно в коде (долг пункта 12 обязан быть точным, а после
 * переименования — пустым); farming-алиас просочился в player-facing `display`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const rootIndex = argv.indexOf('--root');
const ROOT = rootIndex >= 0 ? path.resolve(argv[rootIndex + 1]) : path.resolve(HERE, '..');
const MANIFEST = 'docs/RESOURCE_MANIFEST.json';
const MANIFEST_MD = 'docs/RESOURCE_MANIFEST.md';
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));

const camel = (name) => name.charAt(0).toLowerCase() + name.slice(1);
const snake = (name) => name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();

/** Farming-алиасы: старые имена полей/строк, которые не должны попадать в player-facing текст. */
const FARMING_ALIASES = new Set([
  'food', 'wood', 'stone', 'potato', 'seeds', 'wheat', 'flour', 'bread', 'water', 'coal', 'meat',
  'stone_blue', 'stone_purple', 'stone_red', 'sand_white', 'sand_pink', 'sand_yellow',
  'gem_blue', 'gem_orange', 'gem_white', 'gem_green',
  'flask_blue', 'flask_yellow', 'flask_green', 'flask_pink', 'flask_purple',
  'love_heart', 'stoneblue', 'stonepurple', 'stonered', 'sandwhite', 'sandpink', 'sandyellow',
  'gemblue', 'gemorange', 'gemwhite', 'gemgreen', 'flaskblue', 'flaskyellow', 'flaskgreen',
  'flaskpink', 'flaskpurple', 'loveheart',
]);

/** Варианты ResourceKind в порядке объявления (порядок = discriminant = индекс в max_supply). */
export function parseRustKinds() {
  const src = read('aof-core/src/lib.rs');
  const m = /pub enum ResourceKind\s*\{([\s\S]*?)\n\}/.exec(src);
  if (!m) throw new Error('не найден enum ResourceKind в aof-core/src/lib.rs');
  return m[1]
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, '').trim())
    .filter((line) => /^[A-Z]\w*,$/.test(line))
    .map((line) => line.replace(',', ''));
}

/** `mint_for_kind`: вариант → `config.<field>` / `material_mints.<field>`. */
export function parseMintForKind() {
  const src = read('aof-core/src/state.rs');
  const m = /pub fn mint_for_kind\([\s\S]*?\n\}/.exec(src);
  if (!m) throw new Error('не найдена функция mint_for_kind');
  const map = new Map();
  for (const line of m[0].split('\n')) {
    const arm = /ResourceKind::(\w+)\s*=>\s*(config|material_mints)\.(\w+)/.exec(line);
    if (arm) map.set(arm[1], `${arm[2]}.${arm[3]}`);
  }
  return map;
}

/** Поля структур Config и MaterialMints (для проверки, что минт существует). */
export function parseStructFields() {
  const src = read('aof-core/src/state.rs');
  const fields = new Map();
  for (const name of ['Config', 'MaterialMints']) {
    const m = new RegExp(`pub struct ${name}\\s*\\{([\\s\\S]*?)\\n\\}`).exec(src);
    if (!m) throw new Error(`не найдена структура ${name}`);
    const set = new Set();
    for (const line of m[1].split('\n')) {
      const f = /pub\s+(\w+)\s*:/.exec(line);
      if (f) set.add(f[1]);
    }
    fields.set(name, set);
  }
  return fields;
}

/** Имена вариантов ResourceKind в IDL (то, что реально уходит клиентам). */
export function parseIdlKinds() {
  const idl = JSON.parse(read('aof_backend/src/idl/aof_core.json'));
  const type = idl.types.find((t) => t.name === 'ResourceKind');
  if (!type) throw new Error('в IDL нет типа ResourceKind');
  return type.type.variants.map((v) => v.name);
}

/** Backend-карты: где вообще упоминаются имена ресурсов. */
export function backendSources() {
  const files = ['aof_backend/src/routes/resources.ts', 'aof_backend/src/routes/inbox.ts',
    'aof_backend/src/routes/admin.ts', 'aof_backend/src/routes/collectors.ts'].filter(exists);
  return files.map((rel) => ({ rel, text: read(rel) }));
}

/** Расхождения между Rust, IDL и backend-картами. */
/** Ключи enum-объектов в backend-картах: `{ camelCase: {} }` — то, что уходит в IDL. */
export function enumKeys(text) {
  const keys = new Set();
  for (const m of text.matchAll(/\{\s*(\w+)\s*:\s*\{\s*\}\s*\}/g)) keys.add(m[1]);
  return keys;
}

export function detectDrift(kinds, mintFor, fields, idlKinds, backend) {
  const drift = [];
  const usedBy = backend.map(({ rel, text }) => ({ rel, keys: enumKeys(text) }));
  for (let i = 0; i < kinds.length; i += 1) {
    const idlName = idlKinds[i];
    if (idlName && idlName !== kinds[i]) {
      for (const alias of [camel(idlName), snake(idlName)]) {
        for (const { rel, keys } of usedBy) {
          if (keys.has(alias)) drift.push({ type: 'backend-legacy-name', file: rel, kind: kinds[i], name: alias });
        }
      }
    }
  }
  for (let i = 0; i < kinds.length; i += 1) {
    const kind = kinds[i];
    if (idlKinds[i] !== kind) drift.push({ type: 'idl-variant-name', id: i, kind, actual: idlKinds[i] ?? null });
    const source = mintFor.get(kind);
    if (!source) { drift.push({ type: 'mint-source-missing', kind }); continue; }
    const [prefix, field] = source.split('.');
    const struct = prefix === 'config' ? 'Config' : 'MaterialMints';
    if (!fields.get(struct)?.has(field)) drift.push({ type: 'mint-field-missing', kind, source });
    const api = camel(kind);
    if (backend.length && !backend.some(({ text }) => enumKeys(text).has(api))) {
      drift.push({ type: 'backend-missing-api-name', kind, apiName: api, files: backend.map(({ rel }) => rel) });
    }
  }
  if (idlKinds.length !== kinds.length) drift.push({ type: 'idl-variant-count', expected: kinds.length, actual: idlKinds.length });
  return drift.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

export function buildManifest() {
  const kinds = parseRustKinds();
  const mintFor = parseMintForKind();
  const fields = parseStructFields();
  const idlKinds = parseIdlKinds();
  const backend = backendSources();
  const drift = detectDrift(kinds, mintFor, fields, idlKinds, backend);

  const previous = exists(MANIFEST) ? JSON.parse(read(MANIFEST)) : { resources: [] };
  const curated = new Map((previous.resources || []).map((r) => [r.kind, r]));

  const resources = kinds.map((kind, id) => {
    const source = mintFor.get(kind) ?? null;
    const legacyField = source ? source.split('.')[1] : null;
    const old = curated.get(kind) ?? {};
    const idlName = idlKinds[id] ?? null;
    const legacyAliases = old.legacyAliases
      ?? (idlName && idlName !== kind ? [...new Set([snake(idlName), camel(idlName)])] : []);
    return {
      id,
      kind,
      apiName: camel(kind),
      display: old.display ?? kind.replace(/([a-z])([A-Z])/g, '$1 $2'),
      mintSource: source,
      legacyField,
      legacyAliases,
      idlRename: drift.some((d) => d.kind === kind && d.type === 'idl-variant-name') ? 'pending' : 'canonical',
    };
  });

  return {
    schemaVersion: 1,
    note: 'Канонический манифест ресурсов: каноническое имя (kind/apiName), место хранения минта, legacy-поле и алиасы. Переименование (пункт 12) делается только по нему; drift обязан опустеть. Классификация ресурсов (active-player/active-internal/candidate-dead/dead) живёт в docs/RESOURCE_EVIDENCE.json — это отдельная ось, здесь её нет.',
    drift,
    resources,
  };
}

export function toMarkdown(manifest) {
  const rows = manifest.resources;
  const lines = [
    '# Канонический манифест ресурсов',
    '',
    'Источник истины для имён ресурсов: Rust `ResourceKind` ↔ IDL/клиенты ↔ место хранения минта',
    '↔ farming-алиасы. Создаётся `node scripts/resource-manifest.mjs --write`, гейт — `--check`',
    '(плюс `tests/readiness/resource-manifest.test.cjs`).',
    '',
    'Правило: **player-facing имя — только NeuroForge-канон (`display`); farming-имена живут лишь как',
    '`legacyAliases`/`legacyField` и удаляются из active code в пункте 12 плана.** Гейт не пропускает',
    'farming-алиас в `display`.',
    '',
    `Ресурсов: **${rows.length}**; расхождений кода с каноном (долг до переименования): **${manifest.drift.length}**.`,
    '',
    '| # | kind (Rust/IDL-канон) | apiName | Где минт сейчас | legacy-поле | farming-алиасы | display | IDL-имя |',
    '|---|---|---|---|---|---|---|---|',
  ];
  for (const r of rows) {
    lines.push(`| ${r.id} | ${r.kind} | \`${r.apiName}\` | \`${r.mintSource}\` | \`${r.legacyField}\` | ${r.legacyAliases.length ? r.legacyAliases.map((a) => `\`${a}\``).join(', ') : '—'} | ${r.display} | ${r.idlRename === 'pending' ? '⚠️ pending' : '✅ canonical' } |`);
  }
  const byType = new Map();
  for (const d of manifest.drift) byType.set(d.type, [...(byType.get(d.type) ?? []), d]);
  lines.push('', '## Долг до переименования (пункт 12)', '');
  if (!manifest.drift.length) lines.push('Расхождений нет: Rust, IDL и backend-карты используют канонические имена.', '');
  for (const [type, items] of byType) {
    if (type === 'idl-variant-name') {
      lines.push(`### IDL-имена вариантов ResourceKind (${items.length})`, '',
        'IDL всё ещё публикует farming-имена. Починка: `python3 scripts/idl-from-source.py aof_core --types ResourceKind`',
        'затем `python3 scripts/idl-sync-ts.py` и `python3 scripts/check-idl-drift.py`.', '',
        '| kind | в Rust | в IDL |', '|---|---|---|');
      for (const d of items) lines.push(`| ${d.kind} | ${d.kind} | ${d.actual} |`);
      lines.push('');
    } else if (type === 'backend-legacy-name') {
      lines.push(`### Farming-имена в backend-картах (${items.length})`, '',
        'Значения IDL-аргумента собираются из этих ключей; после переименования IDL ключи обязаны стать каноническими.', '',
        '| Файл | kind | legacy-ключ |', '|---|---|---|');
      for (const d of items) lines.push(`| ${d.file} | ${d.kind} | \`${d.name}\` |`);
      lines.push('');
    } else {
      lines.push(`### ${type} (${items.length})`, '', '```json', JSON.stringify(items, null, 2), '```', '');
    }
  }
  lines.push('## Player-facing имена', '',
    '`display` — канонические англоязычные названия продукта; русские глоссы (Данные, Контур, Кремний,',
    'Нейрон, Синапс, Сигнал, Модель, Энергия, Вычисления, Датасет, ядра, кварцы, биты/чипы, флюиды,',
    'Ядро души, Разум) используются в UI. Ни одно из них не содержит farming-слов — это проверяет гейт.', '');
  return `${lines.join('\n')}\n`;
}

export function check(manifest) {
  const errors = [];
  const current = buildManifest();
  const byKind = new Map(manifest.resources.map((r) => [r.kind, r]));
  for (const expected of current.resources) {
    const actual = byKind.get(expected.kind);
    if (!actual) { errors.push(`нет записи для ResourceKind::${expected.kind}`); continue; }
    if (actual.id !== expected.id) errors.push(`${expected.kind}: id ${actual.id}, а в enum — ${expected.id}`);
    if (actual.mintSource !== expected.mintSource) errors.push(`${expected.kind}: mintSource ${actual.mintSource}, а mint_for_kind даёт ${expected.mintSource}`);
    if (!actual.display || actual.display.length < 3) errors.push(`${expected.kind}: нет player-facing display`);
    if (!Array.isArray(actual.legacyAliases)) errors.push(`${expected.kind}: legacyAliases обязан быть списком`);
    const display = String(actual.display ?? '').toLowerCase();
    for (const alias of FARMING_ALIASES) {
      if (new RegExp(`\\b${alias}\\b`).test(display)) errors.push(`${expected.kind}: farming-алиас '${alias}' в player-facing display '${actual.display}'`);
    }
  }
  if (manifest.resources.length !== current.resources.length) errors.push(`в манифесте ${manifest.resources.length} ресурсов, а в enum — ${current.resources.length}`);
  const recorded = JSON.stringify(manifest.drift ?? []);
  const detected = JSON.stringify(current.drift);
  if (recorded !== detected) {
    errors.push(`drift в манифесте не совпадает с кодом: записано ${(manifest.drift ?? []).length}, видно ${current.drift.length}. Обновите: node scripts/resource-manifest.mjs --write`);
  }
  for (const d of current.drift) {
    if (d.type === 'idl-variant-name' && byKind.get(d.kind)?.idlRename !== 'pending') {
      errors.push(`${d.kind}: IDL-имя '${d.actual}' расходится с Rust — idlRename обязан быть pending`);
    }
  }
  return errors;
}

function main() {
  const manifest = buildManifest();
  const json = `${JSON.stringify(manifest, null, 2)}\n`;
  if (argv.includes('--write')) {
    fs.writeFileSync(path.join(ROOT, MANIFEST), json);
    fs.writeFileSync(path.join(ROOT, MANIFEST_MD), toMarkdown(manifest));
    console.log(`манифест ресурсов записан: ${manifest.resources.length} ресурсов, расхождений (долг до переименования): ${manifest.drift.length}`);
    return;
  }
  if (argv.includes('--check')) {
    const errors = exists(MANIFEST) ? check(JSON.parse(read(MANIFEST))) : [`нет ${MANIFEST}: node scripts/resource-manifest.mjs --write`];
    if (!exists(MANIFEST_MD)) errors.push(`нет ${MANIFEST_MD}: node scripts/resource-manifest.mjs --write`);
    else if (exists(MANIFEST) && read(MANIFEST_MD) !== toMarkdown(JSON.parse(read(MANIFEST)))) errors.push(`${MANIFEST_MD} устарел: node scripts/resource-manifest.mjs --write`);
    if (errors.length) { console.error(`resource-manifest: ${errors.length} проблем(а):`); for (const e of errors) console.error(`  - ${e}`); process.exit(1); }
    console.log(`resource-manifest: ${manifest.resources.length} ресурсов, расхождений до переименования: ${manifest.drift.length}`);
    return;
  }
  process.stdout.write(json);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
