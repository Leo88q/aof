#!/usr/bin/env node
/**
 * Layout/IDL-базис до и после переименования ресурсов (решение владельца 2026-10-01, п. 9).
 *
 * Переименование полей не имеет права менять бинарный layout: порядок и типы полей,
 * размеры аккаунтов, дискриминанты enum, коды ошибок и дискриминанты инструкций
 * обязаны остаться прежними. Anchor build в песочнице нет, поэтому базис снимается
 * статически из исходников, а финальное подтверждение (`anchor build` + `git diff -- idls/`)
 * остаётся за машиной с тулчейном — об этом честно сказано в отчёте.
 *
 *   node scripts/layout-baseline.mjs --write   снять базис в docs/LAYOUT_BASELINE.json
 *   node scripts/layout-baseline.mjs --check   доказать, что layout не изменился
 *   --root <dir>                               считать репозиторий из другого каталога (тесты)
 *
 * Что сравнивается строго: порядок вариантов ResourceKind; последовательность типов и
 * размер fixed-size аккаунтов; порядок и имена ошибок; имена инструкций и их
 * дискриминанты `sha256("global:<name>")[0..8]`; число аккаунтов/инструкций.
 * Что допускается: переименование полей аккаунта при неизменной последовательности типов —
 * это и есть proof «rename не меняет layout» (в отчёте такие поля помечаются `renamed`).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const rootIndex = argv.indexOf('--root');
const ROOT = rootIndex >= 0 ? path.resolve(argv[rootIndex + 1]) : path.resolve(HERE, '..');
const OUT = 'docs/LAYOUT_BASELINE.json';
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));

const FIXED = { Pubkey: 32, u8: 1, i8: 1, bool: 1, u16: 2, i16: 2, u32: 4, i32: 4, f32: 4, u64: 8, i64: 8, f64: 8, u128: 16, i128: 16 };

/** Размер поля: число для фиксированного типа, null для динамического/неизвестного. */
export function fieldSize(type) {
  const t = type.trim();
  if (t in FIXED) return FIXED[t];
  const arr = /^\[([A-Za-z0-9_]+);\s*(\d+)\]$/.exec(t);
  if (arr) { const inner = fieldSize(arr[1]); return inner === null ? null : inner * Number(arr[2]); }
  const opt = /^Option<(.+)>$/.exec(t);
  if (opt) { const inner = fieldSize(opt[1]); return inner === null ? null : 1 + inner; }
  return null;
}

function walkRs(dir) {
  const out = [];
  const visit = (abs) => {
    for (const entry of fs.readdirSync(abs, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name === 'target' || entry.name === 'node_modules') continue;
      const full = path.join(abs, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.name.endsWith('.rs')) out.push(path.relative(ROOT, full).split(path.sep).join('/'));
    }
  };
  if (fs.existsSync(path.join(ROOT, dir))) visit(path.join(ROOT, dir));
  return out.sort();
}

/** Программы: `#[program] pub mod <name>` и каталог, где он объявлен. */
export function programs() {
  const list = [{ name: 'aof_core', crate: 'aof-core', lib: 'aof-core/src/lib.rs' }];
  if (exists('programs')) {
    for (const dir of fs.readdirSync(path.join(ROOT, 'programs')).sort()) {
      const lib = `programs/${dir}/src/lib.rs`;
      if (!exists(lib)) continue;
      const m = /#\[program\][\s\S]{0,200}?pub mod (\w+)\s*\{/.exec(read(lib));
      if (m) list.push({ name: m[1], crate: `programs/${dir}`, lib });
    }
  }
  return list;
}

