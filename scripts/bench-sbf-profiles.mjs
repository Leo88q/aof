#!/usr/bin/env node
/**
 * Бенчмарк release-профилей SBF: размер `.so`, время сборки, SHA-256 и (по желанию) Compute Units.
 *
 * Зачем. Rent за ProgramData пропорционален размеру программы, а профиль `[profile.release]` в корневом
 * `Cargo.toml` сейчас — только `overflow-checks = true`. Выбор opt-level / LTO / codegen-units / strip нельзя
 * делать на глаз: нельзя считать, что fat LTO поддерживается SBF-тулчейном, что `"z"` меньше `"s"` и что
 * экономия составит 15–20%. Этот харнесс ИЗМЕРЯЕТ; профиль в `Cargo.toml` он не трогает — выводит рекомендацию,
 * а менять профиль (после review) можно только руками.
 *
 * Запускать на машине владельца (нужны Anchor/Agave/Rust 1.89.0 из CLAUDE.md и настоящие keypair'ы программ):
 *
 *   node scripts/bench-sbf-profiles.mjs plan                      # что будет собрано, ничего не запуская
 *   node scripts/bench-sbf-profiles.mjs run --matrix coarse       # 10 сборок (по умолчанию)
 *   node scripts/bench-sbf-profiles.mjs run --matrix full         # 4×3×2×2 = 48 сборок
 *   node scripts/bench-sbf-profiles.mjs run --with-cu             # ещё и `anchor test --skip-build` на каждой ячейке
 *   node scripts/bench-sbf-profiles.mjs run --rpc <devnet-url>    # + стоимость rent по живому RPC (только чтение)
 *   node scripts/bench-sbf-profiles.mjs report <results.json>     # пересчитать отчёт и выбор из сохранённых данных
 *
 * Профиль переопределяется через CARGO_PROFILE_RELEASE_* (Cargo применяет их поверх Cargo.toml), поэтому ни один
 * файл репозитория не меняется. `overflow-checks = true` принудительно во ВСЕХ ячейках: ячейку, которая пытается
 * его выключить, харнесс не соберёт.
 *
 * Безопасность:
 *   * keypair'ы программ не читаются, а только проверяется, что файлы есть: `anchor build` при отсутствии
 *     `target/deploy/<имя>-keypair.json` СОЗДАЁТ новый ключ, то есть тихо меняет идентичность программы — без них отказ;
 *   * исходные `target/deploy/*.so` снимаются в <out>/original и возвращаются на место в конце (в том числе при
 *     ошибке и по Ctrl-C): набор, который вы собирались деплоить, остаётся тем же;
 *   * сеть — только если задан --rpc, и только чтение (getMinimumBalanceForRentExemption через оценщик).
 *
 * Выбор профиля (choose): допустимы только ячейки, где собрались все программы, тесты (если запускались) прошли,
 * ни одна инструкция не выше своего порога (150 000 CU; VRF-раскрытия VrfPoolAdd/*Commit/*Reveal — 175 000 CU,
 * они ходят в Metaplex CPI после PR #35) и ни одна не выросла по CU больше чем на 10% относительно baseline; из них —
 * наименьший суммарный размер; если выигрыш меньше 2% — оставить baseline. Решение — по данным, не по ожиданиям.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '..');

export const PROGRAMS = ['aof_core', 'aof_market', 'aof_quests', 'aof_rebirth', 'aof_liquidity', 'aof_session_keys'];
export const CU_THRESHOLD = 150_000;
/**
 * VRF-раскрытия с PR #35 идут через CPI в Metaplex Token Metadata: измеренный
 * максимум 143k–152k (см. измерения в `tests/aof_cu_report.ts`), поэтому для них
 * порог выше. Иначе ячейки бенчмарка отклонялись бы из-за инструкций, которые
 * штатно измеряются на этом уровне.
 */
