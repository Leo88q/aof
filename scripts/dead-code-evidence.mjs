#!/usr/bin/env node
/**
 * Evidence для удаления мёртвого кода (шаг B пункта 12).
 *
 * Владелец требует перед удалением таблицу по каждой отключённой инструкции:
 * handler behavior, backend call sites, frontend call sites, tests, admin/security need, decision.
 *
 * Источники: `docs/INSTRUCTION_INVENTORY.json` (кто отключён, кем заменён, call sites),
 * исходники Rust (что именно делает guard) и grep по tests/ за упоминаниями.
 *
 *   node scripts/dead-code-evidence.mjs --write   пересобрать docs/DEAD_CODE_EVIDENCE.{json,md}
 *   node scripts/dead-code-evidence.mjs --check   гейт
 *   --root <dir>                                  считать репозиторий из другого каталога (тесты)
 *
 * Гейт падает, если: набор отключённых инструкций в инвентаре и в evidence разошёлся (значит,
 * удалили код, но не обновили evidence, или наоборот); решение не согласовано с ролью
 * (admin/security нельзя удалять); потерялись записанные call sites; markdown устарел.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const rootIndex = argv.indexOf('--root');
const ROOT = rootIndex >= 0 ? path.resolve(argv[rootIndex + 1]) : path.resolve(HERE, '..');
const INVENTORY = 'docs/INSTRUCTION_INVENTORY.json';
const OUT_JSON = 'docs/DEAD_CODE_EVIDENCE.json';
const OUT_MD = 'docs/DEAD_CODE_EVIDENCE.md';
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));

/** Инструкции, которые остаются в продукте даже без player-UI (экстренные и административные). */
const PROTECTED_ROLES = new Set(['admin', 'security', 'emergency']);
const PROTECTED_NAME_RE = /(guard|pause|sweep|emergency|authority|role|freeze|rescue)/i;

/** Что именно делает guard: первая ветка отказа в теле обработчика. */
export function guardBehavior(entry) {
  const file = entry.handler?.file ?? entry.handler?.path;
  if (!file || !exists(file)) return { kind: 'unknown', text: 'обработчик не найден' };
  const src = read(file).split('\n');
  const start = Math.max(0, (entry.handler.line ?? 1) - 1);
  const window = src.slice(start, start + 40);
  for (const line of window) {
    const m = /err!\(\s*([\w:]+)\s*\)|require!\(\s*false\s*,\s*([\w:]+)\s*\)/.exec(line);
    if (m) return { kind: m[1] ? 'err!' : 'require!(false)', code: (m[1] ?? m[2]).split('::').pop(), line: line.trim() };
  }
  const moduleHandler = entry.handler.kind !== 'inline' ? entry.handler.path : null;
  if (moduleHandler && exists(moduleHandler)) {
    for (const line of read(moduleHandler).split('\n')) {
      const m = /err!\(\s*([\w:]+)\s*\)|require!\(\s*false\s*,\s*([\w:]+)\s*\)/.exec(line);
      if (m) return { kind: m[1] ? 'err!' : 'require!(false)', code: (m[1] ?? m[2]).split('::').pop(), line: line.trim() };
    }
  }
  return { kind: 'unknown', text: 'явного отказа в первых 40 строках обработчика нет' };
}

/** Упоминания инструкции в тестах (validator и readiness). */
export function testEvidence(name, camel) {
  const files = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', 'target'].includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx|cjs|js)$/.test(entry.name)) files.push(full);
    }
  };
  walk(path.join(ROOT, 'tests'));
  const hits = [];
  for (const full of files) {
    const rel = path.relative(ROOT, full).split(path.sep).join('/');
    const text = fs.readFileSync(full, 'utf8');
    if (new RegExp(`\\b(${name}|${camel})\\b`).test(text)) hits.push(rel);
  }
  return hits.sort();
}

