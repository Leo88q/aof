#!/usr/bin/env node
/**
 * Инвентарь инструкций шести Anchor-программ AOF: машинно проверяемый, с ролью и call sites.
 *
 * Зачем. В IDL 171 инструкций (aof_core — 123), а валидаторные тесты задевают лишь часть (CU-отчёт
 * `tests/aof_cu_report.ts`: «N of 123» — и только для aof_core). Без списка «что это за инструкция,
 * кто её зовёт и чем она покрыта» нельзя ни безопасно чистить код, ни заметить, что в программе появилась
 * инструкция, про которую никто не решил, зачем она нужна.
 *
 * Что делает:
 *   * читает IDL (aof_backend/src/idl/<программа>.json) и разбирает `#[program]` каждой программы:
 *     находит тело обработчика и определяет, ОТКЛЮЧЕНА ли инструкция в коде (первая же команда —
 *     `require!(false, …)` / `err!(…)`);
 *   * ищет call sites по категориям (backend, admin-скрипты, frontend, game, platform, CPI) и покрытие
 *     тестами (validator, самотесты, readiness, Rust);
 *   * соединяет это с РУЧНОЙ классификацией `security/instruction-roles.json` (роль, статус, заметка);
 *   * пишет docs/INSTRUCTION_INVENTORY.json (для машин) и docs/INSTRUCTION_INVENTORY.md (для людей).
 *
 * Режимы:
 *   node scripts/instruction-inventory.mjs --write   пересоздать оба файла
 *   node scripts/instruction-inventory.mjs --check   гейт: ничего не классифицировано «по умолчанию»
 *   --root <dir>  считать репозиторий из другого каталога (так тест ловит «новую инструкцию»)
 *
 * Что --check считает ошибкой (код выхода 1):
 *   * инструкция есть в IDL, а записи в instruction-roles.json нет (новая, никем не классифицированная);
 *   * запись есть, а инструкции нет (устаревшая);
 *   * неизвестная роль/статус; пустая заметка;
 *   * набор `pub fn` в `#[program]` расходится с IDL;
 *   * код отключает инструкцию (`disabled-on-chain`), а запись говорит «active» — и наоборот;
 *   * роль `candidate-dead-code` у инструкции, у которой в коде есть call sites (утверждение «мертва» ложно);
 *   * роль `deprecated` без `replacedBy` или с несуществующей заменой;
 *   * в закоммиченных JSON/MD устарела классификация (набор инструкций, роли, статусы, заметки, таблица ролей,
 *     список отключённых). Данные call sites и тестов справочные: об их отставании --check только предупреждает.
 *
 * Важно: поиск call sites — СТАТИЧЕСКИЙ текстовый. Он не доказывает ни «вызывается», ни «не вызывается»
 * (имена из одного слова — `craft`, `stake`, `reroll` — дают случайные совпадения). Удалять код по
 * этому списку нельзя: он нужен, чтобы знать, где смотреть.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const rootIndex = argv.indexOf('--root');
const ROOT = rootIndex >= 0 ? path.resolve(argv[rootIndex + 1]) : path.resolve(HERE, '..');

export const ROLES = ['gameplay', 'admin', 'emergency', 'migration', 'initialization', 'compatibility', 'deprecated', 'candidate-dead-code'];
export const STATUSES = ['active', 'disabled-on-chain'];
const ROLES_FILE = 'security/instruction-roles.json';
const OUT_JSON = 'docs/INSTRUCTION_INVENTORY.json';
const OUT_MD = 'docs/INSTRUCTION_INVENTORY.md';
const MAX_FILES_LISTED = 8;

/** Файлы, через которые bringup реально вызывает инструкции (скрипты + backend-маршруты, в которые он POST-ит). */
const BRINGUP_SURFACES = [
  'scripts/devnet-bringup.sh', 'scripts/enable-mining-devnet.sh',
  'aof_backend/scripts/initConfig.ts', 'aof_backend/scripts/initMintsV2.ts', 'aof_backend/scripts/initIssuanceCaps.ts',
  'aof_backend/src/routes/admin-config.ts', 'aof_backend/src/routes/admin-economy.ts', 'aof_backend/src/routes/packs.ts',
  'aof_backend/src/routes/reroll.ts', 'aof_backend/src/routes/lottery.ts', 'aof_backend/src/routes/season.ts',
  'aof_backend/src/routes/hotMarket.ts', 'aof_backend/src/routes/admin.ts', 'aof_backend/src/routes/craftOrder.ts',
];

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'target', '.git', '.next', 'coverage', '.cache', '__pycache__']);
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));

// ---------------------------------------------------------------- файлы репозитория
function walk(relDir, extensions, skip = []) {
  const out = [];
  const abs = path.join(ROOT, relDir);
  if (!fs.existsSync(abs)) return out;
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { visit(full); continue; }
      if (!extensions.includes(path.extname(entry.name))) continue;
      const rel = path.relative(ROOT, full).split(path.sep).join('/');
      if (skip.some((re) => re.test(rel))) continue;
      out.push(rel);
    }
  };
  visit(abs);
  return out;
}