export const CU_THRESHOLD_VRF = 175_000;
export const VRF_INSTRUCTION = /^(VrfPoolAdd|\w+Commit|\w+Reveal)$/;
export const cuThresholdFor = (name) => (VRF_INSTRUCTION.test(name) ? CU_THRESHOLD_VRF : CU_THRESHOLD);
export const MIN_GAIN_PERCENT = 2;
export const CU_REGRESSION_PERCENT = 10;

// ---------------------------------------------------------------- ячейки матрицы
/** Ячейка: undefined у поля = «как сейчас» (параметр профиля не переопределяется). */
export function cell(name, { optLevel, lto, codegenUnits, strip } = {}) {
  return { name, optLevel, lto, codegenUnits, strip };
}

/** CARGO_PROFILE_RELEASE_* для ячейки. overflow-checks = true — всегда; выключить его нельзя. */
export function cellEnv(spec) {
  if (spec.overflowChecks === false) throw new Error(`ячейка ${spec.name}: overflow-checks = false запрещено (CLAUDE.md, readiness #115)`);
  const env = { CARGO_PROFILE_RELEASE_OVERFLOW_CHECKS: 'true' };
  if (spec.optLevel !== undefined) env.CARGO_PROFILE_RELEASE_OPT_LEVEL = String(spec.optLevel);
  if (spec.lto !== undefined) env.CARGO_PROFILE_RELEASE_LTO = String(spec.lto);
  if (spec.codegenUnits !== undefined) env.CARGO_PROFILE_RELEASE_CODEGEN_UNITS = String(spec.codegenUnits);
  if (spec.strip !== undefined) env.CARGO_PROFILE_RELEASE_STRIP = String(spec.strip);
  return env;
}

/** Блок `[profile.release]` для ячейки — только для показа; харнесс сам его никуда не пишет. */
export function profileBlock(spec) {
  const lines = ['[profile.release]', 'overflow-checks = true'];
  if (spec.optLevel !== undefined) lines.push(/^\d$/.test(String(spec.optLevel)) ? `opt-level = ${spec.optLevel}` : `opt-level = "${spec.optLevel}"`);
  if (spec.lto !== undefined) lines.push(spec.lto === 'fat' || spec.lto === 'thin' ? `lto = "${spec.lto}"` : `lto = ${spec.lto}`);
  if (spec.codegenUnits !== undefined) lines.push(`codegen-units = ${spec.codegenUnits}`);
  if (spec.strip !== undefined) lines.push(`strip = ${spec.strip === 'true' || spec.strip === 'false' ? spec.strip : `"${spec.strip}"`}`);
  return lines.join('\n');
}

const COARSE = [
  cell('baseline'),                                                                  // как сейчас
  cell('o3', { optLevel: 3 }),                                                       // обязан совпасть с baseline, если умолчание тулчейна — 3
  cell('o3-cgu1', { optLevel: 3, codegenUnits: 1 }),
  cell('os', { optLevel: 's' }),
  cell('os-cgu1', { optLevel: 's', codegenUnits: 1 }),
  cell('oz', { optLevel: 'z' }),
  cell('oz-cgu1', { optLevel: 'z', codegenUnits: 1 }),
  cell('os-cgu1-lto-fat', { optLevel: 's', codegenUnits: 1, lto: 'fat' }),           // fat LTO на SBF не предполагается рабочим
  cell('oz-cgu1-lto-fat', { optLevel: 'z', codegenUnits: 1, lto: 'fat' }),
  cell('os-cgu1-strip', { optLevel: 's', codegenUnits: 1, strip: 'symbols' }),
];

export function fullMatrix() {
  const out = [];
  for (const optLevel of [undefined, 3, 's', 'z']) {
    for (const lto of [undefined, 'thin', 'fat']) {
      for (const codegenUnits of [undefined, 1]) {
        for (const strip of [undefined, 'symbols']) {
          const name = [optLevel === undefined ? 'dflt' : `o${optLevel}`, lto ? `lto-${lto}` : 'nolto', codegenUnits ? 'cgu1' : 'cgudflt', strip ? 'strip' : 'nostrip'].join('-');
          out.push(cell(optLevel === undefined && !lto && !codegenUnits && !strip ? 'baseline' : name, { optLevel, lto, codegenUnits, strip }));
        }
      }
    }
  }
  return out;
}