export function buildEvidence() {
  const inventory = JSON.parse(read(INVENTORY));
  const disabled = inventory.instructions.filter((i) => i.status === 'disabled-on-chain');
  return {
    schemaVersion: 1,
    note: 'Evidence для удаления мёртвого кода: каждая отключённая инструкция с call sites, тестами и решением.',
    instructions: disabled.map((i) => {
      const guard = guardBehavior(i);
      const backend = i.callSites?.backend ?? { calls: 0, mentions: 0, files: [] };
      const frontend = i.callSites?.frontend ?? { calls: 0, mentions: 0, files: [] };
      const platform = i.callSites?.platform ?? null;
      const protectedRole = PROTECTED_ROLES.has(i.role) || PROTECTED_NAME_RE.test(i.name);
      const hasLiveCalls = (i.callSites?.backend?.calls ?? 0) > 0 || (i.callSites?.frontend?.calls ?? 0) > 0;
      // Удаляем только доказанно мёртвое:
      //  * заменена активной инструкцией;
      //  * pre-genesis миграция при никогда не существовавшем deployment;
      //  * механика не может работать by construction (нет парной инструкции: лимитные ордера
      //    без матчинга, помечены candidate-dead-code);
      //  * deprecated без потребителей и без замены.
      // Всё остальное — «не доказано мёртвой» и требует решения владельца, даже если отключено.
      const unbuildable = i.role === 'candidate-dead-code' && /нет инструкции|not exist|no matching/i.test(i.note ?? '');
      let decision;
      if (protectedRole && i.role !== 'migration') decision = 'keep — admin/security путь, отсутствие player-UI не повод удалять';
      else if (i.replacedBy) decision = `remove — заменена активной ${i.replacedBy}`;
      else if (i.role === 'migration' || /^migrate_/.test(i.name)) decision = `remove — pre-genesis миграция (${guard.code ?? guard.kind}); deployment не существовал`;
      else if (unbuildable) decision = 'remove — by construction: парной инструкции (матчинг/расчёт) в программе нет';
      else if (!hasLiveCalls && i.role === 'deprecated') decision = 'remove — deprecated, потребителей нет';
      // Владелец: отсутствие player call site не делает инструкцию мёртвой. Такие
      // инструкции остаются как «disabled / product decision pending» до его решения.
      else decision = `keep — disabled / product decision pending: ${(i.note ?? '').replace(/^disabled \/ product decision pending — /, '').slice(0, 140)}`;
      return {
        program: i.program,
        name: i.name,
        camel: i.camel,
        role: i.role,
        replacedBy: i.replacedBy ?? null,
        guard,
        backendCallSites: backend,
        frontendCallSites: frontend,
        platformConsumers: platform,
        tests: testEvidence(i.name, i.camel),
        adminOrSecurityNeed: protectedRole && i.role !== 'migration',
        decision,
      };
    }),
  };
}

/** Разбиение на коммиты из порядка владельца (шаг B: сначала миграции, потом лимитки и т.д.). */
export function commitGroup(entry) {
  if (entry.program === 'aof_core' && /migrate_/.test(entry.name)) return 'refactor: remove unused pre-genesis migration instructions';
  if (entry.program === 'aof_market' || /limit_order/.test(entry.name)) return 'refactor: remove disabled legacy limit-order paths';
  if (/marketplace_buy|rental_start/.test(entry.name)) return 'refactor: remove disabled legacy tool market paths';
  return 'refactor: remove remaining disabled gameplay paths';
}

export function toMarkdown(evidence) {
  const lines = [
    '# Evidence для удаления мёртвого кода (шаг B пункта 12)',
    '',
    'Таблица собирается `node scripts/dead-code-evidence.mjs --write`, проверяется `--check`',
    '(`tests/readiness/dead-code-evidence.test.cjs`). Источник списка — `docs/INSTRUCTION_INVENTORY.json`',
    '(статус `disabled-on-chain`): удаление кода обязано сопровождаться обновлением evidence, иначе гейт',
    'падает.',
    '',
    '| Instruction | Handler behavior | Backend call sites | Frontend call sites | Tests | Admin/security need | Decision |',
    '|---|---|---|---|---|---|---|',
  ];
  for (const i of evidence.instructions) {
    const guard = `${i.guard.kind}${i.guard.code ? ` ${i.guard.code}` : ''}`;
    const backend = i.backendCallSites.calls ? `${i.backendCallSites.calls} call(s): ${i.backendCallSites.files.join(', ')}` : '—';
    const frontend = i.frontendCallSites.calls ? `${i.frontendCallSites.calls} call(s): ${i.frontendCallSites.files.join(', ')}` : '—';
    const tests = i.tests.length ? i.tests.join(', ') : '—';
    lines.push(`| \`${i.program}.${i.name}\` | ${guard} | ${backend} | ${frontend} | ${tests} | ${i.adminOrSecurityNeed ? '✅ да' : 'нет'} | ${i.decision} |`);
  }
  const groups = new Map();
  for (const i of evidence.instructions.filter((x) => /^remove/.test(x.decision))) {
    groups.set(commitGroup(i), [...(groups.get(commitGroup(i)) ?? []), i]);
  }
  lines.push('', '## Группировка по коммитам (порядок владельца, только доказанно мёртвое)', '');
  for (const [group, items] of groups) {
    lines.push(`### \`${group}\``, '');
    for (const i of items) lines.push(`* \`${i.program}.${i.name}\` — ${i.decision}`);
    lines.push('');
  }
  lines.push('## Что удаляется вертикальным срезом', '',
    'Для каждой инструкции: Rust handler, `#[derive(Accounts)]`-контекст, состояние (если больше не',
    'используется), событие/ошибка, IDL-entry, backend-route, frontend-caller, тесты, активные docs.',
    'Сгенерированный IDL обновляется вручную как временное отражение (Anchor недоступен), с обязательной',
    'пометкой pending `anchor build` + `git diff` на Mac/CI.', '');
  return `${lines.join('\n')}\n`;
}

