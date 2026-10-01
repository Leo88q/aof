#!/usr/bin/env node
/**
 * Product evidence по каждому каноническому ресурсу: где он реально используется.
 *
 * Требование владельца (шаг A пункта 12): нельзя считать вариант ResourceKind активным
 * только потому, что он есть в enum. Нужны frontend, рецепт, ассет, backend, on-chain
 * источник, on-chain сток и использование в game-клиенте — по каждому ресурсу отдельно.
 *
 * Сигналы намеренно узкие, чтобы не ловить общеупотребительные слова:
 *  * client-evidence — токен ресурса в каталоге (`frontend/src/**` с именами
 *    resource/catalog/asset/economy/compendium/market/craft/inventory/i18n) как ключ
 *    или строка, либо строка, где рядом стоят контекстные слова icon/mint/kind/recipe/...;
 *  * asset-evidence — файл ассета с именем ресурса в `frontend/public/assets`;
 *  * on-chain source/sink — обработчики Rust, в которых явно упомянут `ResourceKind::<Kind>`
 *    (роль файла определяется по имени: mint/collect/explore/craft как источники; craft/
 *    repair/plant/start-baking/forge как стоки) плюс отдельная пометка «any-kind» для путей,
 *    которые работают с kind-параметром.
 *
 *   node scripts/resource-usage.mjs --write   пересобрать docs/RESOURCE_EVIDENCE.{json,md}
 *   node scripts/resource-usage.mjs --check   гейт
 *   --root <dir>                              считать репозиторий из другого каталога (тесты)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildManifest } from './resource-manifest.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const rootIndex = argv.indexOf('--root');
const ROOT = rootIndex >= 0 ? path.resolve(argv[rootIndex + 1]) : path.resolve(HERE, '..');
const OUT_JSON = 'docs/RESOURCE_EVIDENCE.json';
const OUT_MD = 'docs/RESOURCE_EVIDENCE.md';
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));

const CATALOG_RE = /resource|catalog|asset|econom|compendium|market|craft|inventory|i18n|translation|glossary/i;
const CONTEXT_RE = /\b(icon|asset|mint|kind|recipe|cost|price|reward|balance|inventory|catalog|resource|apiName|symbol|ticker|unit)\b/i;

/** Все варианты написания, которыми ресурс может встречаться в коде. */
export function nameVariants(resource) {
  const snake = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
  const base = [resource.kind, resource.apiName, snake(resource.kind), ...(resource.legacyAliases ?? []), resource.legacyField];
  return [...new Set(base.filter(Boolean).map((v) => v.toLowerCase())
    .flatMap((v) => [v, v.replace(/_/g, '-')])
    .filter((v) => v.length > 2))];
}

function walk(rel, exts, maxDepth = 12) {
  const out = [];
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return out;
  const visit = (dir, depth) => {
    if (depth > maxDepth) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (['node_modules', 'target', 'dist', 'build', '.git'].includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(full, depth + 1);
      else if (exts.some((e) => entry.name.endsWith(e))) out.push(path.relative(ROOT, full).split(path.sep).join('/'));
    }
  };
  visit(abs, 0);
  return out;
}

const wordRe = (v) => new RegExp(`(^|[^A-Za-z0-9_])${v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^A-Za-z0-9_]|$)`);

/**
 * Client-evidence: каталог/ассет/i18n-строка. Возвращает файлы, где ресурс назван
 * осмысленно, а не просто словом из общего словаря.
 */
export function clientEvidence(variants, files) {
  const matching = [];
  const sampled = [];
  for (const rel of files) {
    const isCatalog = CATALOG_RE.test(rel);
    const lines = read(rel).split('\n');
    for (const line of lines) {
      const hit = variants.find((v) => wordRe(v).test(line));
      if (!hit) continue;
      const quoted = new RegExp(`["'\`]${hit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'\`]`).test(line);
      if (isCatalog && quoted || CONTEXT_RE.test(line)) {
        matching.push(rel);
        if (sampled.length < 3) sampled.push({ file: rel, variant: hit, line: line.trim().slice(0, 140) });
        break;
      }
    }
  }
  return { matching: [...new Set(matching)].sort(), sampled };
}