export function selectCells(matrix = 'coarse', names) {
  const all = matrix === 'full' ? fullMatrix() : COARSE;
  if (!names || names.length === 0) return all;
  const known = new Map(fullMatrix().concat(COARSE).map((c) => [c.name, c]));
  return names.map((n) => { if (!known.has(n)) throw new Error(`неизвестная ячейка '${n}'`); return known.get(n); });
}

// ---------------------------------------------------------------- файлы
export const sha256File = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

/** keypair'ы программ: только наличие файла, содержимое не читается. */
export function missingKeypairs(deployDir) {
  return PROGRAMS.filter((name) => !fs.existsSync(path.join(deployDir, `${name}-keypair.json`)));
}

export function snapshot(deployDir, outDir) {
  const dir = path.join(outDir, 'original');
  fs.mkdirSync(dir, { recursive: true });
  const saved = {};
  for (const name of PROGRAMS) {
    const so = path.join(deployDir, `${name}.so`);
    if (fs.existsSync(so)) {
      fs.copyFileSync(so, path.join(dir, `${name}.so`));
      saved[name] = sha256File(so);
    }
  }
  return saved;
}

/** Возвращает исходные .so; если исходного не было — убирает артефакт бенчмарка. Возвращает расхождения (должно быть пусто). */
export function restore(deployDir, outDir, saved) {
  const problems = [];
  for (const name of PROGRAMS) {
    const so = path.join(deployDir, `${name}.so`);
    const original = path.join(outDir, 'original', `${name}.so`);
    if (saved[name]) fs.copyFileSync(original, so);
    else fs.rmSync(so, { force: true });
    const now = fs.existsSync(so) ? sha256File(so) : undefined;
    if (now !== saved[name]) problems.push(name);
  }
  return problems;
}

// ---------------------------------------------------------------- CU-отчёт
export function parseCuReport(markdown) {
  const rows = {};
  for (const line of markdown.split('\n')) {
    const m = /^\|\s*([A-Z][A-Za-z0-9]*)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|/.exec(line);
    if (m) rows[m[1]] = { calls: Number(m[2]), maxCu: Number(m[3]), medianCu: Number(m[4]) };
  }
  return rows;
}

// ---------------------------------------------------------------- прогон
/**
 * runner: { build(cell, env) -> {ok, seconds, log}, cuTest?(cell, env) -> {ok, reportPath?, log} }.
 * Подменяется в тестах; настоящий — realRunner().
 */
