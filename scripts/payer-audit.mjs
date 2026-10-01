#!/usr/bin/env node
/**
 * Аудит плательщиков: кто платит rent за каждый аккаунт, который создают инструкции шести программ.
 *
 * Решение владельца: игрок оплачивает комиссию сети и rent ВСЕХ пользовательских аккаунтов, которые появляются
 * из его действия; проект платит только за deployment и глобальную инфраструктуру. Никаких скрытых субсидий
 * кошелька authority/operator: `payer = authority` под ограничением `authority == config.operator` означает, что
 * rent чужого (игрока) аккаунта платит оператор.
 *
 * Что делает: разбирает каждую структуру `#[derive(Accounts)]` и каждое поле с `init` / `init_if_needed`, определяет
 *   * кто платит (`payer = X`) и является ли X оператором/authority (по его собственным ограничениям);
 *   * чьё это (`owner`): аккаунт игрока (seeds содержат ключ пользователя или mint инструмента), глобальный (только константы
 *     и номера) или неопределённый;
 *   * размер (`space`) — для расчёта rent по живому RPC.
 * и соединяет это с РУЧНОЙ политикой `security/payer-policy.json`: для каждой записи указано, кто ДОЛЖЕН платить
 * (player / operator / cranker-deposit) и статус (`ok` или `debt` — известное нарушение, которое нужно исправить до деплоя).
 *
 *   node scripts/payer-audit.mjs --write    пересоздать docs/PAYER_MATRIX.md и .json
 *   node scripts/payer-audit.mjs --check    гейт (см. ниже)
 *   --root <dir>                            считать репозиторий из другого каталога (тесты)
 *
 * --check падает, если: появилась инициализация аккаунта без записи в политике; запись устарела; политика говорит
 * «платит игрок», а код — оператор, и это не помечено `debt`; запись `debt` больше не соответствует коду (исправлено —
 * пометьте `ok`); пользовательский аккаунт платит оператор без `debt` или без объяснения (`reason`).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const rootIndex = argv.indexOf('--root');
const ROOT = rootIndex >= 0 ? path.resolve(argv[rootIndex + 1]) : path.resolve(HERE, '..');
const POLICY_FILE = 'security/payer-policy.json';
const OUT_JSON = 'docs/PAYER_MATRIX.json';
const OUT_MD = 'docs/PAYER_MATRIX.md';
export const OWNERS = ['player', 'global'];
export const PAYERS = ['player', 'operator', 'cranker-deposit'];
export const STATUSES = ['ok', 'debt'];

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));

function walk(rel) {
  const out = [];
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return out;
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name === 'target' || entry.name === 'node_modules') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.name.endsWith('.rs') && !/tests?\.rs$|_tests\.rs$/.test(entry.name)) out.push(path.relative(ROOT, full).split(path.sep).join('/'));
    }
  };
  visit(abs);
  return out;
}

/** Сбалансированный разбор от открывающей скобки (строки и комментарии пропускаются). */
function balanced(src, open, openChar, closeChar) {
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    const c = src[i];
    if (c === '"') { i += 1; while (i < src.length && src[i] !== '"') i += src[i] === '\\' ? 2 : 1; continue; }
    if (src.startsWith('//', i)) { const n = src.indexOf('\n', i); i = n < 0 ? src.length : n; continue; }
    if (c === openChar) depth += 1;
    else if (c === closeChar) { depth -= 1; if (depth === 0) return i; }
  }
  throw new Error('несбалансированные скобки');
}

const stripLineComments = (text) => text.replace(/\/\/[^\n]*/g, '');

/** Поля структуры: { attrs: [текст #[...]], name, type }. */
function parseFields(body) {
  const fields = [];
  let i = 0;
  let attrs = [];
  while (i < body.length) {
    const rest = body.slice(i);
    const skip = /^\s+/.exec(rest);
    if (skip) { i += skip[0].length; continue; }
    if (rest.startsWith('//')) { i += rest.indexOf('\n') < 0 ? rest.length : rest.indexOf('\n'); continue; }
    if (rest.startsWith('#[')) {
      const end = balanced(body, i + 1, '[', ']');
      attrs.push(body.slice(i + 2, end));
      i = end + 1;
      continue;
    }
    const field = /^pub\s+(\w+)\s*:\s*/.exec(rest);
    if (field) {
      // тип до запятой верхнего уровня
      let j = i + field[0].length; let depth = 0;
      for (; j < body.length; j += 1) {
        const c = body[j];
        if (c === '<' || c === '(' || c === '[') depth += 1;
        else if (c === '>' || c === ')' || c === ']') depth -= 1;
        else if (c === ',' && depth === 0) break;
      }
      fields.push({ attrs, name: field[1], type: body.slice(i + field[0].length, j).trim() });
      attrs = [];
      i = j + 1;
      continue;
    }
    i += 1;
  }
  return fields;
}