const MINT_LINE_RE = /mint_out!|mint_to|mint_resource\(|ResourceKind::\w+\s*\)/;
const BURN_LINE_RE = /burn_in!|token::burn|TRIP_COST|repair_|cost\b|\.amount >=/;

/** Роль строки Rust: где ресурс эмитится, а где тратится. */
export function lineRole(line) {
  if (/burn_in!|token::burn|TRIP_COST|repair_|stone_cost|wood_cost/.test(line)) return 'sink';
  if (/mint_out!|mint_to|check_supply_cap/.test(line)) return 'source';
  if (MINT_LINE_RE.test(line)) return 'source';
  return 'ref';
}

/**
 * On-chain evidence: явные `ResourceKind::<Kind>` в Rust-обработчиках.
 * `anyKind` — файлы, которые умеют работать с произвольным kind-параметром.
 */
export function onchainEvidence(resource, rustFiles) {
  // Ресурс в Rust узнаётся по enum-имени и по имени минт-поля (mm.stone_blue, cfg.food_mint).
  // Роль определяется по блоку функции целиком: если внутри блока есть mint_to/mint_out! —
  // это источник, если token::burn/burn_in!/TRIP_COST — сток. Разбор по функциям (а не по
  // строкам) нужен потому, что вызовы вроде check_supply_cap(..., ResourceKind::Data, ...)
  // и сам mint_to разнесены на десятки строк, а один файл содержит и траты, и награды.
  const base = resource.legacyField && resource.legacyField.replace(/_mint$/, '');
  // `mm.stone_blue` и `ctx.accounts.potato_mint` — оба пишутся как `base` + `_mint`/`_blue`,
  // поэтому базовое имя ищется с разрешённым подчёркиванием внутри составного идентификатора.
  // Базовое имя учитывается только как минт-идентификатор (`wheat_mint`) или как поле
  // хранилища (`mm.wheat`, `config.food`): иначе обычные слова вроде `seeds` или `water`
  // давали бы десятки ложных совпадений в переменных.
  const re = base
    ? new RegExp(`(^|[^A-Za-z0-9])ResourceKind::${resource.kind}([^A-Za-z0-9_]|$)|(^|[^A-Za-z0-9])${base}_mint([^A-Za-z0-9_]|$)|(mm|materials|config|cfg|roles)\\.${base}([^A-Za-z0-9_]|$)`)
    : new RegExp(`(^|[^A-Za-z0-9])ResourceKind::${resource.kind}([^A-Za-z0-9_]|$)`);
  const sources = new Map();
  const sinks = new Map();
  const refs = new Map();
  const anyKind = new Set();
  for (const rel of rustFiles) {
    if (/(state|constants|errors|events)\.rs$/.test(rel) || /security_checklist_tests/.test(rel)) continue;
    // `aof-core/src/lib.rs` — только обёртки инструкций и account-структуры: логика выдачи
    // и трат живёт в `instructions/*.rs`, а констрейнт на адрес минта не делает ресурс
    // доступным игроку.
    if (rel === 'aof-core/src/lib.rs') continue;
    const text = read(rel);
    if (/pub enum ResourceKind/.test(text) || /fn mint_for_kind/.test(text) || /check_supply_cap\(\s*&?\w*,/.test(text)) anyKind.add(rel);
    if (!re.test(text)) continue;
    const blocks = text.split(/\n(?=\s*(?:pub )?fn )/);
    let matched = false;
    for (const block of blocks) {
      if (!re.test(block)) continue;
      matched = true;
      const name = /^\s*(?:pub )?fn (\w+)/.exec(block)?.[1] ?? '?';
      const emits = /mint_out!|mint_to/.test(block);
      const burns = /burn_in!|token::burn|TRIP_COST/.test(block);
      if (emits) sources.set(rel, name);
      if (burns) sinks.set(rel, name);
      if (!emits && !burns && !refs.has(rel)) {
        refs.set(rel, block.split('\n').find((l) => re.test(l))?.trim().slice(0, 120) ?? '');
      }
    }
    if (!matched && !refs.has(rel)) refs.set(rel, '');
  }
  const toList = (m) => [...m.entries()].map(([file, fn]) => `${file}#${fn}`).sort();
  return {
    onchainSource: toList(sources),
    onchainSink: toList(sinks),
    onchainRefs: [...refs.entries()].map(([file, line]) => ({ file, line })),
    anyKind: [...anyKind].sort(),
  };
}

export function buildEvidence() {
  const manifest = buildManifest();
  const frontendFiles = walk('frontend/src', ['.ts', '.tsx', '.js', '.jsx', '.json'], 8);
  const gameFiles = walk('game', ['.gd', '.tscn', '.tres', '.json'], 10);
  const backendFiles = walk('aof_backend/src', ['.ts'], 8).filter((f) => !/\/idl\//.test(f));
  const rustFiles = walk('aof-core/src', ['.rs'], 8).concat(walk('programs', ['.rs'], 8));
  const assets = walk('frontend/public/assets', ['.png', '.jpg', '.jpeg', '.webp', '.svg'], 8);

  return {
    schemaVersion: 1,
    note: 'Product evidence по ресурсам: frontend, game-клиент, backend, рецепты, ассеты, on-chain источники/стоки.',
    resources: manifest.resources.map((r) => {
      const variants = nameVariants(r);
      const frontend = clientEvidence(variants, frontendFiles);
      const game = clientEvidence(variants, gameFiles);
      const backend = clientEvidence(variants, backendFiles);
      const recipes = clientEvidence(variants, backendFiles.filter((f) => /recipe|craft/i.test(f)));
      const assetHits = assets.filter((f) => variants.some((v) => path.basename(f).toLowerCase().includes(v.toLowerCase())));
      const chain = onchainEvidence(r, rustFiles);
      const anyKindPath = chain.anyKind.filter((f) => /mint_resource|collect_|explore|craft_recipe|admin_config/.test(f));
      return {
        kind: r.kind,
        display: r.display,
        mintSource: r.mintSource,
        legacyField: r.legacyField,
        variants,
        frontend: frontend.matching,
        frontendSamples: frontend.sampled,
        game: game.matching,
        backend: backend.matching,
        recipe: recipes.matching,
        assets: assetHits,
        onchainSource: chain.onchainSource,
        onchainSink: chain.onchainSink,
        onchainRefs: chain.onchainRefs,
        anyKindPath,
        coverage: {
          frontend: frontend.matching.length > 0,
          game: game.matching.length > 0,
          backend: backend.matching.length > 0,
          recipe: recipes.matching.length > 0,
          asset: assetHits.length > 0,
          onchainSource: chain.onchainSource.length > 0,
          onchainSink: chain.onchainSink.length > 0,
        },
      };
    }),
  };
}

/** Статус выводится из покрытия, а не назначается руками (ручные статусы — только historical). */
export function classify(resource, curated) {
  const c = resource.coverage;
  const hasChain = c.onchainSource || c.onchainSink;
  if (curated) return curated.status;
  const clients = c.frontend || c.game;
  if (!hasChain) return clients ? 'candidate-dead' : 'historical';
  if (!clients) return 'internal-only';
  // Клиентское присутствие есть. `active` — есть on-chain источник; `internal-only` —
  // ресурс только потребляется (вход рецепта) или известен лишь объявлением;
  // `candidate-dead` — клиентское присутствие без единой цепочки.
  return c.onchainSource ? 'active' : 'internal-only';
}

/** Противоречие между курируемым статусом и жёсткими сигналами кода. */
export function curationErrors(resource, curated) {
  const errors = [];
  if (!curated) return errors;
  if (!['active', 'internal-only', 'candidate-dead', 'historical'].includes(curated.status)) {
    errors.push(`${resource.kind}: неизвестный статус ${curated.status}`);
  }
  const c = resource.coverage;
  const hasChain = c.onchainSource || c.onchainSink;
  if (curated.status === 'active' && !hasChain) errors.push(`${resource.kind}: active выставлен без единого on-chain сигнала`);
  if (curated.status === 'historical' && hasChain) errors.push(`${resource.kind}: historical, но в цепочке ресурс используется`);
  if (!curated.note || curated.note.length < 20) errors.push(`${resource.kind}: курируемый статус требует пояснения`);
  return errors;
}

export function toMarkdown(evidence, curated = {}) {
  const rows = evidence.resources.map((r) => ({ ...r, status: r.status ?? classify(r, curated[r.kind]) }));
  const lines = [
    '# Product evidence по ресурсам (шаг A пункта 12)',
    '',
    'Требование владельца: вариант `ResourceKind` не считается активным только потому, что он есть в enum.',
    'Таблица собирается `node scripts/resource-usage.mjs --write` и проверяется `--check`',
    '(`tests/readiness/resource-evidence.test.cjs`).',
    '',
    'Статусы: `active` (есть on-chain источник и клиентское присутствие), `internal-only` (в цепочке/backend,',
    'но игроку недоступен: только вход рецепта, топливо или админский mint), `candidate-dead` (клиент без',
    'цепочки), `historical` (нигде). `on-chain source`/`sink` — сигналы по блокам функций: в блоке есть',
    '`mint_to`/`mint_out!` (источник) или `token::burn`/`burn_in!`/`TRIP_COST` (сток) и при этом упомянут',
    'ресурс. Сигнал грубее семантики: блок `craft` одновременно жжёт входы и минтит NFT, поэтому статусы',
    'пяти спорных ресурсов (Data, Dataset, Compute, AmberQuartz, SoulCore) зафиксированы курируемо в',
    '`statuses` и проверяются гейтом на противоречие коду.',
    '',
    'Сырые инвентари клиентов, по которым построено покрытие: `docs/CLIENT_INVENTORY.txt`',
    '(`git ls-files frontend game`, `find frontend -maxdepth 6 -type f`, `find game -maxdepth 8 -type f`).',
    '',
    '| Canonical ID | Display name | Frontend | Recipe | Asset | Backend | Game | On-chain source | On-chain sink | Status |',
    '|---|---|---|---|---|---|---|---|---|---|',
  ];
  const mark = (v) => (v ? '✅' : '—');
  for (const r of rows) {
    lines.push(`| ${r.kind} | ${r.display} | ${mark(r.coverage.frontend)} | ${mark(r.coverage.recipe)} | ${mark(r.coverage.asset)} | ${mark(r.coverage.backend)} | ${mark(r.coverage.game)} | ${r.onchainSource.length ? r.onchainSource.length + ' обработчик(ов)' : '—'} | ${r.onchainSink.length ? r.onchainSink.length + ' обработчик(ов)' : '—'} | ${r.status} |`);
  }
  const counts = rows.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {});
  lines.push('', `Итог: ${Object.entries(counts).map(([k, v]) => `${k} — ${v}`).join(', ')}.`, '');
  const curatedRows = rows.filter((r) => curated[r.kind]);
  if (curatedRows.length) {
    lines.push('## Курируемые статусы (спорные сигналы)', '', '| Ресурс | Статус | Почему |', '|---|---|---|');
    for (const r of curatedRows) lines.push(`| ${r.kind} | ${r.status} | ${curated[r.kind].note} |`);
    lines.push('');
  }
  lines.push('## Детали', '');
  for (const r of rows) {
    lines.push(`### ${r.kind} — ${r.status}`, '',
      `* frontend: ${r.frontend.length} файл(ов)${r.frontend.length ? ` (${r.frontend.slice(0, 4).join(', ')}${r.frontend.length > 4 ? ', …' : ''})` : ''}`,
      `* game: ${r.game.length ? r.game.join(', ') : '—'}`,
      `* backend: ${r.backend.length} файл(ов)${r.backend.length ? ` (${r.backend.slice(0, 4).join(', ')}${r.backend.length > 4 ? ', …' : ''})` : ''}`,
      `* recipes: ${r.recipe.length ? r.recipe.join(', ') : '—'}`,
      `* assets: ${r.assets.length ? r.assets.join(', ') : '—'}`,
      `* on-chain source: ${r.onchainSource.join(', ') || '—'}`,
      `* on-chain sink: ${r.onchainSink.join(', ') || '—'}`,
      `* any-kind path: ${r.anyKindPath.length ? r.anyKindPath.join(', ') : '—'}`, '');
  }
  return `${lines.join('\n')}\n`;
}

function main() {
  const evidence = buildEvidence();
  const committed = exists(OUT_JSON) ? JSON.parse(read(OUT_JSON)) : {};
  const curated = committed.statuses ?? {};
  evidence.resources = evidence.resources.map((r) => ({ ...r, status: classify(r, curated[r.kind]) }));
  evidence.statuses = curated;
  const json = `${JSON.stringify(evidence, null, 2)}\n`;
  const md = toMarkdown(evidence, curated);
  const contradictions = evidence.resources.flatMap((r) => curationErrors(r, curated[r.kind]));
  if (argv.includes('--write')) {
    fs.writeFileSync(path.join(ROOT, OUT_JSON), json);
    fs.writeFileSync(path.join(ROOT, OUT_MD), md);
    const counts = evidence.resources.map((r) => classify(r, curated[r.kind])).reduce((a, s) => ({ ...a, [s]: (a[s] ?? 0) + 1 }), {});
    console.log(`product evidence записан: ${evidence.resources.length} ресурсов — ${Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join(', ')}`);
    for (const e of contradictions) console.error(`  ! ${e}`);
    return;
  }
  if (argv.includes('--check')) {
    const errors = [];
    if (!exists(OUT_JSON)) errors.push(`нет ${OUT_JSON}: node scripts/resource-usage.mjs --write`);
    if (!exists(OUT_MD)) errors.push(`нет ${OUT_MD}: node scripts/resource-usage.mjs --write`);
    if (exists(OUT_JSON)) {
      const committed = JSON.parse(read(OUT_JSON));
      if (read(OUT_MD) !== toMarkdown(evidence, committed.statuses ?? {})) errors.push(`${OUT_MD} устарел: node scripts/resource-usage.mjs --write`);
      errors.push(...contradictions);
      const byKind = new Map(committed.resources.map((r) => [r.kind, r]));
      for (const found of evidence.resources) {
        const saved = byKind.get(found.kind);
        if (!saved) { errors.push(`${found.kind}: нет evidence`); continue; }
        const computed = classify(found, curated[found.kind]);
        if (computed !== saved.status) errors.push(`${found.kind}: статус ${saved.status}, а evidence даёт ${computed}`);
      }
      if (evidence.resources.length !== committed.resources.length) errors.push(`в evidence ${committed.resources.length} ресурсов, в enum — ${evidence.resources.length}`);
    }
    if (errors.length) { console.error(`resource-usage: ${errors.length} проблем(а):`); for (const e of errors) console.error(`  - ${e}`); process.exit(1); }
    const counts = evidence.resources.map((r) => classify(r, curated[r.kind])).reduce((a, s) => ({ ...a, [s]: (a[s] ?? 0) + 1 }), {});
    console.log(`resource-usage: ${evidence.resources.length} ресурсов — ${Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join(', ')}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