export async function runMatrix({ cells, deployDir, outDir, runner, withCu = false, log = () => {} }) {
  const missing = missingKeypairs(deployDir);
  if (missing.length) {
    throw new Error(`нет keypair'ов программ (${missing.join(', ')}) в ${deployDir}: anchor build создал бы НОВЫЕ ключи и тихо поменял идентичность программ. `
      + 'Положите свои target/deploy/*-keypair.json на место (в чат их присылать нельзя) и повторите.');
  }
  fs.mkdirSync(outDir, { recursive: true });
  const saved = snapshot(deployDir, outDir);
  const results = [];
  let restored = false;
  const finish = () => { if (!restored) { restored = true; return restore(deployDir, outDir, saved); } return []; };
  const onSignal = () => { const bad = finish(); log(`прервано: исходные .so возвращены${bad.length ? ` (расхождения: ${bad.join(', ')})` : ''}`); process.exit(130); };
  process.once('SIGINT', onSignal);
  try {
    for (const spec of cells) {
      const env = cellEnv(spec);
      log(`ячейка ${spec.name}: сборка`);
      const built = await runner.build(spec, env);
      const entry = { name: spec.name, spec: { optLevel: spec.optLevel, lto: spec.lto, codegenUnits: spec.codegenUnits, strip: spec.strip },
        env, ok: Boolean(built.ok), buildSeconds: built.seconds ?? null, programs: {}, totalBytes: null, cu: null, testsPassed: null, error: null };
      if (!built.ok) {
        entry.error = String(built.log || 'сборка не удалась').split('\n').slice(-12).join('\n');
        results.push(entry);
        continue;
      }
      const cellDir = path.join(outDir, spec.name);
      fs.mkdirSync(cellDir, { recursive: true });
      let complete = true;
      for (const name of PROGRAMS) {
        const so = path.join(deployDir, `${name}.so`);
        if (!fs.existsSync(so)) { complete = false; entry.error = `после сборки нет ${name}.so`; break; }
        fs.copyFileSync(so, path.join(cellDir, `${name}.so`));
        entry.programs[name] = { bytes: fs.statSync(so).size, sha256: sha256File(so) };
      }
      if (!complete) { entry.ok = false; results.push(entry); continue; }
      entry.totalBytes = PROGRAMS.reduce((n, name) => n + entry.programs[name].bytes, 0);
      if (withCu && runner.cuTest) {
        log(`ячейка ${spec.name}: тесты и замер CU`);
        const tested = await runner.cuTest(spec, env);
        entry.testsPassed = Boolean(tested.ok);
        if (tested.reportPath && fs.existsSync(tested.reportPath)) {
          fs.copyFileSync(tested.reportPath, path.join(cellDir, 'cu-report.md'));
          entry.cu = parseCuReport(fs.readFileSync(tested.reportPath, 'utf8'));
        }
        if (!tested.ok) entry.error = String(tested.log || 'тесты не прошли').split('\n').slice(-12).join('\n');
      }
      results.push(entry);
    }
  } finally {
    process.removeListener('SIGINT', onSignal);
    const bad = finish();
    if (bad.length) log(`ВНИМАНИЕ: исходные .so не удалось вернуть побайтно: ${bad.join(', ')} (копии лежат в ${path.join(outDir, 'original')})`);
  }
  const identical = overridesIgnored(results);
  return { results, originalHashes: saved, overridesIgnored: identical };
}

/** Если профили разные, а все собранные наборы побайтно одинаковы — переопределения не сработали (тулчейн их игнорирует). */
export function overridesIgnored(results) {
  const built = results.filter((r) => r.ok);
  const distinctSpecs = new Set(built.map((r) => JSON.stringify(r.spec)));
  if (built.length < 2 || distinctSpecs.size < 2) return false;
  const sets = new Set(built.map((r) => PROGRAMS.map((n) => r.programs[n].sha256).join(':')));
  return sets.size === 1;
}

// ---------------------------------------------------------------- сводка и выбор
export function summarize(run, { baselineName = 'baseline' } = {}) {
  const results = run.results;
  const base = results.find((r) => r.name === baselineName && r.ok) || null;
  const rows = results.map((r) => {
    const row = { name: r.name, ok: r.ok, spec: r.spec, buildSeconds: r.buildSeconds, totalBytes: r.totalBytes, error: r.error, testsPassed: r.testsPassed,
      programs: r.programs, deltaBytes: null, deltaPercent: null, maxCu: null, overThreshold: [], cuRegressions: [], profile: profileBlock({ name: r.name, ...r.spec }) };
    if (r.ok && base) {
      row.deltaBytes = r.totalBytes - base.totalBytes;
      row.deltaPercent = Number(((100 * (r.totalBytes - base.totalBytes)) / base.totalBytes).toFixed(2));
    }
    if (r.cu) {
      const entries = Object.entries(r.cu);
      row.maxCu = entries.length ? Math.max(...entries.map(([, v]) => v.maxCu)) : null;
      row.overThreshold = entries.filter(([k, v]) => v.maxCu > cuThresholdFor(k)).map(([k, v]) => `${k}: ${v.maxCu} > ${cuThresholdFor(k)}`);
      if (base?.cu) {
        for (const [name, v] of entries) {
          const was = base.cu[name]?.maxCu;
          if (was && v.maxCu > was * (1 + CU_REGRESSION_PERCENT / 100)) row.cuRegressions.push(`${name}: ${was} → ${v.maxCu}`);
        }
      }
    }
    return row;
  });
  return { baseline: base ? base.name : null, rows, overridesIgnored: Boolean(run.overridesIgnored), originalHashes: run.originalHashes || {} };
}