const TEST_FILE = [/SelfTest\.ts$/, /Test\.ts$/, /\/test-[^/]*$/, /\.test\.[cm]?[jt]s$/, /\/tests?\//, /_tests?\.rs$/, /\/tests?\.rs$/];
const GENERATED = [/aof_backend\/src\/idl\//, /idl_raw\.json$/, /\.d\.ts$/];

const CALL_SITE_CATEGORIES = {
  backend: () => [...walk('aof_backend/src', ['.ts', '.js'], [...GENERATED, ...TEST_FILE]), ...walk('aof_backend/services', ['.ts', '.js'], TEST_FILE)],
  adminScripts: () => [...walk('aof_backend/scripts', ['.ts', '.js', '.mjs'], TEST_FILE), ...walk('scripts', ['.py', '.sh', '.mjs', '.cjs', '.js', '.ts'], [...TEST_FILE, /scripts\/instruction-inventory\.mjs$/, /scripts\/devnet_mock_rpc\.py$/])],
  frontend: () => walk('frontend/src', ['.ts', '.tsx', '.js', '.jsx', '.vue'], [/idl/i, ...TEST_FILE]),
  game: () => walk('game', ['.gd', '.cs']),
  platform: () => [...walk('src', ['.js', '.ts', '.rs', '.mjs'], TEST_FILE), ...walk('functions', ['.js', '.ts'], [/node_modules/]), ...walk('watchtower', ['.ts', '.js', '.mjs'], [...TEST_FILE, /dist\//])],
};
const TEST_CATEGORIES = {
  validator: () => walk('tests', ['.ts']).filter((f) => f.split('/').length === 2),
  readiness: () => walk('tests/readiness', ['.cjs', '.js', '.mjs']).filter((f) => f !== 'tests/readiness/instruction-inventory.test.cjs'), // сам себя не считаем
  selfTests: () => [...walk('aof_backend/scripts', ['.ts']).filter((f) => /(SelfTest|Test)\.ts$/.test(f)), ...walk('scripts', ['.py']).filter((f) => /\/test-[^/]*\.py$/.test(f)), ...walk('src/os/tests', ['.js', '.mjs'])],
  rust: () => [...walk('aof-core/src', ['.rs']), ...walk('programs', ['.rs'])].filter((f) => /(^|\/)[a-z_]*tests?\.rs$/.test(f)),
};

const cache = new Map();
const text = (rel) => { if (!cache.has(rel)) cache.set(rel, read(rel)); return cache.get(rel); };

// ---------------------------------------------------------------- разбор Rust
function skipLiteral(src, i) {
  // возвращает индекс ПОСЛЕ строки/комментария/символьного литерала, начинающегося в i, либо i, если там ничего такого нет
  if (src.startsWith('//', i)) { const n = src.indexOf('\n', i); return n < 0 ? src.length : n; }
  if (src.startsWith('/*', i)) { const n = src.indexOf('*/', i + 2); return n < 0 ? src.length : n + 2; }
  if (src[i] === '"') {
    let j = i + 1;
    while (j < src.length && src[j] !== '"') j += src[j] === '\\' ? 2 : 1;
    return j + 1;
  }
  if (src[i] === 'r' && /^r#*"/.test(src.slice(i, i + 12))) {
    const hashes = /^r(#*)"/.exec(src.slice(i, i + 12))[1];
    const close = `"${hashes}`;
    const n = src.indexOf(close, i + 2 + hashes.length);
    return n < 0 ? src.length : n + close.length;
  }
  if (src[i] === "'") {
    const m = /^'(?:\\.|[^\\'])'/.exec(src.slice(i, i + 6));
    if (m) return i + m[0].length; // символьный литерал; иначе это lifetime
  }
  return i;
}

function matchDelimiter(src, openIndex, open, close) {
  let depth = 0;
  for (let i = openIndex; i < src.length; i += 1) {
    const jumped = skipLiteral(src, i);
    if (jumped !== i) { i = jumped - 1; continue; }
    if (src[i] === open) depth += 1;
    else if (src[i] === close) { depth -= 1; if (depth === 0) return i; }
  }
  throw new Error('несбалансированные скобки');
}

const stripComments = (code) => {
  let out = '';
  for (let i = 0; i < code.length; i += 1) {
    if (code.startsWith('//', i)) { const n = code.indexOf('\n', i); i = (n < 0 ? code.length : n) - 1; continue; }
    if (code.startsWith('/*', i)) { const n = code.indexOf('*/', i + 2); i = (n < 0 ? code.length : n + 2) - 1; continue; }
    const jumped = skipLiteral(code, i);
    if (jumped !== i) { out += code.slice(i, jumped); i = jumped - 1; continue; }
    out += code[i];
  }
  return out;
};

const lineOf = (src, index) => src.slice(0, index).split('\n').length;

/** `pub fn` внутри `#[program] pub mod …`: имя, тело, строка. */
function programFns(libRel) {
  const src = text(libRel);
  const mod = /#\[program\]\s*pub\s+mod\s+(\w+)\s*\{/.exec(src);
  if (!mod) throw new Error(`${libRel}: нет #[program] модуля`);
  const open = mod.index + mod[0].length - 1;
  const end = matchDelimiter(src, open, '{', '}');
  const fns = [];
  const re = /\bpub fn (\w+)\s*(?:<[^>{]*>)?\s*\(/g;
  re.lastIndex = open;
  let m;
  while ((m = re.exec(src)) && m.index < end) {
    const paramsOpen = m.index + m[0].length - 1;
    const paramsClose = matchDelimiter(src, paramsOpen, '(', ')');
    const bodyOpen = src.indexOf('{', paramsClose);
    const bodyClose = matchDelimiter(src, bodyOpen, '{', '}');
    fns.push({ name: m[1], line: lineOf(src, m.index), body: src.slice(bodyOpen + 1, bodyClose) });
    re.lastIndex = bodyClose;
  }
  return { module: mod[1], fns };
}

const DELEGATE = /^((?:crate::)?[A-Za-z_]\w*(?:::[A-Za-z_]\w*)+)\s*\(/;

function findHandler(crateSrc, delegatePath) {
  const parts = delegatePath.replace(/^crate::/, '').split('::');
  const func = parts[parts.length - 1];
  const moduleParts = parts.slice(0, -1);
  const files = walk(crateSrc, ['.rs']);
  const candidates = [];
  for (const rel of files) {
    const src = text(rel);
    const re = new RegExp(`\\bpub fn ${func}\\s*(?:<[^>{]*>)?\\s*\\(`, 'g');
    let m;
    while ((m = re.exec(src))) candidates.push({ rel, index: m.index });
  }
  if (candidates.length === 0) return null;
  const score = (rel) => moduleParts.filter((seg) => rel.includes(`/${seg}.rs`) || rel.includes(`/${seg}/`)).length;
  candidates.sort((a, b) => score(b.rel) - score(a.rel) || a.rel.localeCompare(b.rel));
  const best = candidates[0];
  if (candidates.length > 1 && score(candidates[1].rel) === score(best.rel)) return null; // неоднозначно
  const src = text(best.rel);
  const paramsOpen = src.indexOf('(', best.index);
  const paramsClose = matchDelimiter(src, paramsOpen, '(', ')');
  const bodyOpen = src.indexOf('{', paramsClose);
  const bodyClose = matchDelimiter(src, bodyOpen, '{', '}');
  return { file: best.rel, line: lineOf(src, best.index), body: src.slice(bodyOpen + 1, bodyClose) };
}

const DISABLED_FIRST_STATEMENT = /^\s*(?:return\s+)?(?:err!\s*\(|require!\s*\(\s*false\b|Err\s*\()/;
// `let _ = (ctx, a, b);` в начале — приём «аргументы сохранены ради стабильности IDL, но не используются»: это не работа.
const isDisabled = (body) => DISABLED_FIRST_STATEMENT.test(stripComments(body).trim().replace(/^(?:\s*let\s+_\s*=[^;]*;)+/, '').trim());

function describeHandler(program, fn) {
  const own = stripComments(fn.body).trim();
  const delegate = DELEGATE.exec(own);
  const lib = program.lib;
  if (delegate && /\)\s*;?\s*$/.test(own) && !own.includes('\n    let ') && !own.includes(';\n')) {
    const target = findHandler(program.srcDir, delegate[1]);
    if (target) {
      return { kind: 'delegate', path: delegate[1], file: target.file, line: target.line,
        disabledOnChain: isDisabled(target.body) };
    }
    return { kind: 'delegate', path: delegate[1], file: null, line: null, disabledOnChain: false };
  }
  return { kind: 'inline', path: null, file: lib, line: fn.line, disabledOnChain: isDisabled(fn.body) };
}

// ---------------------------------------------------------------- имена и поиск
const camelOf = (snake) => snake.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
const pascalOf = (snake) => { const c = camelOf(snake); return c[0].toUpperCase() + c.slice(1); };
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Как в коде называют Program-объект каждой программы (backend, тесты, скрипты). Неизвестный получатель — «любая программа». */
const RECEIVERS = [
  [/^(program|core|coreProgram)$/, 'aof_core'],
  [/^(market|marketProgram)$/, 'aof_market'],
  [/^(quests|questsProgram)$/, 'aof_quests'],
  [/^(rebirth|rebirthProgram)$/, 'aof_rebirth'],
  [/^(liquidity|liquidityProgram)$/, 'aof_liquidity'],
  [/^(session|sessionProgram)$/, 'aof_session_keys'],
];
const receiverProgram = (identifier) => (RECEIVERS.find(([re]) => re.test(identifier)) || [null, null])[1];

/** Вызовы Anchor-клиента: `<получатель>.methods[ as any)].<имя>(` — единственная форма, где программа определяется надёжно. */
const METHOD_CALL = /\b([A-Za-z_]\w*)\.methods(?:\s+as\s+any\s*\))?\s*\.\s*([A-Za-z_]\w*)\s*\(/g;

/** Реестры/таблицы/allowlist'ы перечисляют много имён сразу и вызывающим кодом не являются. */
const REGISTRY_THRESHOLD = 20;

/** В JSON — только непустые категории (отсутствие ключа = 0); счётчики остаются в summary. */
const nonEmpty = (categories) => Object.fromEntries(Object.entries(categories).filter(([, v]) => v.count > 0)
  .map(([k, v]) => [k, { calls: v.calls ?? 0, mentions: v.mentions ?? 0, files: v.files, ...(v.more ? { more: v.more } : {}) }]));

function matches(files, predicate) {
  const hits = files.filter((rel) => predicate(text(rel)));
  return { count: hits.length, files: hits.slice(0, MAX_FILES_LISTED), more: Math.max(0, hits.length - MAX_FILES_LISTED) };
}

// ---------------------------------------------------------------- сборка
export function loadRegistry() {
  const registry = JSON.parse(read('watchtower/addresses.json'));
  return registry.programs.map((p) => ({
    name: p.name, lib: p.source, srcDir: path.posix.dirname(p.source), idl: p.idl,
  }));
}

export function buildInventory() {
  const programs = loadRegistry();
  const roles = exists(ROLES_FILE) ? JSON.parse(read(ROLES_FILE)) : { programs: {} };
  const callFiles = Object.fromEntries(Object.entries(CALL_SITE_CATEGORIES).map(([k, f]) => [k, f()]));
  const testFiles = Object.fromEntries(Object.entries(TEST_CATEGORIES).map(([k, f]) => [k, f()]));
  const bringupFiles = BRINGUP_SURFACES.filter(exists);
  const rustCrateFiles = programs.flatMap((p) => walk(p.srcDir, ['.rs'], [/_tests?\.rs$/, /\/tests?\.rs$/]));

  // 1. все инструкции и их владельцы по имени
  const idls = programs.map((program) => ({ program, idl: JSON.parse(read(program.idl)) }));
  const owners = new Map(); // snake -> [program]
  for (const { program, idl } of idls) for (const ix of idl.instructions) owners.set(ix.name, [...(owners.get(ix.name) || []), program.name]);
  const allNames = [...owners.keys()];
  const nameByForm = new Map(); // любая форма имени -> snake
  for (const snake of allNames) for (const form of [snake, camelOf(snake), pascalOf(snake)]) nameByForm.set(form, snake);
  const literalRe = new RegExp(`["'\`](${[...nameByForm.keys()].map(escapeRe).join('|')})["'\`]`, 'g');
  const mentionRe = new RegExp(`\\b(${[...nameByForm.keys()].map(escapeRe).join('|')})\\b`, 'g');

  // 2. по каждому файлу: какие имена в нём названы (для реестров) и какие вызовы методов есть
  const perFile = new Map();
  const scan = (rel, { loose }) => {
    if (perFile.has(rel)) return perFile.get(rel);
    const src = text(rel);
    const calls = []; // [программа|null, snake]
    for (const m of src.matchAll(METHOD_CALL)) {
      const snake = nameByForm.get(m[2]);
      if (snake) calls.push([receiverProgram(m[1]), snake]);
    }
    const literals = new Set();
    for (const m of src.matchAll(literalRe)) literals.add(nameByForm.get(m[1]));
    const mentions = new Set();
    if (loose) for (const m of src.matchAll(mentionRe)) mentions.add(nameByForm.get(m[1]));
    const info = { calls, literals, mentions };
    perFile.set(rel, info);
    return info;
  };
  const registries = new Map(); // файл -> число различных имён
  for (const files of Object.values(callFiles)) {
    for (const rel of files) {
      const { literals } = scan(rel, { loose: false });
      if (literals.size >= REGISTRY_THRESHOLD) registries.set(rel, literals.size);
    }
  }
  const isRegistry = (rel) => registries.has(rel);

  const attribute = (rel, program, snake, { loose }) => {
    // true, если файл rel — свидетельство в пользу ИМЕННО program.snake
    const info = scan(rel, { loose });
    const shared = owners.get(snake).length > 1;
    // Имя, уникальное одной программе, определяет её само — получатель не нужен (в тестах Program-объект зовут по-разному).
    // Получатель решает только для общих имён (ротация authority, set_fees, …).
    if (info.calls.some(([receiver, name]) => name === snake && (!shared || receiver === null || receiver === program))) return 'call';
    if (!shared && (info.literals.has(snake) || (loose && info.mentions.has(snake)))) return 'mention';
    return null;
  };
  const collect = (files, program, snake, { loose = false, skipRegistries = true } = {}) => {
    const hits = { calls: 0, mentions: 0, files: [] };
    for (const rel of files) {
      if (skipRegistries && isRegistry(rel)) continue;
      const kind = attribute(rel, program, snake, { loose });
      if (!kind) continue;
      if (kind === 'call') hits.calls += 1; else hits.mentions += 1;
      hits.files.push(rel);
    }
    return { calls: hits.calls, mentions: hits.mentions, count: hits.files.length, files: hits.files.slice(0, MAX_FILES_LISTED), more: Math.max(0, hits.files.length - MAX_FILES_LISTED) };
  };

  const instructions = [];
  const problems = [];
  for (const { program, idl } of idls) {
    const idlNames = idl.instructions.map((i) => i.name);
    const parsed = programFns(program.lib);
    const fnByName = new Map(parsed.fns.map((f) => [f.name, f]));
    for (const name of idlNames) if (!fnByName.has(name)) problems.push(`${program.name}: инструкция ${name} есть в IDL, но нет pub fn в #[program]`);
    for (const fn of parsed.fns) if (!idlNames.includes(fn.name)) problems.push(`${program.name}: pub fn ${fn.name} есть в #[program], но нет в IDL (${program.idl})`);
    const declared = (roles.programs?.[program.name]) || {};
    const cpiRe = (snake) => new RegExp(`\\b${escapeRe(program.name)}::cpi::${escapeRe(snake)}\\b`);
    for (const name of idlNames) {
      const fn = fnByName.get(name);
      const handler = fn ? describeHandler(program, fn) : { kind: 'missing', path: null, file: null, line: null, disabledOnChain: false };
      const callSites = {};
      for (const [category, files] of Object.entries(callFiles)) callSites[category] = collect(files, program.name, name);
      callSites.rustCpi = matches(rustCrateFiles.filter((f) => !f.startsWith(`${program.srcDir}/`)), (src) => cpiRe(name).test(src));
      callSites.rustCpi = { calls: callSites.rustCpi.count, mentions: 0, ...callSites.rustCpi };
      const registryFiles = [...registries.keys()].filter((rel) => scan(rel, { loose: false }).literals.has(name)).sort();
      const tests = {
        validator: collect(testFiles.validator, program.name, name, { skipRegistries: false }),
        selfTests: collect(testFiles.selfTests, program.name, name, { loose: true, skipRegistries: false }),
        readiness: collect(testFiles.readiness, program.name, name, { loose: true, skipRegistries: false }),
        rust: collect(testFiles.rust, program.name, name, { loose: true, skipRegistries: false }),
      };
      const bringup = bringupFiles.filter((f) => attribute(f, program.name, name, { loose: false }));
      const declaredEntry = declared[name] || null;
      const callSiteCount = Object.values(callSites).reduce((n, c) => n + c.count, 0);
      instructions.push({
        program: program.name,
        name,
        camel: camelOf(name),
        inIdl: true,
        sharedName: owners.get(name).length > 1,
        handler: { kind: handler.kind, path: handler.path, file: handler.file, line: handler.line },
        disabledOnChain: handler.disabledOnChain,
        role: declaredEntry?.role ?? null,
        status: declaredEntry?.status ?? null,
        replacedBy: declaredEntry?.replacedBy ?? null,
        note: declaredEntry?.note ?? null,
        evidence: declaredEntry?.evidence ?? null,
        callSites: nonEmpty(callSites),
        registries: registryFiles,
        bringup,
        tests: nonEmpty(tests),
        summary: {
          callSiteCount,
          validatorTested: tests.validator.count > 0,
          anyTest: Object.values(tests).some((t) => t.count > 0),
        },
      });
    }
  }
  const registryList = [...registries.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([file, distinctInstructions]) => ({ file, distinctInstructions }));
  return { instructions, problems, roles, programs, registries: registryList };
}

// ---------------------------------------------------------------- проверки
export function check({ instructions, problems, roles, programs }) {
  const errors = [...problems];
  const byProgram = new Map(programs.map((p) => [p.name, new Set(instructions.filter((i) => i.program === p.name).map((i) => i.name))]));
  if (!exists(ROLES_FILE)) errors.push(`нет ${ROLES_FILE}`);
  if (roles.schemaVersion !== undefined && roles.schemaVersion !== 1) errors.push(`${ROLES_FILE}: неизвестная schemaVersion ${roles.schemaVersion}`);

  for (const item of instructions) {
    const where = `${item.program}.${item.name}`;
    if (!item.role) { errors.push(`${where}: инструкция есть в IDL, но не классифицирована — добавьте запись в ${ROLES_FILE} (роль, статус, заметка)`); continue; }
    if (!ROLES.includes(item.role)) errors.push(`${where}: неизвестная роль '${item.role}' (допустимо: ${ROLES.join(', ')})`);
    if (!STATUSES.includes(item.status)) errors.push(`${where}: неизвестный статус '${item.status}' (допустимо: ${STATUSES.join(', ')})`);
    if (!item.note || String(item.note).trim().length < 8) errors.push(`${where}: нужна осмысленная заметка — зачем инструкция и что с ней делать`);
    if (item.disabledOnChain && item.status !== 'disabled-on-chain') {
      errors.push(`${where}: код отключает инструкцию (первая команда — require!(false)/err!), а в классификации статус '${item.status}'`);
    }
    if (!item.disabledOnChain && item.status === 'disabled-on-chain') {
      errors.push(`${where}: в классификации инструкция отключена, но в коде этого не видно (её включили? обновите статус)`);
    }
    if (item.role === 'deprecated') {
      const sameProgram = byProgram.get(item.program);
      if (!item.replacedBy) errors.push(`${where}: роль deprecated требует replacedBy`);
      else if (!sameProgram.has(item.replacedBy)) errors.push(`${where}: replacedBy '${item.replacedBy}' — такой инструкции нет в ${item.program}`);
    }
    if (item.role === 'candidate-dead-code') {
      if (!item.evidence || String(item.evidence).trim().length < 20) errors.push(`${where}: candidate-dead-code требует evidence — что именно искали и где (удалять по нему всё равно нельзя)`);
      if (item.summary.callSiteCount > 0) errors.push(`${where}: помечена candidate-dead-code, но call sites есть (${item.summary.callSiteCount}) — утверждение ложно`);
    }
  }
  for (const [program, entries] of Object.entries(roles.programs || {})) {
    if (!byProgram.has(program)) { errors.push(`${ROLES_FILE}: программа '${program}' не из реестра`); continue; }
    for (const name of Object.keys(entries)) {
      if (!byProgram.get(program).has(name)) errors.push(`${ROLES_FILE}: запись ${program}.${name} устарела — такой инструкции нет в IDL`);
    }
  }
  return errors;
}

// ---------------------------------------------------------------- вывод
/**
 * Что гейт обязан держать свежим: классификация и то, что из кода о ней известно. Данные call sites и тестов
 * меняются при правке ЛЮБОГО файла репозитория (например, нового теста, где упомянуто имя инструкции), поэтому
 * они справочные: --write их обновляет, а --check лишь предупреждает, что они отстали, и не падает.
 */
export function stableProjection(json) {
  return json.instructions.map((i) => ({
    program: i.program, name: i.name, sharedName: i.sharedName, role: i.role, status: i.status, replacedBy: i.replacedBy,
    note: i.note, evidence: i.evidence, disabledOnChain: i.disabledOnChain, handler: { kind: i.handler.kind, file: i.handler.file },
  }));
}

/** Разделы Markdown, которые зависят только от стабильной части (роли и отключённые инструкции). */
export function stableMarkdownSections(markdown) {
  const section = (title) => {
    const start = markdown.indexOf(`## ${title}`);
    if (start < 0) return '';
    const next = markdown.indexOf('\n## ', start + 3);
    return markdown.slice(start, next < 0 ? markdown.length : next);
  };
  return [section('Роли'), section('Отключены в коде')];
}

export function toJson(model) {
  const { instructions, programs } = model;
  const totals = (list) => ({
    instructions: list.length,
    byRole: Object.fromEntries(ROLES.map((r) => [r, list.filter((i) => i.role === r).length])),
    disabledOnChain: list.filter((i) => i.disabledOnChain).length,
    validatorTested: list.filter((i) => i.summary.validatorTested).length,
    sharedNames: list.filter((i) => i.sharedName).length,
    withoutAnyCallSite: list.filter((i) => !i.sharedName && i.summary.callSiteCount === 0).length,
    withoutCallSiteAndTest: list.filter((i) => !i.sharedName && i.summary.callSiteCount === 0 && !i.summary.anyTest).length,
  });
  return {
    schemaVersion: 1,
    generatedBy: 'scripts/instruction-inventory.mjs',
    note: 'Поиск call sites СТАТИЧЕСКИЙ и текстовый: он говорит, где смотреть, а не доказывает «вызывается/не вызывается». Вызовы X.methods.имя( приписываются программе по имени получателя; совпадения по строке считаются только для имён, которые есть у одной программы; файлы с >=20 именами — реестры, а не вызывающий код. Удалять код по этому файлу нельзя.',
    registries: model.registries,
    totals: totals(instructions),
    programs: Object.fromEntries(programs.map((p) => [p.name, totals(instructions.filter((i) => i.program === p.name))])),
    instructions,
  };
}

const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : '—');

export function toMarkdown(model) {
  const json = toJson(model);
  const { instructions, programs } = model;
  const lines = [];
  lines.push('# Инвентарь инструкций AOF');
  lines.push('');
  lines.push('Файл создаёт `node scripts/instruction-inventory.mjs --write`; гейт — `--check` (его же зовёт `tests/readiness/instruction-inventory.test.cjs`).');
  lines.push('Машинная версия — [`INSTRUCTION_INVENTORY.json`](INSTRUCTION_INVENTORY.json); ручная классификация — [`security/instruction-roles.json`](../security/instruction-roles.json).');
  lines.push('');
  lines.push('> Поиск call sites **статический и текстовый**: он указывает, где смотреть, и не доказывает «вызывается» или «не вызывается»');
  lines.push('> (имена из одного слова — `craft`, `stake`, `reroll` — дают случайные совпадения). Удалять код по этому списку нельзя:');
  lines.push('> сначала нужны доказательство отсутствия всех call sites и тест на замещающий путь.');
  lines.push('');
  lines.push('## Итоги');
  lines.push('');
  lines.push('| Программа | Инструкций | Отключено в коде | Задеты validator-тестами (статически) | Без call sites* | Без call sites и тестов* |');
  lines.push('|---|---:|---:|---:|---:|---:|');
  for (const p of programs) {
    const t = json.programs[p.name];
    lines.push(`| ${p.name} | ${t.instructions} | ${t.disabledOnChain} | ${t.validatorTested} (${pct(t.validatorTested, t.instructions)}) | ${t.withoutAnyCallSite} | ${t.withoutCallSiteAndTest} |`);
  }
  const t = json.totals;
  lines.push(`| **всего** | **${t.instructions}** | **${t.disabledOnChain}** | **${t.validatorTested}** (${pct(t.validatorTested, t.instructions)}) | **${t.withoutAnyCallSite}** | **${t.withoutCallSiteAndTest}** |`);
  lines.push('');
  lines.push('\\* без инструкций с общими именами. «Задеты validator-тестами» — статический подсчёт вызовов `<получатель>.methods.<имя>(` в `tests/*.ts`. Динамический замер CU');
  lines.push('(`tests/aof_cu_report.ts`, только aof_core, только успешные транзакции) может дать другое число; он остаётся авторитетным для CU.');
  lines.push('');
  lines.push('Про «66 из 120»: по условию задачи динамический замер (`anchor test`, CU-отчёт) задел 66 из 120 инструкций aof_core — это число здесь НЕ измерено');
  lines.push('(нет `solana-test-validator`). Статический подсчёт выше для aof_core больше, потому что имя в тесте может стоять в негативном кейсе, который ничего не');
  lines.push('исполняет успешно. Точный список расхождений даёт `node scripts/instruction-inventory.mjs --compare-cu target/cu-report.md` после `anchor test`.');
  lines.push('Для aquests, aof_liquidity и aof_session_keys validator-тестов в `tests/*.ts` нет вообще — их покрывают только Rust-тесты, самотесты и readiness.'.replace('aquests', 'aof_quests'));
  lines.push('');
  lines.push('## Роли');
  lines.push('');
  lines.push('| Роль | ' + programs.map((p) => p.name).join(' | ') + ' | всего |');
  lines.push('|---|' + programs.map(() => '---:').join('|') + '|---:|');
  for (const role of ROLES) {
    const row = programs.map((p) => json.programs[p.name].byRole[role]);
    lines.push(`| ${role} | ${row.join(' | ')} | ${json.totals.byRole[role]} |`);
  }
  lines.push('');
  const disabled = instructions.filter((i) => i.disabledOnChain);
  lines.push(`## Отключены в коде (${disabled.length})`);
  lines.push('');
  lines.push('Первая команда обработчика — `require!(false, …)` или `err!(…)`: инструкция есть в IDL, но на цепи всегда отказывает.');
  lines.push('');
  lines.push('| Инструкция | Роль | Заметка |');
  lines.push('|---|---|---|');
  for (const i of disabled) lines.push(`| ${i.program}.${i.name} | ${i.role ?? '—'} | ${(i.note ?? '—').replace(/\|/g, '\\|')} |`);
  lines.push('');
  const noSites = instructions.filter((i) => !i.sharedName && i.summary.callSiteCount === 0);
  lines.push(`## Без найденных call sites (${noSites.length})`);
  lines.push('');
  lines.push('Не «мёртвый код», а список мест для ручной проверки. «Тесты» — есть ли хоть одно покрытие (validator / самотест / readiness / Rust).');
  lines.push(`Инструкции с общими именами (${json.totals.sharedNames}: ротация authority, set_fees, set_paused, vrf_pool_*) исключены: по тексту нельзя определить, какой программе принадлежит упоминание.`);
  lines.push('');
  lines.push('| Инструкция | Роль | Статус | Тесты | Заметка |');
  lines.push('|---|---|---|---|---|');
  for (const i of noSites) {
    const tests = Object.keys(i.tests).join(', ') || '—';
    lines.push(`| ${i.program}.${i.name} | ${i.role ?? '—'} | ${i.status ?? '—'} | ${tests} | ${(i.note ?? '—').replace(/\|/g, '\\|')} |`);
  }
  lines.push('');
  lines.push('## Полный список');
  lines.push('');
  lines.push('Колонки call sites: B — backend, S — admin-скрипты, F — frontend, G — game, P — platform (src/, functions/, watchtower/), C — CPI из других программ;');
  lines.push('тесты: V — validator, T — самотесты, R — readiness, U — Rust; «bringup» — задействована ли в `devnet-bringup.sh`.');
  lines.push('');
  lines.push('| Программа | Инструкция | Роль | Статус | B | S | F | G | P | C | V | T | R | U | bringup |');
  lines.push('|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|:---:|');
  for (const i of instructions) {
    const n = (group, key) => (group[key] ? group[key].files.length + (group[key].more || 0) : 0);
    const c = i.callSites;
    const k = i.tests;
    lines.push(`| ${i.program} | ${i.name}${i.sharedName ? ' ~' : ''} | ${i.role ?? '—'} | ${i.status ?? '—'} | ${n(c, 'backend')} | ${n(c, 'adminScripts')} | ${n(c, 'frontend')} | ${n(c, 'game')} | ${n(c, 'platform')} | ${n(c, 'rustCpi')} | ${n(k, 'validator')} | ${n(k, 'selfTests')} | ${n(k, 'readiness')} | ${n(k, 'rust')} | ${i.bringup.length ? '✓' : ''} |`);
  }
  lines.push('');
  return lines.join('\n');
}

// ---------------------------------------------------------------- сверка с CU-отчётом
/**
 * `tests/aof_cu_report.ts` пишет target/cu-report.md: по логам реальных транзакций локального валидатора
 * («N of 120 IDL instructions exercised», только aof_core, только успешные). Здесь он сверяется со статическим
 * охватом: какие инструкции тесты упоминают, но валидатор не выполнил успешно (негативные пути, пропущенные
 * кейсы), и какие не затронуты ни тем, ни другим.
 */
export function parseCuReport(markdown) {
  const rows = new Map();
  for (const line of markdown.split('\n')) {
    const m = /^\|\s*([A-Z][A-Za-z0-9]*)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|/.exec(line);
    if (m) rows.set(m[1], { calls: Number(m[2]), maxCu: Number(m[3]), medianCu: Number(m[4]) });
  }
  return rows;
}

/**
 * Порог CU по классам. VRF-раскрытия с PR #35 идут через CPI в Metaplex Token
 * Metadata, поэтому их измеренный максимум 143k–152k (см. измерения в
 * `tests/aof_cu_report.ts`) выше общего порога; для них действует 175 000.
 * Тест `tests/readiness/instruction-inventory.test.cjs` держит оба значения.
 */
export const CU_LIMIT = 150000;
export const CU_LIMIT_VRF = 175000;
export const VRF_INSTRUCTION = /^(VrfPoolAdd|\w+Commit|\w+Reveal)$/;
export const cuLimitFor = (name) => (VRF_INSTRUCTION.test(name) ? CU_LIMIT_VRF : CU_LIMIT);

export function compareWithCuReport(model, markdown) {
  const rows = parseCuReport(markdown);
  const core = model.instructions.filter((i) => i.program === 'aof_core');
  const pascalByName = new Map(core.map((i) => [pascalOf(i.name), i]));
  const executed = core.filter((i) => rows.has(pascalOf(i.name)));
  const notInIdl = [...rows.keys()].filter((name) => !pascalByName.has(name));
  const referencedNotExecuted = core.filter((i) => i.summary.validatorTested && !rows.has(pascalOf(i.name)));
  const neither = core.filter((i) => !i.summary.validatorTested && !rows.has(pascalOf(i.name)));
  const overBudget = [...rows.entries()].filter(([name, v]) => v.maxCu > cuLimitFor(name)).map(([name, v]) => `${name}: ${v.maxCu}`);
  return { reportRows: rows.size, coreInstructions: core.length, executed: executed.length, notInIdl, referencedNotExecuted: referencedNotExecuted.map((i) => i.name),
    neither: neither.map((i) => i.name), overBudget };
}

// ---------------------------------------------------------------- main
function main() {
  const model = buildInventory();
  const jsonText = `${JSON.stringify(toJson(model), null, 2)}\n`;
  const mdText = `${toMarkdown(model).replace(/\s+$/, '')}\n`; // ровно один перевод строки в конце файла
  if (flag('--write')) {
    fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(ROOT, OUT_JSON), jsonText);
    fs.writeFileSync(path.join(ROOT, OUT_MD), mdText);
    const t = toJson(model).totals;
    console.log(`инвентарь записан: ${t.instructions} инструкций (${OUT_JSON}, ${OUT_MD}); без классификации: ${model.instructions.filter((i) => !i.role).length}`);
    return;
  }
  if (flag('--check')) {
    const errors = check(model);
    const staleHint = 'выполните node scripts/instruction-inventory.mjs --write и закоммитьте результат';
    for (const rel of [OUT_JSON, OUT_MD]) if (!exists(rel)) errors.push(`нет ${rel}: ${staleHint}`);
    let evidenceStale = false;
    if (exists(OUT_JSON)) {
      let committed = null;
      try { committed = JSON.parse(read(OUT_JSON)); } catch { errors.push(`${OUT_JSON} не читается как JSON: ${staleHint}`); }
      if (committed) {
        const fresh = toJson(model);
        const a = JSON.stringify(stableProjection(committed));
        const b = JSON.stringify(stableProjection(fresh));
        if (a !== b) errors.push(`${OUT_JSON} устарел (классификация или набор инструкций изменились): ${staleHint}`);
        else if (read(OUT_JSON) !== jsonText) evidenceStale = true;
      }
    }
    if (exists(OUT_MD)) {
      const [rolesNow, disabledNow] = stableMarkdownSections(mdText);
      const [rolesThen, disabledThen] = stableMarkdownSections(read(OUT_MD));
      if (rolesNow !== rolesThen || disabledNow !== disabledThen) errors.push(`${OUT_MD} устарел (таблица ролей или список отключённых изменились): ${staleHint}`);
      else if (read(OUT_MD) !== mdText) evidenceStale = true;
    }
    if (errors.length) {
      console.error(`инвентарь инструкций: ${errors.length} проблем(а):`);
      for (const e of errors) console.error(`  - ${e}`);
      process.exit(1);
    }
    const t = toJson(model).totals;
    console.log(`инвентарь инструкций: ${t.instructions} инструкций, все классифицированы; отключено в коде: ${t.disabledOnChain}; классификация в файлах свежая`);
    if (evidenceStale) console.log('справочные данные call sites и тестов отстали от репозитория (не ошибка): node scripts/instruction-inventory.mjs --write');
    return;
  }
  const cuIndex = argv.indexOf('--compare-cu');
  if (cuIndex >= 0) {
    const file = argv[cuIndex + 1];
    if (!file || !fs.existsSync(file)) { console.error(`нет CU-отчёта: ${file ?? '<путь>'} (его создаёт anchor test: target/cu-report.md)`); process.exit(2); }
    const result = compareWithCuReport(model, fs.readFileSync(file, 'utf8'));
    console.log(`CU-отчёт: ${result.reportRows} инструкций выполнено успешно из ${result.coreInstructions} в IDL aof_core.`);
    console.log(`Статически упомянуты в validator-тестах, но в CU-отчёте нет (${result.referencedNotExecuted.length}): ${result.referencedNotExecuted.join(', ') || '—'}`);
    console.log(`Не затронуты ни тестами, ни CU-отчётом (${result.neither.length}): ${result.neither.join(', ') || '—'}`);
    if (result.notInIdl.length) console.log(`В отчёте, но не в IDL (${result.notInIdl.length}): ${result.notInIdl.join(', ')}`);
    if (result.overBudget.length) {
      console.log(`Выше порога ${CU_LIMIT} CU (VRF-раскрытия VrfPoolAdd/*Commit/*Reveal — ${CU_LIMIT_VRF} CU): ${result.overBudget.join(', ')}`);
      process.exit(1);
    }
    return;
  }
  process.stdout.write(jsonText);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
