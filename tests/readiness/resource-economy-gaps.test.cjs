'use strict';
/*
 * Экономические разрывы (scripts/resource-economy-gaps.mjs): отдельная ось от статуса ресурса.
 * Решение владельца 2026-10-01, п. 4–5: отсутствие source/sink не понижает player-ресурс,
 * а фиксируется как pre-deployment product blocker. Гейт не даёт «закрыть» разрыв наличием
 * generic admin-минта и не даёт разойтись таблице и evidence.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const script = path.join(root, 'scripts/resource-economy-gaps.mjs');
const GAPS = 'docs/RESOURCE_ECONOMY_GAPS.json';
const GAPS_MD = 'docs/RESOURCE_ECONOMY_GAPS.md';
const EVIDENCE = 'docs/RESOURCE_EVIDENCE.json';
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

function run(args, cwd = root) {
  try {
    const stdout = execFileSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, out: stdout };
  } catch (error) {
    return { code: error.status ?? 1, out: `${error.stdout ?? ''}${error.stderr ?? ''}` };
  }
}

function makeRoot() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aof-gaps-'));
  fs.mkdirSync(path.join(tmp, 'docs'), { recursive: true });
  for (const rel of [GAPS, GAPS_MD, EVIDENCE]) fs.copyFileSync(path.join(root, rel), path.join(tmp, rel));
  return tmp;
}
const withRoot = (fn) => { const tmp = makeRoot(); try { return fn(tmp); } finally { fs.rmSync(tmp, { recursive: true, force: true }); } };

test('репозиторий проходит гейт: разрывы выведены из evidence, а не назначены руками', () => {
  const result = run(['--check']);
  assert.equal(result.code, 0, result.out);
  assert.match(result.out, /без источника 9/);
  assert.match(result.out, /без стока 8/);
  const gaps = JSON.parse(read(GAPS));
  const evidence = JSON.parse(read(EVIDENCE));
  const byKind = new Map(evidence.resources.map((r) => [r.kind, r]));
  for (const row of gaps.resources) {
    assert.equal(row.gap, byKind.get(row.kind).economyIssue, `${row.kind}: разрыв разошёлся с evidence`);
    assert.equal(row.status, byKind.get(row.kind).status, `${row.kind}: статус разошёлся с evidence`);
  }
});

test('разрывы отделены от статуса: Data и BioFluid остаются active-player', () => {
  const gaps = JSON.parse(read(GAPS));
  const byKind = new Map(gaps.resources.map((r) => [r.kind, r]));
  const data = byKind.get('Data');
  assert.equal(data.status, 'active-player');
  assert.equal(data.gap, 'missing_source');
  assert.equal(data.playerHeld, true);
  assert.deepEqual(data.sources, [], 'у Data нет пути получения игроком');
  assert.ok(data.sinks.length > 0, 'Data тратится игроком');
  const fluid = byKind.get('BioFluid');
  assert.equal(fluid.status, 'active-player');
  assert.equal(fluid.gap, 'missing_sink');
  assert.ok(fluid.sources.length > 0, 'BioFluid выпускается рецептом');
  assert.deepEqual(fluid.sinks, [], 'у BioFluid нет стока');
});

test('owner-списки разрывов входят в отчёт без потерь', () => {
  const gaps = JSON.parse(read(GAPS));
  const missingSource = new Set(gaps.blockers.missingSource);
  const missingSink = new Set(gaps.blockers.missingSink);
  for (const kind of ['BioChip', 'BlueCore', 'ClearQuartz', 'Data', 'PurpleCore', 'RedCore', 'RoseQuartz']) {
    assert.ok(missingSource.has(kind), `${kind}: рецепт требует ресурс, источника для игрока нет`);
  }
  for (const kind of ['BioFluid', 'CryoFluid', 'NanoFluid', 'PhotonBit', 'QuantumFluid', 'VoltFluid']) {
    assert.ok(missingSink.has(kind), `${kind}: рецепт выпускает ресурс, стока нет`);
  }
  assert.equal(gaps.renameBlocking, false, 'разрывы не блокируют переименование identifiers');
  assert.match(read(GAPS_MD), /не блокируют чистое переименование/);
  assert.match(read(GAPS_MD), /pre-deployment product blockers/);
});

test('generic admin-минт не закрывает missing_source', () => {
  const gaps = JSON.parse(read(GAPS));
  const data = gaps.resources.find((r) => r.kind === 'Data');
  assert.ok(data.genericPaths.some((p) => /mint_resource\.rs/.test(p)), 'generic admin-путь виден в отчёте');
  assert.equal(data.gap, 'missing_source', 'техническая возможность выпуска не делает ресурс доступным игроку');
});

test('подмена «источника» generic-путём или устаревший markdown роняют гейт', () => {
  withRoot((tmp) => {
    // «Закрываем» разрыв generic-минтом прямо в evidence: гейт обязан увидеть, что это
    // не player source, и не дать разрыву исчезнуть.
    const p = path.join(tmp, EVIDENCE);
    const evidence = JSON.parse(fs.readFileSync(p, 'utf8'));
    const row = evidence.resources.find((r) => r.kind === 'Data');
    row.flow.playerSource = ['aof-core/src/instructions/mint_resource.rs#handler'];
    fs.writeFileSync(p, `${JSON.stringify(evidence, null, 2)}\n`);
    const result = run(['--check', '--root', tmp]);
    assert.equal(result.code, 1, result.out);
    assert.match(result.out, /missing_source, но источники не пусты/);
  });
  withRoot((tmp) => {
    fs.appendFileSync(path.join(tmp, GAPS_MD), '\nустаревшая строка\n');
    const result = run(['--check', '--root', tmp]);
    assert.equal(result.code, 1, result.out);
    assert.match(result.out, /устарел/);
  });
});