/** Аккаунты `#[account] pub struct X` с полями, типами, размером и InitSpace. */
export function parseAccounts(files) {
  const accounts = [];
  for (const rel of files) {
    const text = read(rel);
    const re = /#\[account[^\]]*\]\s*(?:#\[derive\(([^\]]*)\)\]\s*)?pub struct (\w+)\s*\{([\s\S]*?)\n\}/g;
    for (const m of text.matchAll(re)) {
      const fields = [];
      for (const line of m[3].split('\n')) {
        const f = /pub\s+(\w+)\s*:\s*([^,]+),/.exec(line.trim());
        if (f) fields.push({ name: f[1], type: f[2].trim() });
      }
      const sizes = fields.map((f) => fieldSize(f.type));
      accounts.push({
        file: rel,
        name: m[2],
        initSpace: /InitSpace/.test(m[1] ?? ''),
        fields,
        typeSequence: fields.map((f) => f.type),
        size: sizes.every((s) => s !== null) ? 8 + sizes.reduce((a, b) => a + b, 0) : null,
      });
    }
  }
  return accounts;
}

/** Ошибки: порядок вариантов `#[error_code]` enum; код = 6000 + индекс внутри enum. */
export function parseErrors(files) {
  const enums = [];
  for (const rel of files) {
    const text = read(rel);
    const re = /#\[error_code\]\s*pub enum (\w+)\s*\{([\s\S]*?)\n\}/g;
    for (const m of text.matchAll(re)) {
      const variants = [];
      for (const line of m[2].split('\n')) {
        const v = /^\s{4}([A-Z]\w*)\s*,/.exec(line);
        if (v && !/^#\[msg/.test(line.trim())) variants.push(v[1]);
      }
      enums.push({ file: rel, name: m[1], variants });
    }
  }
  return enums;
}

/** Инструкции: порядок `pub fn` в `#[program]`-модуле и дискриминант `global:<name>`. */
export function parseInstructions(lib) {
  const text = read(lib);
  const block = /#\[program\][\s\S]*?pub mod \w+\s*\{([\s\S]*?)\n\}/.exec(text)?.[1] ?? '';
  return block.split('\n')
    .map((line) => /^\s*pub fn (\w+)/.exec(line)?.[1])
    .filter(Boolean)
    .map((name) => ({
      name,
      discriminator: crypto.createHash('sha256').update(`global:${name}`).digest('hex').slice(0, 16),
    }));
}

export function buildBaseline() {
  const resourceKind = (() => {
    const src = read('aof-core/src/lib.rs');
    const body = /pub enum ResourceKind\s*\{([\s\S]*?)\n\}/.exec(src)?.[1] ?? '';
    return body.split('\n').map((l) => l.replace(/\/\/.*$/, '').trim()).filter((l) => /^[A-Z]\w*,$/.test(l)).map((l) => l.replace(',', ''));
  })();
  const programList = programs().map((p) => ({
    name: p.name,
    crate: p.crate,
    instructions: parseInstructions(p.lib),
    accounts: parseAccounts(walkRs(`${p.crate}/src`)),
    errors: parseErrors(walkRs(`${p.crate}/src`)),
  }));
  return {
    schemaVersion: 1,
    source: 'source-level baseline; Anchor-generated confirmation pending (anchor build + git diff -- idls/)',
    note: 'Переименование полей допустимо только при неизменных typeSequence/size; имена инструкций, ошибок и дискриминанты меняться не должны.',
    resourceKind,
    resourceKindCount: resourceKind.length,
    programs: programList,
  };
}

/** Сравнение: что обязано совпасть и что считается переименованием, а не изменением layout. */
export function compareLayout(baseline, current) {
  const errors = [];
  const notes = [];
  if (baseline.resourceKindCount !== current.resourceKindCount) errors.push(`ResourceKind: вариантов ${current.resourceKindCount}, было ${baseline.resourceKindCount}`);
  for (let i = 0; i < Math.max(baseline.resourceKind.length, current.resourceKind.length); i += 1) {
    if (baseline.resourceKind[i] !== current.resourceKind[i]) {
      errors.push(`ResourceKind[${i}]: «${current.resourceKind[i] ?? '—'}» вместо «${baseline.resourceKind[i] ?? '—'}» (порядок/дискриминанты менять нельзя)`);
    }
  }
  const byName = new Map(current.programs.map((p) => [p.name, p]));
  for (const was of baseline.programs) {
    const now = byName.get(was.name);
    if (!now) { errors.push(`${was.name}: программа исчезла из исходников`); continue; }
    const wasIx = was.instructions.map((i) => i.name);
    const nowIx = now.instructions.map((i) => i.name);
    if (wasIx.length !== nowIx.length) errors.push(`${was.name}: инструкций ${nowIx.length}, было ${wasIx.length}`);
    for (const ix of was.instructions) {
      const found = now.instructions.find((x) => x.name === ix.name);
      if (!found) errors.push(`${was.name}.${ix.name}: инструкция исчезла`);
      else if (found.discriminator !== ix.discriminator) errors.push(`${was.name}.${ix.name}: дискриминант ${found.discriminator}, был ${ix.discriminator}`);
    }
    if (wasIx.join(',') !== nowIx.join(',')) errors.push(`${was.name}: порядок инструкций изменился`);
    const wasAcc = new Map(was.accounts.map((a) => [a.name, a]));
    for (const acc of now.accounts) {
      const before = wasAcc.get(acc.name);
      if (!before) { errors.push(`${was.name}: появился аккаунт ${acc.name} без базиса`); continue; }
      if (before.typeSequence.join('|') !== acc.typeSequence.join('|')) {
        errors.push(`${acc.name}: типы/порядок полей изменились: [${acc.typeSequence.join(', ')}] вместо [${before.typeSequence.join(', ')}]`);
      }
      if (before.size !== acc.size) errors.push(`${acc.name}: размер ${acc.size}, был ${before.size}`);
      for (const field of acc.fields) {
        const old = before.fields.find((f) => f.name === field.name);
        if (!old) notes.push(`${acc.name}.${field.name}: поле переименовано/добавлено (позиция ${acc.fields.indexOf(field)}, тип ${field.type})`);
        else if (old.type !== field.type) errors.push(`${acc.name}.${field.name}: тип ${field.type}, был ${old.type}`);
      }
      if (before.fields.length !== acc.fields.length) errors.push(`${acc.name}: полей ${acc.fields.length}, было ${before.fields.length}`);
    }
    const wasErr = new Map(was.errors.map((e) => [e.name, e]));
    for (const e of now.errors) {
      const before = wasErr.get(e.name);
      if (!before) { errors.push(`${was.name}: появился error-enum ${e.name} без базиса`); continue; }
      if (before.variants.join(',') !== e.variants.join(',')) errors.push(`${e.name}: порядок/состав ошибок изменился`);
    }
    if (was.errors.map((e) => e.name).join(',') !== now.errors.map((e) => e.name).join(',')) errors.push(`${was.name}: изменился список error-enum`);
  }
  return { errors, notes };
}

function main() {
  const baseline = buildBaseline();
  if (argv.includes('--write')) {
    fs.writeFileSync(path.join(ROOT, OUT), `${JSON.stringify(baseline, null, 2)}\n`);
    const accounts = baseline.programs.reduce((n, p) => n + p.accounts.length, 0);
    const instructions = baseline.programs.reduce((n, p) => n + p.instructions.length, 0);
    const errors = baseline.programs.reduce((n, p) => n + p.errors.reduce((k, e) => k + e.variants.length, 0), 0);
    console.log(`layout-базис записан: ${baseline.resourceKindCount} ResourceKind, ${accounts} аккаунтов, ${instructions} инструкций, ${errors} ошибок`);
    return;
  }
  if (argv.includes('--check')) {
    const errorsList = [];
    if (!exists(OUT)) errorsList.push(`нет ${OUT}: node scripts/layout-baseline.mjs --write`);
    else {
      const committed = JSON.parse(read(OUT));
      const { errors, notes } = compareLayout(committed, baseline);
      errorsList.push(...errors);
      for (const n of notes) console.log(`  ~ переименование без смены layout: ${n}`);
    }
    if (errorsList.length) { console.error(`layout-baseline: ${errorsList.length} проблем(а):`); for (const e of errorsList) console.error(`  - ${e}`); process.exit(1); }
    console.log(`layout-baseline: layout не изменился (${baseline.resourceKindCount} ResourceKind, ${baseline.programs.length} программ)`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