export function check(evidence, inventory) {
  const errors = [];
  const disabled = inventory.instructions.filter((i) => i.status === 'disabled-on-chain').map((i) => `${i.program}.${i.name}`).sort();
  const recorded = evidence.instructions.map((i) => `${i.program}.${i.name}`).sort();
  if (JSON.stringify(disabled) !== JSON.stringify(recorded)) {
    const missing = disabled.filter((k) => !recorded.includes(k));
    const extra = recorded.filter((k) => !disabled.includes(k));
    if (missing.length) errors.push(`в evidence нет отключённых инструкций: ${missing.join(', ')}`);
    if (extra.length) errors.push(`evidence ссылается на инструкции, которых больше нет в инвентаре: ${extra.join(', ')}`);
  }
  for (const i of evidence.instructions) {
    if (i.adminOrSecurityNeed && /^remove/.test(i.decision)) errors.push(`${i.program}.${i.name}: admin/security путь помечен на удаление`);
    if (!/^(remove|keep) — /.test(i.decision)) errors.push(`${i.program}.${i.name}: решение обязано быть 'remove — причина' или 'keep — причина'`);
    if (/^keep — не доказано мёртвой: \s*$/.test(i.decision)) errors.push(`${i.program}.${i.name}: для keep нужна причина из инвентаря`);
    if (/^remove/.test(i.decision) && i.guard.kind === 'unknown') errors.push(`${i.program}.${i.name}: удаление без подтверждённого guard`);
    if (/^remove/.test(i.decision) && !/заменена активной|pre-genesis|by construction|deprecated, потребителей нет/.test(i.decision)) {
      errors.push(`${i.program}.${i.name}: удаление допускается только для доказанных категорий (замена/миграция/by construction/deprecated без потребителей)`);
    }
  }
  if (JSON.stringify(evidence) !== JSON.stringify(buildEvidence())) errors.push('evidence устарел: node scripts/dead-code-evidence.mjs --write');
  return errors;
}

function main() {
  const evidence = buildEvidence();
  const json = `${JSON.stringify(evidence, null, 2)}\n`;
  const md = toMarkdown(evidence);
  if (argv.includes('--write')) {
    fs.writeFileSync(path.join(ROOT, OUT_JSON), json);
    fs.writeFileSync(path.join(ROOT, OUT_MD), md);
    console.log(`dead-code evidence записан: ${evidence.instructions.length} инструкций (к удалению: ${evidence.instructions.filter((i) => /^remove/.test(i.decision)).length})`);
    return;
  }
  if (argv.includes('--check')) {
    const errors = [];
    if (!exists(OUT_JSON)) errors.push(`нет ${OUT_JSON}: node scripts/dead-code-evidence.mjs --write`);
    if (!exists(OUT_MD)) errors.push(`нет ${OUT_MD}: node scripts/dead-code-evidence.mjs --write`);
    if (exists(OUT_JSON)) {
      errors.push(...check(JSON.parse(read(OUT_JSON)), JSON.parse(read(INVENTORY))));
      if (exists(OUT_MD) && read(OUT_MD) !== md) errors.push(`${OUT_MD} устарел: node scripts/dead-code-evidence.mjs --write`);
    }
    if (errors.length) { console.error(`dead-code-evidence: ${errors.length} проблем(а):`); for (const e of errors) console.error(`  - ${e}`); process.exit(1); }
    console.log(`dead-code-evidence: ${evidence.instructions.length} инструкций, к удалению ${evidence.instructions.filter((i) => /^remove/.test(i.decision)).length}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