/** Чистая функция выбора: см. шапку файла. Возвращает { choice, reason, rejected }. */
export function choose(summary, { minGainPercent = MIN_GAIN_PERCENT } = {}) {
  if (summary.overridesIgnored) return { choice: null, reason: 'переопределения профиля не подействовали (все наборы .so побайтно одинаковы): выбирать не из чего, проверьте, что cargo build-sbf читает CARGO_PROFILE_RELEASE_*', rejected: [] };
  if (!summary.baseline) return { choice: null, reason: 'baseline не собрался — сравнивать не с чем', rejected: summary.rows.map((r) => ({ name: r.name, why: r.error ? 'не собрался' : 'нет baseline' })) };
  const rejected = [];
  const eligible = [];
  for (const row of summary.rows) {
    if (!row.ok) { rejected.push({ name: row.name, why: 'сборка не удалась или программ не хватает (профиль не поддержан тулчейном?)' }); continue; }
    if (row.testsPassed === false) { rejected.push({ name: row.name, why: 'тесты не прошли' }); continue; }
    if (row.overThreshold.length) { rejected.push({ name: row.name, why: `CU выше порога: ${row.overThreshold.join(', ')}` }); continue; }
    if (row.cuRegressions.length) { rejected.push({ name: row.name, why: `CU вырос больше чем на ${CU_REGRESSION_PERCENT}%: ${row.cuRegressions.join(', ')}` }); continue; }
    eligible.push(row);
  }
  const complexity = (row) => ['optLevel', 'lto', 'codegenUnits', 'strip'].filter((k) => row.spec[k] !== undefined).length;
  eligible.sort((a, b) => a.totalBytes - b.totalBytes || (a.maxCu ?? 0) - (b.maxCu ?? 0) || complexity(a) - complexity(b) || a.name.localeCompare(b.name));
  const best = eligible[0];
  const base = summary.rows.find((r) => r.name === summary.baseline);
  if (!best || best.name === summary.baseline) return { choice: summary.baseline, reason: 'ни одна допустимая ячейка не меньше baseline', rejected };
  const gain = (100 * (base.totalBytes - best.totalBytes)) / base.totalBytes;
  if (gain < minGainPercent) return { choice: summary.baseline, reason: `лучшая ячейка ${best.name} даёт ${gain.toFixed(2)}% < ${minGainPercent}%: профиль не меняем`, rejected };
  return { choice: best.name, reason: `${best.name}: −${gain.toFixed(2)}% суммарного размера (${base.totalBytes} → ${best.totalBytes} Б) при допустимых CU`, rejected };
}

