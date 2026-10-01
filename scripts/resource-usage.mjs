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
  // Evidence describes canonical active usage only. Historical aliases remain in
  // RESOURCE_MANIFEST for the explicit rename table, but are not promoted to live
  // client/product evidence here.
  const base = [resource.kind, resource.apiName, snake(resource.kind), resource.legacyField];
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

/**
 * Метки строк: где в файле начинается mint-CPI/макрос и где burn. Нужны, чтобы
 * отнести строку с именем ресурса к конкретному вызову: без этого `craft.rs`
 * (жжёт CIRCUIT/SILICON/DATA и минтит NFT в одном обработчике) давал бы ложный
 * «источник» каждому сожжённому ресурсу.
 */
export function callLabels(lines) {
  const labels = new Array(lines.length).fill(null);
  const openers = [
    { re: /token::mint_to\s*\(|mint_out!\s*\(/, label: 'mint' },
    { re: /token::burn\s*\(|burn_in!\s*\(/, label: 'burn' },
  ];
  for (let i = 0; i < lines.length; i += 1) {
    for (const { re, label } of openers) {
      if (!re.test(lines[i])) continue;
      let depth = 0;
      for (let j = i; j < lines.length; j += 1) {
        depth += (lines[j].match(/\(/g) ?? []).length - (lines[j].match(/\)/g) ?? []).length;
        if (labels[j] === null) labels[j] = label;
        // Строка закрытия вызова включается в спаны; следующая — уже нет
        // (иначе однострочный `burn_in!(...)` помечал бы `mint_out!` под ним).
        if (depth <= 0) break;
      }
    }
  }
  return labels;
}

/**
 * On-chain evidence. Ресурс узнаётся по enum-имени, по имени минт-поля
 * (`wheat_mint`) и по полю хранилища (`mm.wheat`, `config.food`). Каждое
 * совпадение относится к ближайшему mint/burn-вызову внутри той же функции:
 * так источник и сток различаются по семантике, а не по факту «в файле есть
 * mint_to». `anyKind` — файлы, которые умеют работать с произвольным kind.
 */
export function onchainEvidence(resource, rustFiles) {
  const base = resource.legacyField && resource.legacyField.replace(/_mint$/, '');
  const resourceRe = new RegExp(
    `(^|[^A-Za-z0-9])ResourceKind::${resource.kind}([^A-Za-z0-9_]|$)`
    + (base
      ? `|(^|[^A-Za-z0-9])${base}_mint([^A-Za-z0-9_]|$)|(mm|materials|config|cfg|roles)\\.${base}([^A-Za-z0-9_]|$)`
      : ''));
  const sources = new Map();
  const sinks = new Map();
  const refs = new Map();
  const anyKind = new Set();
  const WINDOW = 6;
  for (const rel of rustFiles) {
    if (/(state|constants|errors|events)\.rs$/.test(rel) || /security_checklist_tests/.test(rel)) continue;
    // `aof-core/src/lib.rs` — только обёртки инструкций и account-структуры: логика
    // выдачи и трат живёт в `instructions/*.rs`, а констрейнт на адрес минта не
    // делает ресурс доступным игроку.
    if (rel === 'aof-core/src/lib.rs') continue;
    const text = read(rel);
    if (/pub enum ResourceKind/.test(text) || /fn mint_for_kind/.test(text) || /check_supply_cap\(\s*&?\w*,/.test(text)) anyKind.add(rel);
    const lines = text.split('\n');
    const labels = callLabels(lines);
    const fnOf = new Array(lines.length).fill('?');
    let current = '?';
    for (let i = 0; i < lines.length; i += 1) {
      const m = /^\s*(?:pub )?fn (\w+)/.exec(lines[i]);
      if (m) current = m[1];
      fnOf[i] = current;
    }
    for (let i = 0; i < lines.length; i += 1) {
      if (!resourceRe.test(lines[i])) continue;
      let role = null;
      for (let d = 0; d <= WINDOW && !role; d += 1) {
        for (const j of [i - d, i + d]) {
          if (j < 0 || j >= lines.length) continue;
          if (!labels[j] || fnOf[j] !== fnOf[i]) continue;
          role = labels[j];
          break;
        }
      }
      if (role === 'mint') sources.set(rel, fnOf[i]);
      else if (role === 'burn') sinks.set(rel, fnOf[i]);
      else if (!refs.has(rel)) refs.set(rel, lines[i].trim().slice(0, 120));
    }
  }
  const toList = (m) => [...m.entries()].map(([file, fn]) => `${file}#${fn}`).sort();
  return {
    onchainSource: toList(sources),
    onchainSink: toList(sinks),
    onchainRefs: [...refs.entries()].map(([file, line]) => ({ file, line })),
    anyKind: [...anyKind].sort(),
  };
}

/**
 * Динамические таблицы программы. Список ресурсов, доступных игроку, нельзя
 * восстановить только по литералам `ResourceKind::X`: часть путей выбирает kind
 * по индексу или по типу инструмента, и анализ обязан это учитывать (требование
 * владельца: generic/dynamic dispatch — часть evidence, отсутствие литерала не
 * доказывает отсутствие источника).
 *
 *  * `resource_kind_for_tool` — какой тип инструмента какой ресурс майнит;
 *  * `expected_resource_mint` в ордербуке — индекс kind → канонический минт,
 *    то есть ресурс торгуем у любого, кто держит supply.
 */
export function dispatchPaths(rustFiles) {
  const miningFile = 'aof-core/src/instructions/collect_mining.rs';
  const mining = exists(miningFile) ? read(miningFile) : '';
  const table = /fn resource_kind_for_tool[\s\S]*?\n\}/.exec(mining)?.[0] ?? '';
  const miningByTool = new Map();
  for (const m of table.matchAll(/"(\w+)"(?:\s*\|\s*"(\w+)")?\s*=>\s*Some\(ResourceKind::(\w+)\)/g)) {
    for (const tool of [m[1], m[2]]) if (tool) miningByTool.set(tool, m[3]);
  }
  const miningFiles = rustFiles
    .filter((rel) => /resource_kind_for_tool\(/.test(read(rel)) && /token::mint_to/.test(read(rel)))
    .map((rel) => `${rel}#handler`).sort();
  const orderbookFile = 'aof-core/src/instructions/orderbook.rs';
  const orderbook = exists(orderbookFile) ? read(orderbookFile) : '';
  const obTable = /fn expected_resource_mint[\s\S]*?\n\}/.exec(orderbook)?.[0] ?? '';
  const orderbookFields = new Map();
  for (const m of obTable.matchAll(/(\d+)\s*=>\s*(?:config|materials)\.(\w+)/g)) orderbookFields.set(Number(m[1]), m[2]);
  return {
    miningKinds: new Set(miningByTool.values()),
    miningByTool,
    miningFiles,
    orderbookFields,
    orderbook: `${orderbookFile}#expected_resource_mint`,
  };
}

/**
 * Generic-выдача: kind приходит аргументом инструкции, а не литералом, поэтому
 * такой путь умеет выпустить ЛЮБОЙ ресурс. Различаем два вида по подписи:
 *  * `admin` — авторити-подпись (оператор/бэкенд), ресурс уходит любому адресу;
 *  * `claim` — обязательная подпись плательщика-получателя (claim игрока).
 * Именно поэтому ни один ресурс нельзя объявить мёртвым, пока эти пути открыты.
 */
export function genericIssuance(rustFiles) {
  const admin = new Set();
  const claim = new Set();
  // Контекст инструкции живёт в aof-core/src/lib.rs: именно он говорит, кто
  // подписывает аккаунт-плательщик.
  const lib = exists('aof-core/src/lib.rs') ? read('aof-core/src/lib.rs') : '';
  for (const rel of rustFiles) {
    for (const block of read(rel).split(/\n(?=\s*(?:pub )?fn )/)) {
      const head = /fn \w+\(([\s\S]{0,800}?)\)\s*->/.exec(block);
      if (!head || !/kind:\s*ResourceKind/.test(head[1])) continue;
      const context = /Context<([\w]+)>/.exec(head[1])?.[1];
      if (!context) continue;
      const name = /\bfn (\w+)/.exec(block)?.[1] ?? 'handler';
      const entry = `${rel}#${name}`;
      const structStart = lib.indexOf(`pub struct ${context}<'info> {`);
      const body = structStart < 0 ? '' : lib.slice(structStart, lib.indexOf('\n}', structStart));
      if (/payer\s*:\s*Signer/.test(body) && /payer = payer/.test(body)) claim.add(entry);
      else admin.add(entry);
    }
  }
  return { admin: [...admin].sort(), claim: [...claim].sort() };
}

/** Рецепты: arm по `recipe_id` — какие поля жгутся на входе и какой kind минтится. */
export function craftRecipes() {
  const file = 'aof-core/src/instructions/craft_recipe.rs';
  const src = exists(file) ? read(file) : '';
  const block = /match recipe_id \{([\s\S]*?)\n    \}/.exec(src)?.[1] ?? '';
  const arms = [];
  for (const part of block.split(/\n\s{8}(?=\d+ => \{)/)) {
    const id = Number(/^\s*(\d+)\s*=>/.exec(part)?.[1]);
    if (Number.isNaN(id)) continue;
    const inputs = [...part.matchAll(/(?:mm|materials|config|cfg)\.(\w+)/g)].map((m) => m[1]);
    const outputs = [...part.matchAll(/ResourceKind::(\w+)/g)].map((m) => m[1]);
    arms.push({ id, inputs: [...new Set(inputs)], outputs: [...new Set(outputs)] });
  }
  return arms;
}

const PROJECT_PATH_RE = /(vrf|settlement|reveal|reimburse|weather|oracle)/i;
// Возвратные пути (expire/refund): ресурс возвращается игроку из его же эскроу —
// это не новый источник и не проектный сток, а разворот уже учтённой траты.
const REFUND_PATH_RE = /(expire|refund|reimburse)/i;

/**
 * Оси доступа к ресурсу. Наличие пути в цепочке не означает доступности игроку:
 * generic admin-минт подписывает оператор, claim подписывает игрок, но право на
 * него выдаёт проект, а ордербук лишь передаёт уже выпущенное.
 */
export function flowAnalysis(resource, chain, dispatch, generic, craftArms, fieldToKind, frontendCount) {
  // Две независимые оси, которые нельзя смешивать (решение владельца):
  //  * `player_held` — бывает ли ресурс балансом игрока (его ATA): выдача игроку,
  //    сжигание с его token account, вход/выход рецепта. Источник и сток при этом
  //    могут отсутствовать — это отдельный экономический дефект, а не признак
  //    «internal»;
  //  * `internal_only` — ресурс существует только как protocol counter/internal
  //    state и никогда не является балансом игрока.
  // Generic-пути (`mint_resource`, `mint_resource_once`) открыты для всех 27 kinds
  // и потому не делают ресурс player-held: право на claim выдаёт проект.
  const genericSet = new Set([...generic.admin, ...generic.claim]);
  const playerSource = chain.onchainSource.filter((entry) => !genericSet.has(entry) && !REFUND_PATH_RE.test(entry));
  if (dispatch.miningKinds.has(resource.kind)) playerSource.push(...dispatch.miningFiles);
  const refund = [...chain.onchainSource, ...chain.onchainSink].filter((entry) => !genericSet.has(entry) && REFUND_PATH_RE.test(entry));
  const playerSink = chain.onchainSink.filter((entry) => !PROJECT_PATH_RE.test(entry) && !REFUND_PATH_RE.test(entry));
  const projectSink = chain.onchainSink.filter((entry) => PROJECT_PATH_RE.test(entry));
  const craftInput = craftArms
    .filter((arm) => arm.inputs.some((field) => fieldToKind.get(field) === resource.kind))
    .map((arm) => `recipe ${arm.id}`);
  const craftOutput = craftArms
    .filter((arm) => arm.outputs.includes(resource.kind))
    .map((arm) => `recipe ${arm.id}`);
  const tradable = resource.legacyField && [...dispatch.orderbookFields.values()].includes(resource.legacyField)
    ? [dispatch.orderbook] : [];
  const dedupe = (list) => [...new Set(list)].sort();
  const miningOutput = dispatch.miningKinds.has(resource.kind) ? dispatch.miningFiles : [];
  const flow = {
    playerSource: dedupe(playerSource),
    playerSink: dedupe(playerSink),
    projectSink: dedupe(projectSink),
    refund: dedupe(refund),
    craftInput: dedupe(craftInput),
    craftOutput: dedupe(craftOutput),
    tradable,
    miningOutput: dedupe(miningOutput),
    adminMint: generic.admin,
    playerClaim: generic.claim,
  };
  const playerHeld = playerSource.length > 0 || playerSink.length > 0
    || flow.craftInput.length > 0 || flow.craftOutput.length > 0;
  flow.flags = {
    player_held: playerHeld,
    ui_visible: frontendCount > 0,
    tradable: flow.tradable.length > 0,
    has_player_source: flow.playerSource.length > 0,
    has_player_sink: flow.playerSink.length > 0,
    has_admin_source: flow.adminMint.length > 0,
    recipe_input: flow.craftInput.length > 0,
    recipe_output: flow.craftOutput.length > 0,
    mining_output: flow.miningOutput.length > 0,
    generic_claim_output: flow.playerClaim.length > 0,
    internal_only: !playerHeld && flow.projectSink.length > 0,
  };
  return flow;
}

/**
 * Разрывы продуктовой цепочки, видимые из кода (не «мёртвый код», а именно разрыв):
 *  * рецепт требует ресурс, который игрок нигде не может получить (только проектная выдача);
 *  * рецепт выпускает ресурс, который затем нигде не потребляется и не является наградой.
 * Это входные данные для решения владельца о каноне, а не приговор ресурсу.
 */
export function productGaps(resources, craftArms, fieldToKind, dispatch, generic) {
  const produced = new Set(craftArms.flatMap((arm) => arm.outputs));
  const consumed = new Set(craftArms.flatMap((arm) => arm.inputs.map((f) => fieldToKind.get(f))).filter(Boolean));
  const playerSource = new Set();
  for (const r of resources) {
    if (dispatch.miningKinds.has(r.kind)) playerSource.add(r.kind);
  }
  return {
    craftInputsWithoutPlayerSource: [...consumed].filter((k) => !playerSource.has(k) && !produced.has(k)).sort(),
    craftOutputsNeverConsumed: [...produced].filter((k) => !consumed.has(k)).sort(),
    genericIssuance: { admin: generic.admin.length > 0, playerClaim: generic.claim.length > 0 },
  };
}

export function buildEvidence() {
  const manifest = buildManifest();
  const frontendFiles = walk('frontend/src', ['.ts', '.tsx', '.js', '.jsx', '.json'], 8);
  const gameFiles = walk('game', ['.gd', '.tscn', '.tres', '.json'], 10);
  const backendFiles = walk('aof_backend/src', ['.ts'], 8).filter((f) => !/\/idl\//.test(f));
  const rustFiles = walk('aof-core/src', ['.rs'], 8).concat(walk('programs', ['.rs'], 8));
  const assets = walk('frontend/public/assets', ['.png', '.jpg', '.jpeg', '.webp', '.svg'], 8);
  const dispatch = dispatchPaths(rustFiles);
  const generic = genericIssuance(rustFiles);
  const craftArms = craftRecipes();
  const fieldToKind = new Map(manifest.resources.filter((r) => r.legacyField).map((r) => [r.legacyField, r.kind]));

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
        flow: flowAnalysis(r, chain, dispatch, generic, craftArms, fieldToKind, frontend.matching.length),
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
    productGaps: productGaps(manifest.resources, craftArms, fieldToKind, dispatch, generic),
    genericPaths: {
      adminMint: generic.admin,
      playerClaim: generic.claim,
      miningFiles: dispatch.miningFiles,
      miningKinds: [...dispatch.miningKinds].sort(),
      orderbook: dispatch.orderbook,
      orderbookKinds: dispatch.orderbookFields.size,
      recipes: craftArms,
    },
  };
}

/**
 * Классификация: взаимоисключающие статусы, выведенные из кода, без ручных
 * allowlist'ов и без «курируемых» переопределений (требование владельца).
 *
 * Решение владельца от 2026-10-01: статус описывает ПРИРОДУ ресурса, а не
 * экономическую связность — отсутствие источника/стока не понижает player-ресурс.
 *
 *  * `active-player`   — ресурс является балансом игрока или участвует в его
 *    экономике: хранится в ATA игрока, сжигается из него, входит/выходит рецептом,
 *    выдаётся игроку. Источник и сток при этом независимы (`economy_issue`);
 *  * `active-internal` — ресурс НИКОГДА не является балансом игрока: только
 *    protocol counter/internal state (`internal_only`);
 *  * `candidate-dead`  — подтверждённого product flow нет: остались type/registry/
 *    catalog entry (UI-каталог, индекс ордербука, таблицы `mint_for_kind`/
 *    `expected_resource_mint`) и generic-пути, открытые для всех 27 kinds;
 *  * `dead`            — нет даже записи в каталоге/реестре; удаление возможно
 *    только с отдельного разрешения владельца (гейт его не выдаёт).
 */
export function classify(resource) {
  const f = resource.flow.flags;
  if (f.player_held) return 'active-player';
  if (f.internal_only) return 'active-internal';
  if (f.ui_visible || f.tradable || f.has_admin_source || f.generic_claim_output
    || (resource.onchainRefs ?? []).length > 0) return 'candidate-dead';
  return 'dead';
}

/**
 * Экономический разрыв — отдельная ось от статуса (решение владельца).
 * Наличие generic admin-минта НЕ закрывает `missing_source`: технически выпустить
 * можно любой kind, но это проектная выдача, а не путь получения игроком.
 */
export function economyIssue(resource) {
  const f = resource.flow.flags;
  const sink = f.has_player_sink || f.recipe_input;
  const source = f.has_player_source || f.recipe_output;
  if (sink && !source) return 'missing_source';
  if (source && !sink) return 'missing_sink';
  return null;
}

/** Согласованность flags со списками и статуса с flags: гейт не даёт поднять статус руками. */
export function flowErrors(resource) {
  const errors = [];
  const f = resource.flow?.flags;
  if (!f) { errors.push(`${resource.kind}: нет flow-анализа (dynamic dispatch не посчитан)`); return errors; }
  const playerHeld = resource.flow.playerSource.length > 0 || resource.flow.playerSink.length > 0
    || resource.flow.craftInput.length > 0 || resource.flow.craftOutput.length > 0;
  const expected = {
    player_held: playerHeld,
    ui_visible: resource.frontend.length > 0,
    tradable: resource.flow.tradable.length > 0,
    has_player_source: resource.flow.playerSource.length > 0,
    has_player_sink: resource.flow.playerSink.length > 0,
    has_admin_source: resource.flow.adminMint.length > 0,
    recipe_input: resource.flow.craftInput.length > 0,
    recipe_output: resource.flow.craftOutput.length > 0,
    mining_output: resource.flow.miningOutput.length > 0,
    generic_claim_output: resource.flow.playerClaim.length > 0,
    internal_only: !playerHeld && resource.flow.projectSink.length > 0,
  };
  for (const [flag, value] of Object.entries(expected)) {
    if (f[flag] !== value) errors.push(`${resource.kind}: flag ${flag}=${f[flag]}, а по спискам ${value}`);
  }
  const status = classify(resource);
  if (resource.status !== status) errors.push(`${resource.kind}: статус ${resource.status}, а evidence даёт ${status}`);
  if (status === 'active-internal' && f.player_held) errors.push(`${resource.kind}: active-internal, но ресурс бывает балансом игрока`);
  if (status === 'active-player' && f.internal_only) errors.push(`${resource.kind}: active-player и internal_only одновременно`);
  if (resource.economyIssue !== undefined && resource.economyIssue !== economyIssue(resource)) {
    errors.push(`${resource.kind}: economyIssue ${resource.economyIssue}, а код даёт ${economyIssue(resource)}`);
  }
  return errors;
}

/** Пояснение к ресурсу выводится из флагов/статуса, а не назначается руками. */
export function statusNote(resource) {
  const f = resource.flow.flags;
  if (resource.status === 'active-player' && economyIssue(resource) === 'missing_source') {
    return 'баланс игрока (его ATA), но пути получения нет: сток/рецепт требует ресурс, источник для игрока не найден — pre-deployment economy gap';
  }
  if (resource.status === 'active-player' && economyIssue(resource) === 'missing_sink') {
    return 'баланс игрока (его ATA), но стока нет: ресурс выпускается рецептом и нигде не потребляется — pre-deployment economy gap';
  }
  if (resource.status === 'active-player') return 'ресурс бывает балансом игрока: выдача, сжигание или рецепт из его token account';
  if (resource.status === 'active-internal') return 'никогда не является балансом игрока: только protocol state';
  if (resource.status === 'candidate-dead') {
    return 'подтверждённого product flow нет: только каталог/реестр (UI, индекс ордербука, mint_for_kind) и generic-пути, открытые для всех kinds; удаление — только с разрешения владельца';
  }
  return 'нет ни каталога, ни реестра, ни generic-путей';
}

const STATUS_ORDER = ['active-player', 'active-internal', 'candidate-dead', 'dead'];
const countStatuses = (rows) => STATUS_ORDER
  .filter((s) => rows.some((r) => r.status === s))
  .map((s) => `${s}: ${rows.filter((r) => r.status === s).length}`).join(', ');

export function toMarkdown(evidence) {
  const rows = evidence.resources;
  const lines = [
    '# Product evidence по ресурсам (шаг A пункта 12)',
    '',
    'Требование владельца: вариант `ResourceKind` не считается активным только потому, что он есть в enum.',
    'Таблица собирается `node scripts/resource-usage.mjs --write` и проверяется `--check`',
    '(`tests/readiness/resource-evidence.test.cjs`); ручных статусов у гейта нет.',
    '',
    'Методика (учитывает dynamic dispatch, иначе вывод «нет источника» ложен):',
    '',
    '* `on-chain source`/`sink` — строка с именем ресурса относится к ближайшему вызову в той же',
    '  функции: `mint_to`/`mint_out!` — источник, `token::burn`/`burn_in!`/`TRIP_COST` — сток. Оконный',
    '  разбор (а не «в файле есть mint_to») нужен потому, что один обработчик и жжёт входы, и минтит выход;',
    '* `resource_kind_for_tool` в `collect_mining.rs` — майнинг выбирает ресурс по типу инструмента',
    '  (не литералом в месте минта), поэтому такой источник приписывается ресурсу из таблицы;',
    '* `expected_resource_mint` в ордербуке — индекс kind → минт: любой ресурс, попавший к игроку,',
    '  торгуем, но это сток-в-обмен, а не источник;',
    '* рецепты `craft_recipe.rs` — входы (какие поля жгутся) и выходы (какой kind минтится) по `recipe_id`;',
    '* generic-выдача (`mint_resource` — admin/authority, `mint_resource_once` — подпись игрока-плательщика)',
    '  умеет выпустить ЛЮБОЙ kind: эти пути отмечены флагами `admin_mintable`/`player_claimable`',
    '  и сами по себе не делают ресурс доступным игроку по его действию.',
    '',
    'Статусы (взаимоисключающие, описывают природу ресурса, а не связность): `active-player`',
    '(ресурс бывает балансом игрока и/или входит в его экономику — в том числе когда источника',
    'пока нет), `active-internal` (никогда не баланс игрока, только protocol state), `candidate-dead`',
    '(подтверждённого product flow нет — остались каталог/реестр и generic-пути), `dead` (нет и записи',
    'в реестре; удаление — только с разрешения владельца).',
    '',
    'Флаги (по одному признаку каждый): `player_held`, `ui_visible`, `tradable`, `has_player_source`,',
    '`has_player_sink`, `has_admin_source`, `recipe_input`, `recipe_output`, `mining_output`,',
    '`generic_claim_output`, `internal_only`. Экономическая связность — отдельная ось `economy_issue`',
    '(`missing_source`/`missing_sink`), она НЕ понижает player-ресурс до internal.',
    '',
    'Сырые инвентари клиентов: `docs/CLIENT_INVENTORY.txt` (воспроизводимо из `git ls-files -- frontend game`).',
    '',
    '| Canonical ID | Display name | Frontend | Recipe | Asset | Backend | Game | playerSource | playerSink | tradable | admin/claim | Статус | economy_issue |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
  ];
  const mark = (v) => (v ? '✅' : '—');
  for (const r of rows) {
    const f = r.flow.flags;
    lines.push(`| ${r.kind} | ${r.display} | ${mark(r.coverage.frontend)} | ${mark(r.coverage.recipe)} | `
      + `${mark(r.coverage.asset)} | ${mark(r.coverage.backend)} | ${mark(r.coverage.game)} | `
      + `${r.flow.playerSource.length} | ${r.flow.playerSink.length} | ${mark(f.tradable)} | `
      + `${[f.has_admin_source ? 'admin' : '', f.generic_claim_output ? 'claim' : ''].filter(Boolean).join('/') || '—'} | `
      + `${r.status} | ${r.economyIssue ?? '—'} |`);
  }
  lines.push('', `Итог: ${countStatuses(rows)}.`, '');
  if (evidence.productGaps) {
    const g = evidence.productGaps;
    lines.push('## Разрывы цепочки, видимые из кода', '',
      'Это не приговор ресурсу, а вход для решения владельца о каноне:',
      '',
      `* рецепты требуют ресурс, который игрок нигде не может получить (ни майнинга, ни рецепта,`,
      `  ни награды; получить можно только проектной выдачей): ${g.craftInputsWithoutPlayerSource.join(', ') || '—'};`,
      `* рецепты выпускают ресурс, который затем нигде не потребляется: ${g.craftOutputsNeverConsumed.join(', ') || '—'};`,
      `* generic-выдача открыта для всех 27 kinds: admin-минт — ${g.genericIssuance.admin ? 'да' : 'нет'},`,
      `  player claim — ${g.genericIssuance.playerClaim ? 'да' : 'нет'} (поэтому отсутствие литерала`,
      `  \`ResourceKind::X\` в файле само по себе не доказывает отсутствие источника).`, '');
  }
  lines.push('## Пояснения к статусам', '',
    'Пояснение выводится из флагов (см. `statusNote` в `scripts/resource-usage.mjs`), а не назначается руками.', '',
    '| Ресурс | Статус | economy_issue | Пояснение |', '|---|---|---|---|');
  for (const r of rows) lines.push(`| ${r.kind} | ${r.status} | ${r.economyIssue ?? '—'} | ${statusNote(r)} |`);
  lines.push('');
  lines.push('## Детали', '');
  for (const r of rows) {
    lines.push(`### ${r.kind} — ${r.status}`, '',
      `* frontend: ${r.frontend.length} файл(ов)${r.frontend.length ? ` (${r.frontend.slice(0, 4).join(', ')}${r.frontend.length > 4 ? ', …' : ''})` : ''}`,
      `* game: ${r.game.length ? r.game.join(', ') : '—'}`,
      `* backend: ${r.backend.length} файл(ов)${r.backend.length ? ` (${r.backend.slice(0, 4).join(', ')}${r.backend.length > 4 ? ', …' : ''})` : ''}`,
      `* recipes: ${r.recipe.length ? r.recipe.join(', ') : '—'}`,
      `* assets: ${r.assets.length ? r.assets.join(', ') : '—'}`,
      `* on-chain source (литерал): ${r.onchainSource.join(', ') || '—'}`,
      `* on-chain sink (литерал): ${r.onchainSink.join(', ') || '—'}`,
      `* любой kind (generic): ${r.anyKindPath.length ? r.anyKindPath.join(', ') : '—'}`,
      `* путь игрока (источник): ${r.flow.playerSource.join(', ') || '—'}`,
      `* майнинг-выдача: ${r.flow.miningOutput.join(', ') || '—'}`,
      `* проектный сток (VRF/refund): ${r.flow.projectSink.join(', ') || '—'}`,
      `* рецепты: вход ${r.flow.craftInput.join(', ') || '—'}; выход ${r.flow.craftOutput.join(', ') || '—'}`,
      `* флаги: ${Object.entries(r.flow.flags).map(([k, v]) => `${k}=${v}`).join(', ')}`, '');
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

function main() {
  const evidence = buildEvidence();
  evidence.resources = evidence.resources.map((r) => ({ ...r, status: classify(r), economyIssue: economyIssue(r) }));
  evidence.statusSemantics = 'active-player = ресурс бывает балансом игрока; active-internal = только protocol state; absence of source/sink — это economy_issue, а не смена статуса';
  const json = `${JSON.stringify(evidence, null, 2)}\n`;
  const md = toMarkdown(evidence);
  const problems = evidence.resources.flatMap(flowErrors);
  if (argv.includes('--write')) {
    fs.writeFileSync(path.join(ROOT, OUT_JSON), json);
    fs.writeFileSync(path.join(ROOT, OUT_MD), md);
    console.log(`product evidence записан: ${evidence.resources.length} ресурсов — ${countStatuses(evidence.resources)}`);
    for (const e of problems) console.error(`  ! ${e}`);
    return;
  }
  if (argv.includes('--check')) {
    const errors = [];
    if (!exists(OUT_JSON)) errors.push(`нет ${OUT_JSON}: node scripts/resource-usage.mjs --write`);
    if (!exists(OUT_MD)) errors.push(`нет ${OUT_MD}: node scripts/resource-usage.mjs --write`);
    if (exists(OUT_JSON)) {
      const committed = JSON.parse(read(OUT_JSON));
      if (read(OUT_MD) !== toMarkdown(committed)) errors.push(`${OUT_MD} устарел: node scripts/resource-usage.mjs --write`);
      errors.push(...problems);
      const byKind = new Map(committed.resources.map((r) => [r.kind, r]));
      for (const found of evidence.resources) {
        const saved = byKind.get(found.kind);
        if (!saved) { errors.push(`${found.kind}: нет evidence`); continue; }
        if (saved.status !== found.status) errors.push(`${found.kind}: статус ${saved.status}, а evidence даёт ${found.status}`);
        if (saved.economyIssue !== undefined && saved.economyIssue !== economyIssue(found)) {
          errors.push(`${found.kind}: economy_issue ${saved.economyIssue}, а код даёт ${economyIssue(found)}`);
        }
        if (!saved.flow?.flags) errors.push(`${found.kind}: в evidence нет flow-флагов`);
        for (const flag of ['player_held', 'internal_only', 'has_admin_source', 'recipe_input', 'recipe_output', 'mining_output', 'generic_claim_output']) {
          if (saved.flow?.flags && !(flag in saved.flow.flags)) errors.push(`${found.kind}: в evidence нет флага ${flag}`);
        }
      }
      if (evidence.resources.length !== committed.resources.length) errors.push(`в evidence ${committed.resources.length} ресурсов, в enum — ${evidence.resources.length}`);
      for (const key of ['adminMint', 'playerClaim', 'miningFiles', 'recipes']) {
        if (!evidence.genericPaths?.[key]?.length) errors.push(`generic-путь ${key} не найден: dynamic dispatch посчитан неверно`);
      }
    }
    if (errors.length) { console.error(`resource-usage: ${errors.length} проблем(а):`); for (const e of errors) console.error(`  - ${e}`); process.exit(1); }
    console.log(`resource-usage: ${evidence.resources.length} ресурсов — ${countStatuses(evidence.resources)}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