function accountAttr(field) {
  return field.attrs.filter((a) => /^account\s*\(/.test(a.trim())).map((a) => a.trim().replace(/^account\s*\(/, '').replace(/\)\s*$/, '')).join(', ');
}

function lookup(attr, key) {
  const m = new RegExp(`(?:^|[\\s,(])${key}\\s*=\\s*`).exec(attr);
  if (!m) return null;
  let depth = 0; let i = m.index + m[0].length; const start = i;
  for (; i < attr.length; i += 1) {
    const c = attr[i];
    if (c === '(' || c === '[' || c === '{') depth += 1;
    else if (c === ')' || c === ']' || c === '}') depth -= 1;
    else if (c === ',' && depth === 0) break;
  }
  return attr.slice(start, i).trim();
}

const PLAYER_SEED_HINT = /\b(user|owner|seller|buyer|maker|bidder|renter|player|holder|winner|sender|recipient|referrer|referee)\.key\(\)|mint\.key\(\)|tool\.key\(\)|authority\.key\(\)/;

export function scanProgram(program) {
  const files = walk(path.posix.dirname(program.source));
  const rows = [];
  for (const rel of files) {
    const src = stripLineComments(read(rel));
    let at = 0;
    while (true) {
      const d = src.indexOf('#[derive(Accounts)]', at);
      if (d < 0) break;
      const m = /pub struct (\w+)\s*(?:<[^>]*>)?\s*\{/.exec(src.slice(d));
      if (!m) { at = d + 10; continue; }
      const open = d + m.index + m[0].length - 1;
      const close = balanced(src, open, '{', '}');
      const fields = parseFields(src.slice(open + 1, close));
      const byName = new Map(fields.map((f) => [f.name, f]));
      for (const field of fields) {
        const attr = accountAttr(field);
        if (!/(^|[\s,(])init(_if_needed)?([\s,)]|$)/.test(attr)) continue;
        const payer = lookup(attr, 'payer');
        const seeds = lookup(attr, 'seeds');
        const space = lookup(attr, 'space');
        const payerField = payer ? byName.get(payer) : null;
        const payerAttr = payerField ? accountAttr(payerField) : '';
        const operatorGated = /config\.(operator|authority)|\.(operator|authority)\b[^,]*==|authority_gate|upgrade_authority/.test(payerAttr)
          || /^(authority|operator|admin|crank)/.test(payer || '') ;
        const seedUsesUser = seeds ? PLAYER_SEED_HINT.test(seeds) : false;
        const typeName = /Account<[^,]+,\s*(\w+)>/.exec(field.type)?.[1] || field.type;
        rows.push({
          program: program.name, file: rel, instruction: m[1], account: field.name, accountType: typeName,
          kind: /init_if_needed/.test(attr) ? 'init_if_needed' : 'init', payer: payer || '(не указан)',
          payerIsOperatorOrAuthority: operatorGated, seeds: seeds ? seeds.replace(/\s+/g, ' ') : null,
          ownerHint: seeds === null ? 'unknown' : (seedUsesUser ? 'player' : 'global'),
          space: space ? space.replace(/\s+/g, ' ') : null,
        });
      }
      at = close;
    }
  }
  return rows;
}

export function loadPrograms() {
  const registry = JSON.parse(read('watchtower/addresses.json'));
  return registry.programs.map((p) => ({ name: p.name, source: p.source }));
}

const keyOf = (r) => `${r.program}.${r.instruction}.${r.account}`;

export function buildMatrix() {
  const policy = exists(POLICY_FILE) ? JSON.parse(read(POLICY_FILE)) : { entries: {} };
  const rows = loadPrograms().flatMap(scanProgram).sort((a, b) => keyOf(a).localeCompare(keyOf(b)));
  for (const row of rows) {
    const declared = policy.entries?.[keyOf(row)] || null;
    row.owner = declared?.owner ?? null;
    row.requiredPayer = declared?.payer ?? null;
    row.status = declared?.status ?? null;
    row.settlement = declared?.settlement ?? null;
    row.refund = declared?.refund ?? null;
    row.reason = declared?.reason ?? null;
    row.actualPayer = row.payerIsOperatorOrAuthority ? 'operator' : 'player-or-signer';
  }
  return { rows, policy };
}

export function check({ rows, policy }) {
  const errors = [];
  if (!exists(POLICY_FILE)) errors.push(`нет ${POLICY_FILE}`);
  const seen = new Set();
  for (const row of rows) {
    const k = keyOf(row);
    seen.add(k);
    if (!row.owner || !row.requiredPayer || !row.status) { errors.push(`${k}: инициализация аккаунта не классифицирована в ${POLICY_FILE} (owner, payer, status)`); continue; }
    if (!OWNERS.includes(row.owner)) errors.push(`${k}: неизвестный owner '${row.owner}'`);
    if (!PAYERS.includes(row.requiredPayer)) errors.push(`${k}: неизвестный payer '${row.requiredPayer}'`);
    if (!STATUSES.includes(row.status)) errors.push(`${k}: неизвестный статус '${row.status}'`);
    if (!row.reason || row.reason.length < 12) errors.push(`${k}: нужна причина (reason) — кто и почему должен платить`);
    if (row.owner === 'player' && row.requiredPayer === 'operator') errors.push(`${k}: аккаунт игрока не может по политике оплачиваться оператором`);
    const operatorPays = row.payerIsOperatorOrAuthority;
    if (row.requiredPayer === 'player' && operatorPays && row.status !== 'debt') errors.push(`${k}: по политике платит игрок, а в коде — оператор/authority (payer = ${row.payer}); это скрытая субсидия — исправьте или пометьте debt`);
    if (row.requiredPayer === 'player' && !operatorPays && row.status === 'debt') errors.push(`${k}: помечено debt, но в коде платит не оператор — исправлено? Пометьте ok`);
    if (row.requiredPayer === 'operator' && !operatorPays) errors.push(`${k}: по политике платит оператор (глобальная инфраструктура), а в коде payer = ${row.payer} — проверьте`);
    if (row.requiredPayer === 'cranker-deposit' && (!row.settlement || !row.refund)) errors.push(`${k}: для cranker-deposit нужны settlement и refund`);
  }
  for (const k of Object.keys(policy.entries || {})) if (!seen.has(k)) errors.push(`${POLICY_FILE}: запись ${k} устарела — такой инициализации в коде нет`);
  return errors;
}

export function toMarkdown({ rows }) {
  const lines = ['# Матрица плательщиков', '',
    'Создаёт `node scripts/payer-audit.mjs --write`; гейт — `--check`. Политика (кто ДОЛЖЕН платить) — `security/payer-policy.json`.',
    'Принцип: **игрок платит комиссию сети и rent своих аккаунтов; проект — только deployment и глобальную инфраструктуру.**', ''];
  const debt = rows.filter((r) => r.status === 'debt');
  lines.push(`Инициализаций аккаунтов: **${rows.length}**; нарушают принцип (долг до деплоя): **${debt.length}**.`, '');
  if (debt.length) {
    lines.push('## Долг: платит оператор, а должен игрок', '', '| Инструкция | Аккаунт | Тип | Платит сейчас | Должен | Причина |', '|---|---|---|---|---|---|');
    for (const r of debt) lines.push(`| ${r.program}.${r.instruction} | ${r.account} | ${r.accountType} | ${r.payer} | ${r.requiredPayer} | ${r.reason} |`);
    lines.push('');
  }
  lines.push('## Все инициализации', '', '| Программа | Инструкция | Аккаунт | Тип | init | payer в коде | Владелец | Должен платить | Статус | Асинхронный settlement | Возврат |', '|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) {
    lines.push(`| ${r.program} | ${r.instruction} | ${r.account} | ${r.accountType} | ${r.kind} | ${r.payer}${r.payerIsOperatorOrAuthority ? ' (оператор)' : ''} | ${r.owner ?? '—'} | ${r.requiredPayer ?? '—'} | ${r.status ?? '—'} | ${r.settlement ?? '—'} | ${r.refund ?? '—'} |`);
  }
  return `${lines.join('\n')}\n`;
}

function main() {
  const model = buildMatrix();
  const json = `${JSON.stringify({ schemaVersion: 1, rows: model.rows }, null, 2)}\n`;
  const md = toMarkdown(model);
  if (argv.includes('--write')) {
    fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(ROOT, OUT_JSON), json);
    fs.writeFileSync(path.join(ROOT, OUT_MD), md);
    console.log(`матрица плательщиков записана: ${model.rows.length} инициализаций, не классифицировано: ${model.rows.filter((r) => !r.status).length}`);
    return;
  }
  if (argv.includes('--check')) {
    const errors = check(model);
    for (const [rel, text] of [[OUT_JSON, json], [OUT_MD, md]]) {
      if (!exists(rel)) errors.push(`нет ${rel}: node scripts/payer-audit.mjs --write`);
      else if (read(rel) !== text) errors.push(`${rel} устарел: node scripts/payer-audit.mjs --write`);
    }
    if (errors.length) { console.error(`payer-audit: ${errors.length} проблем(а):`); for (const e of errors) console.error(`  - ${e}`); process.exit(1); }
    const debt = model.rows.filter((r) => r.status === 'debt').length;
    console.log(`payer-audit: ${model.rows.length} инициализаций классифицированы; долг (платит оператор вместо игрока): ${debt}`);
    return;
  }
  process.stdout.write(json);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