const sol = (lamports) => (lamports / 1e9).toFixed(4);
export function toMarkdown(summary, decision, rent = null) {
  const lines = ['# Бенчмарк release-профилей SBF', ''];
  lines.push(`Baseline: \`${summary.baseline ?? 'не собран'}\`. Порог CU: ${CU_THRESHOLD}. \`overflow-checks = true\` во всех ячейках.`);
  if (summary.overridesIgnored) lines.push('', '> **Переопределения профиля не подействовали** — все наборы .so побайтно одинаковы. Результаты недействительны.');
  lines.push('', '| Ячейка | Собрана | Σ байт | Δ байт | Δ % | Сборка, с | Макс. CU | Тесты | Заметка |', '|---|:-:|---:|---:|---:|---:|---:|:-:|---|');
  for (const r of summary.rows) {
    lines.push(`| ${r.name} | ${r.ok ? '✓' : '✗'} | ${r.totalBytes ?? '—'} | ${r.deltaBytes ?? '—'} | ${r.deltaPercent ?? '—'} | ${r.buildSeconds != null ? r.buildSeconds.toFixed(1) : '—'} | ${r.maxCu ?? '—'} | ${r.testsPassed === null ? '—' : r.testsPassed ? '✓' : '✗'} | ${r.ok ? (r.cuRegressions.concat(r.overThreshold).join('; ') || '') : 'не собралась (профиль не поддержан?)'} |`);
  }
  lines.push('', '## По программам (байты)', '', `| Ячейка | ${PROGRAMS.join(' | ')} |`, `|---|${PROGRAMS.map(() => '---:').join('|')}|`);
  for (const r of summary.rows.filter((x) => x.ok)) lines.push(`| ${r.name} | ${PROGRAMS.map((n) => r.programs?.[n]?.bytes ?? '—').join(' | ')} |`);
  if (rent) {
    lines.push('', '## Rent по живому RPC (политика exact, только чтение)', '', '| Ячейка | Заблокировано, SOL | Δ к baseline, SOL |', '|---|---:|---:|');
    const base = rent[summary.baseline];
    for (const [name, lamports] of Object.entries(rent)) lines.push(`| ${name} | ${sol(lamports)} | ${base != null ? sol(lamports - base) : '—'} |`);
  }
  lines.push('', '## Решение', '', decision.choice ? `**${decision.choice}** — ${decision.reason}` : `**не выбрано** — ${decision.reason}`);
  if (decision.rejected.length) {
    lines.push('', 'Отклонены:');
    for (const r of decision.rejected) lines.push(`* ${r.name}: ${r.why}`);
  }
  const chosen = summary.rows.find((r) => r.name === decision.choice);
  if (chosen && chosen.name !== summary.baseline) {
    lines.push('', 'Блок для корневого `Cargo.toml` (применять **вручную после review**; `overflow-checks = true` должен остаться первой строкой — его проверяет readiness-тест #115):', '', '```toml', chosen.profile, '```');
  } else {
    lines.push('', 'Корневой `Cargo.toml` менять не нужно.');
  }
  lines.push('', 'Прежде чем применить профиль: пересобрать, прогнать `anchor test` и `cargo test --workspace --lib`, сверить `target/cu-report.md`, пересчитать стоимость (`scripts/devnet-deploy-estimator.py compare`).');
  return lines.join('\n');
}

// ---------------------------------------------------------------- настоящий runner
export function realRunner({ cwd = ROOT, cuReport = path.join(ROOT, 'target', 'cu-report.md'), logSink = () => {} } = {}) {
  const run = (command, args, env) => new Promise((resolve) => {
    const started = process.hrtime.bigint();
    const child = spawn(command, args, { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let log = '';
    const keep = (chunk) => { log = (log + chunk.toString()).slice(-20_000); logSink(chunk.toString()); };
    child.stdout.on('data', keep);
    child.stderr.on('data', keep);
    child.on('error', (error) => resolve({ ok: false, seconds: 0, log: `${command}: ${error.message}` }));
    child.on('close', (code) => resolve({ ok: code === 0, seconds: Number(process.hrtime.bigint() - started) / 1e9, log }));
  });
  return {
    build: (_cell, env) => run('anchor', ['build', '--no-idl'], env),
    cuTest: async (_cell, env) => {
      fs.rmSync(cuReport, { force: true });
      const result = await run('anchor', ['test', '--skip-build'], env);
      return { ok: result.ok, log: result.log, reportPath: cuReport };
    },
  };
}

function toolsAvailable() {
  const missing = [];
  for (const tool of ['anchor', 'cargo']) if (spawnSync(tool, ['--version'], { stdio: 'ignore' }).status !== 0) missing.push(tool);
  return missing;
}

/** Стоимость rent по живому RPC — только чтение, через оценщик (политика exact). */
export function rentFor(cellDirs, rpc) {
  const rent = {};
  for (const [name, dir] of Object.entries(cellDirs)) {
    const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'watchtower', 'addresses.json'), 'utf8'));
    const args = [path.join(HERE, 'devnet-deploy-estimator.py'), 'plan', '--json', '--policy', 'exact', '--rpc', rpc];
    for (const p of registry.programs) args.push('--program', `${p.name}:${p.address}:${path.join(dir, `${p.name}.so`)}`);
    const done = spawnSync('python3', args, { encoding: 'utf8' });
    if (done.status !== 0 && done.status !== 4) throw new Error(`оценщик не посчитал rent для ${name}: ${done.stderr || done.stdout}`);
    rent[name] = JSON.parse(done.stdout).totals.permanentLamports;
  }
  return rent;
}

// ---------------------------------------------------------------- CLI
function parseArgs(argv) {
  const args = { command: argv[0], matrix: 'coarse', cells: [], withCu: false, out: null, rpc: null, deployDir: path.join(ROOT, 'target', 'deploy'), results: null };
  for (let i = 1; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--matrix') args.matrix = argv[++i];
    else if (a === '--cells') args.cells = argv[++i].split(',').filter(Boolean);
    else if (a === '--with-cu') args.withCu = true;
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--rpc') args.rpc = argv[++i];
    else if (a === '--deploy-dir') args.deployDir = path.resolve(argv[++i]);
    else if (!a.startsWith('--') && !args.results) args.results = a;
    else throw new Error(`неизвестный аргумент ${a}`);
  }
  if (!['coarse', 'full'].includes(args.matrix)) throw new Error("--matrix: coarse | full");
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!['plan', 'run', 'report'].includes(args.command)) {
    console.error('использование: bench-sbf-profiles.mjs plan|run|report [--matrix coarse|full] [--cells a,b] [--with-cu] [--rpc URL] [--out DIR] [--deploy-dir DIR]');
    process.exit(2);
  }
  const cells = selectCells(args.matrix, args.cells);
  if (args.command === 'plan') {
    console.log(`Матрица ${args.matrix}: ${cells.length} сборок × ${PROGRAMS.length} программ. Ничего не запускается; Cargo.toml не меняется.\n`);
    for (const c of cells) console.log(`${c.name.padEnd(22)} ${Object.entries(cellEnv(c)).map(([k, v]) => `${k.replace('CARGO_PROFILE_RELEASE_', '')}=${v}`).join(' ')}`);
    console.log(`\nСборка каждой ячейки: anchor build --no-idl${args.withCu ? '; затем anchor test --skip-build (CU из target/cu-report.md)' : ''}`);
    return;
  }
  if (args.command === 'report') {
    const saved = JSON.parse(fs.readFileSync(args.results, 'utf8'));
    const summary = summarize(saved);
    console.log(toMarkdown(summary, choose(summary), saved.rent || null));
    return;
  }
  const missingTools = toolsAvailable();
  if (missingTools.length) { console.error(`нет инструментов: ${missingTools.join(', ')} — нужны Anchor 0.30.1, Agave 4.2.1 и Rust 1.89.0 (CLAUDE.md). Запускайте на машине владельца.`); process.exit(2); }
  const out = path.resolve(args.out || path.join(ROOT, 'target', 'sbf-profile-bench', new Date().toISOString().replace(/[:.]/g, '-')));
  console.log(`Результаты: ${out}`);
  const run = await runMatrix({ cells, deployDir: args.deployDir, outDir: out, runner: realRunner(), withCu: args.withCu, log: (line) => console.log(line) });
  if (args.rpc) {
    run.rent = rentFor(Object.fromEntries(run.results.filter((r) => r.ok).map((r) => [r.name, path.join(out, r.name)])), args.rpc);
  }
  fs.writeFileSync(path.join(out, 'results.json'), `${JSON.stringify(run, null, 2)}\n`);
  const summary = summarize(run);
  const markdown = toMarkdown(summary, choose(summary), run.rent || null);
  fs.writeFileSync(path.join(out, 'report.md'), `${markdown}\n`);
  console.log(`\n${markdown}`);
  if (run.overridesIgnored) process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(`ОТКАЗ: ${error.message}`); process.exit(2); });
}
export const moduleUrl = pathToFileURL(fileURLToPath(import.meta.url)).href;
