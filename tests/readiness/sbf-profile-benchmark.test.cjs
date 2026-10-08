'use strict';
/*
 * Харнесс бенчмарка SBF-профилей (scripts/bench-sbf-profiles.mjs).
 *
 * Настоящий тулчейн (Anchor/Agave/Rust) в CI и в песочнице агента недоступен, поэтому здесь проверяется всё,
 * что вокруг сборки и что можно сломать молча: ячейки и их env, принудительный overflow-checks, оркестрация с
 * подменённым runner'ом, хеши и размеры, возврат исходных .so, отказ без keypair'ов (anchor build создал бы новые),
 * детектор «переопределения профиля проигнорированы» и сама чистая функция выбора профиля — на синтетических
 * данных, включая отказ от ячеек с CU выше 150 000 или с ростом CU больше 10%. Сама сборка — на машине владельца.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '../..');
const scriptPath = path.join(root, 'scripts/bench-sbf-profiles.mjs');
const load = () => import(pathToFileURL(scriptPath).href);
const sha = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
const PROGRAMS = ['aof_core', 'aof_market', 'aof_quests', 'aof_rebirth', 'aof_liquidity', 'aof_session_keys'];
const BASE_SIZES = { aof_core: 2_500_000, aof_market: 440_000, aof_quests: 620_000, aof_rebirth: 290_000, aof_liquidity: 350_000, aof_session_keys: 290_000 };

function makeDeployDir(withKeypairs = true) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aof-bench-'));
  const deploy = path.join(tmp, 'deploy');
  fs.mkdirSync(deploy);
  for (const name of PROGRAMS) {
    fs.writeFileSync(path.join(deploy, `${name}.so`), Buffer.alloc(1000, name.length)); // «исходный» набор владельца
    if (withKeypairs) fs.writeFileSync(path.join(deploy, `${name}-keypair.json`), `NOT-A-REAL-KEY-${name}`);
  }
  return { tmp, deploy, out: path.join(tmp, 'out') };
}

/** Поддельный тулчейн: размер зависит от env профиля; никакого cargo. */
function fakeRunner(deploy, { failOn = [], same = false, calls = [] } = {}) {
  return {
    build: async (spec, env) => {
      calls.push(spec.name);
      if (failOn.includes(spec.name)) return { ok: false, seconds: 0.1, log: 'error: unsupported LTO mode for target sbf\nfailed' };
      let factor = 1;
      if (!same) {
        if (env.CARGO_PROFILE_RELEASE_OPT_LEVEL === 's') factor *= 0.85;
        if (env.CARGO_PROFILE_RELEASE_OPT_LEVEL === 'z') factor *= 0.78;
        if (env.CARGO_PROFILE_RELEASE_CODEGEN_UNITS === '1') factor *= 0.97;
        if (env.CARGO_PROFILE_RELEASE_LTO === 'fat') factor *= 0.9;
        if (env.CARGO_PROFILE_RELEASE_STRIP === 'symbols') factor *= 0.95;
      }
      for (const [name, bytes] of Object.entries(BASE_SIZES)) {
        const size = Math.round(bytes * factor / 1000) * 1000;
        fs.writeFileSync(path.join(deploy, `${name}.so`), Buffer.alloc(size, Math.round(factor * 100) % 256));
      }
      return { ok: true, seconds: 12.5, log: '' };
    },
  };
}

test('каждая ячейка собирается с overflow-checks = true; выключить его нельзя', async () => {
  const bench = await load();
  const names = new Set();
  for (const matrix of ['coarse', 'full']) {
    for (const spec of bench.selectCells(matrix)) {
      assert.equal(bench.cellEnv(spec).CARGO_PROFILE_RELEASE_OVERFLOW_CHECKS, 'true', `${matrix}/${spec.name}`);
      assert.match(bench.profileBlock(spec), /^\[profile\.release\]\noverflow-checks = true/, `${spec.name}: блок профиля потерял overflow-checks (readiness #115)`);
    }
  }
  assert.throws(() => bench.cellEnv({ name: 'evil', overflowChecks: false }), /overflow-checks = false запрещено/);
  const full = bench.fullMatrix();
  for (const spec of full) names.add(spec.name);
  assert.equal(full.length, 48, '4 opt-level × 3 LTO × 2 codegen-units × 2 strip');
  assert.equal(names.size, 48, 'имена ячеек уникальны');
  assert.equal(full.filter((c) => c.name === 'baseline').length, 1);
  const coarse = bench.selectCells('coarse').map((c) => c.name);
  for (const required of ['baseline', 'o3', 'os', 'oz', 'os-cgu1-lto-fat']) assert.ok(coarse.includes(required), `в coarse нет ${required}`);
  assert.throws(() => bench.selectCells('coarse', ['no-such-cell']), /неизвестная ячейка/);
});

test('opt-level: «текущий» (не переопределён) и явная «3» — разные ячейки, чтобы совпадение хешей было проверкой, а не допущением', async () => {
  const bench = await load();
  const env = (name) => bench.cellEnv(bench.selectCells('coarse', [name])[0]);
  assert.equal(env('baseline').CARGO_PROFILE_RELEASE_OPT_LEVEL, undefined);
  assert.equal(env('o3').CARGO_PROFILE_RELEASE_OPT_LEVEL, '3');
  assert.equal(env('oz').CARGO_PROFILE_RELEASE_OPT_LEVEL, 'z');
  assert.equal(env('os-cgu1-lto-fat').CARGO_PROFILE_RELEASE_LTO, 'fat');
});

test('прогон: размеры и SHA-256 сходятся с независимым подсчётом, исходные .so возвращены, ключи не тронуты', async () => {
  const bench = await load();
  const { tmp, deploy, out } = makeDeployDir();
  try {
    const originals = Object.fromEntries(PROGRAMS.map((n) => [n, sha(fs.readFileSync(path.join(deploy, `${n}.so`)))]));
    const keyStats = Object.fromEntries(PROGRAMS.map((n) => { const f = path.join(deploy, `${n}-keypair.json`); return [n, [fs.readFileSync(f, 'utf8'), fs.statSync(f).mtimeMs]]; }));
    const calls = [];
    const run = await bench.runMatrix({ cells: bench.selectCells('coarse'), deployDir: deploy, outDir: out, runner: fakeRunner(deploy, { calls }) });
    assert.equal(run.results.length, 10);
    assert.deepEqual(calls, bench.selectCells('coarse').map((c) => c.name), 'ячейки собираются по порядку');
    for (const result of run.results) {
      assert.ok(result.ok, result.name);
      for (const name of PROGRAMS) {
        const copy = fs.readFileSync(path.join(out, result.name, `${name}.so`));
        assert.equal(result.programs[name].bytes, copy.length);
        assert.equal(result.programs[name].sha256, sha(copy), `${result.name}/${name}: sha256`);
      }
      assert.equal(result.totalBytes, PROGRAMS.reduce((n, name) => n + result.programs[name].bytes, 0));
      assert.equal(result.buildSeconds, 12.5);
      assert.equal(result.env.CARGO_PROFILE_RELEASE_OVERFLOW_CHECKS, 'true');
    }
    // исходные .so владельца вернулись побайтно; keypair'ы не читались и не менялись
    for (const name of PROGRAMS) {
      assert.equal(sha(fs.readFileSync(path.join(deploy, `${name}.so`))), originals[name], `${name}.so не восстановлен`);
      const f = path.join(deploy, `${name}-keypair.json`);
      assert.equal(fs.readFileSync(f, 'utf8'), keyStats[name][0]);
      assert.equal(fs.statSync(f).mtimeMs, keyStats[name][1], `${name}-keypair.json менялся`);
    }
    assert.deepEqual(run.originalHashes, originals);
    assert.equal(run.overridesIgnored, false);
    // профили действительно различаются: sha256 набора у baseline и oz разный
    const byName = Object.fromEntries(run.results.map((r) => [r.name, r]));
    assert.notEqual(byName.baseline.programs.aof_core.sha256, byName.oz.programs.aof_core.sha256);
    assert.ok(byName.oz.totalBytes < byName.os.totalBytes && byName.os.totalBytes < byName.baseline.totalBytes, 'в этой модели z < s < baseline: проверка порядка, а не вывод о реальном тулчейне');
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('без keypair\'ов программ харнесс отказывает ДО первой сборки (anchor build создал бы новые ключи)', async () => {
  const bench = await load();
  const { tmp, deploy, out } = makeDeployDir(false);
  try {
    const calls = [];
    await assert.rejects(bench.runMatrix({ cells: bench.selectCells('coarse'), deployDir: deploy, outDir: out, runner: fakeRunner(deploy, { calls }) }),
      /нет keypair'ов программ.*создал бы НОВЫЕ ключи/);
    assert.deepEqual(calls, [], 'ни одной сборки');
    assert.deepEqual(fs.readdirSync(deploy).filter((f) => f.endsWith('-keypair.json')), [], 'и ни одного созданного ключа');
    assert.ok(!fs.existsSync(out), 'и ничего не записано в каталог результатов');
    // неполный набор: один ключ пропал
    fs.writeFileSync(path.join(deploy, 'aof_core-keypair.json'), 'x');
    assert.deepEqual(bench.missingKeypairs(deploy), PROGRAMS.filter((n) => n !== 'aof_core'));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('сборка не удалась — ячейка помечена и исключена, остальные собираются; исходные .so всё равно возвращены', async () => {
  const bench = await load();
  const { tmp, deploy, out } = makeDeployDir();
  try {
    const originals = PROGRAMS.map((n) => sha(fs.readFileSync(path.join(deploy, `${n}.so`))));
    const run = await bench.runMatrix({ cells: bench.selectCells('coarse'), deployDir: deploy, outDir: out, runner: fakeRunner(deploy, { failOn: ['os-cgu1-lto-fat', 'oz-cgu1-lto-fat'] }) });
    const failed = run.results.filter((r) => !r.ok).map((r) => r.name);
    assert.deepEqual(failed, ['os-cgu1-lto-fat', 'oz-cgu1-lto-fat']);
    assert.match(run.results.find((r) => r.name === 'oz-cgu1-lto-fat').error, /unsupported LTO mode/);
    assert.equal(run.results.filter((r) => r.ok).length, 8);
    const summary = bench.summarize(run);
    const decision = bench.choose(summary);
    assert.ok(decision.rejected.some((r) => r.name === 'oz-cgu1-lto-fat' && /не поддержан/.test(r.why)));
    assert.notEqual(decision.choice, 'oz-cgu1-lto-fat');
    assert.deepEqual(PROGRAMS.map((n) => sha(fs.readFileSync(path.join(deploy, `${n}.so`)))), originals);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('если профили разные, а все наборы .so одинаковы, переопределения не подействовали — выбирать нельзя', async () => {
  const bench = await load();
  const { tmp, deploy, out } = makeDeployDir();
  try {
    const run = await bench.runMatrix({ cells: bench.selectCells('coarse', ['baseline', 'os', 'oz']), deployDir: deploy, outDir: out, runner: fakeRunner(deploy, { same: true }) });
    assert.equal(run.overridesIgnored, true);
    const decision = bench.choose(bench.summarize(run));
    assert.equal(decision.choice, null);
    assert.match(decision.reason, /не подействовали/);
    // одна ячейка — сравнивать не с чем, но и ложной тревоги нет
    const one = await bench.runMatrix({ cells: bench.selectCells('coarse', ['baseline']), deployDir: deploy, outDir: path.join(tmp, 'out2'), runner: fakeRunner(deploy, { same: true }) });
    assert.equal(one.overridesIgnored, false);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

function syntheticRun(rows) {
  const spec = (s) => s;
  return {
    overridesIgnored: false,
    originalHashes: {},
    results: rows.map((r) => ({ name: r.name, spec: spec(r.spec || {}), env: {}, ok: r.ok !== false, buildSeconds: 10, totalBytes: r.bytes, programs: {}, cu: r.cu || null, testsPassed: r.tests ?? null, error: r.ok === false ? 'boom' : null })),
  };
}

test('выбор профиля: наименьший допустимый; CU выше порога и рост CU > 10% отклоняют ячейку', async () => {
  const bench = await load();
  const cu = (max) => ({ MintTool: { calls: 1, maxCu: max, medianCu: max }, Craft: { calls: 1, maxCu: 90_000, medianCu: 90_000 } });
  // VRF-раскрытия ходят в Metaplex CPI (PR #35) и штатно измеряются в 143k–152k:
  // их порог — 175 000, поэтому ячейку они не отклоняют.
  const vrf = { RerollRandomReveal: { calls: 1, maxCu: 152_000, medianCu: 152_000 } };
  const summary = bench.summarize(syntheticRun([
    { name: 'baseline', bytes: 5_000_000, cu: cu(40_000) },
    { name: 'oz', bytes: 3_800_000, cu: { ...cu(40_500), ...vrf } },       // самый маленький и допустимый
    { name: 'oz-small-but-slow', bytes: 3_500_000, cu: cu(60_000) },       // +50% CU
    { name: 'oz-over', bytes: 3_400_000, cu: { MintTool: { calls: 1, maxCu: 151_000, medianCu: 1 } } }, // выше порога
    { name: 'os', bytes: 4_100_000, cu: cu(40_200) },
  ]));
  const decision = bench.choose(summary);
  assert.equal(decision.choice, 'oz');
  assert.match(decision.reason, /−24\.00%/);
  assert.ok(decision.rejected.find((r) => r.name === 'oz-small-but-slow' && /вырос больше чем на 10%/.test(r.why)));
  assert.ok(decision.rejected.find((r) => r.name === 'oz-over' && /CU выше порога: MintTool: 151000 > 150000/.test(r.why)));
  assert.equal(summary.rows.find((r) => r.name === 'oz-over').overThreshold.length, 1);
  assert.equal(summary.rows.find((r) => r.name === 'oz').overThreshold.length, 0, 'VRF-раскрытие 152 000 CU ниже своего порога 175 000');
});

test('выбор профиля: VRF-инструкция выше 175 000 CU отклоняет ячейку', async () => {
  const bench = await load();
  const mint = { MintTool: { calls: 1, maxCu: 40_000, medianCu: 40_000 } };
  const summary = bench.summarize(syntheticRun([
    { name: 'baseline', bytes: 5_000_000, cu: mint },
    { name: 'oz', bytes: 3_800_000, cu: { ...mint, RerollRandomReveal: { calls: 1, maxCu: 180_000, medianCu: 180_000 } } },
  ]));
  const decision = bench.choose(summary);
  assert.equal(decision.choice, 'baseline');
  assert.ok(decision.rejected.find((r) => r.name === 'oz' && /CU выше порога: RerollRandomReveal: 180000 > 175000/.test(r.why)));
});

test('выбор профиля: выигрыш меньше 2% — baseline остаётся; провалившиеся тесты и сломанный baseline учитываются', async () => {
  const bench = await load();
  let decision = bench.choose(bench.summarize(syntheticRun([{ name: 'baseline', bytes: 1_000_000 }, { name: 'os', bytes: 990_000 }])));
  assert.equal(decision.choice, 'baseline');
  assert.match(decision.reason, /1\.00% < 2%/);
  decision = bench.choose(bench.summarize(syntheticRun([{ name: 'baseline', bytes: 1_000_000 }, { name: 'oz', bytes: 700_000, tests: false }, { name: 'os', bytes: 900_000, tests: true }])));
  assert.equal(decision.choice, 'os');
  assert.ok(decision.rejected.find((r) => r.name === 'oz' && /тесты не прошли/.test(r.why)));
  decision = bench.choose(bench.summarize(syntheticRun([{ name: 'baseline', ok: false, bytes: null }, { name: 'os', bytes: 900_000 }])));
  assert.equal(decision.choice, null);
  assert.match(decision.reason, /baseline не собрался/);
  decision = bench.choose(bench.summarize(syntheticRun([{ name: 'baseline', bytes: 1_000_000 }, { name: 'huge', bytes: 1_200_000 }])));
  assert.equal(decision.choice, 'baseline');
});

test('при равных размерах выбирается простой профиль и порядок детерминирован', async () => {
  const bench = await load();
  const rows = [
    { name: 'baseline', bytes: 1_000_000 },
    { name: 'oz-cgu1-strip', bytes: 800_000, spec: { optLevel: 'z', codegenUnits: 1, strip: 'symbols' } },
    { name: 'oz', bytes: 800_000, spec: { optLevel: 'z' } },
  ];
  const a = bench.choose(bench.summarize(syntheticRun(rows)));
  const b = bench.choose(bench.summarize(syntheticRun([...rows].reverse().sort((x, y) => (x.name === 'baseline' ? -1 : 1)))));
  assert.equal(a.choice, 'oz');
  assert.equal(b.choice, 'oz');
});

test('отчёт показывает блок профиля с overflow-checks первой строкой и не пишет его в Cargo.toml', async () => {
  const bench = await load();
  const summary = bench.summarize(syntheticRun([{ name: 'baseline', bytes: 1_000_000 }, { name: 'oz', bytes: 700_000, spec: { optLevel: 'z', codegenUnits: 1 } }]));
  const markdown = bench.toMarkdown(summary, bench.choose(summary));
  assert.match(markdown, /```toml\n\[profile\.release\]\noverflow-checks = true\nopt-level = "z"\ncodegen-units = 1\n```/);
  assert.match(markdown, /вручную после review/);
  const source = fs.readFileSync(scriptPath, 'utf8');
  assert.doesNotMatch(source.replace(/\/\*[\s\S]*?\*\//g, ''), /writeFileSync\([^)]*Cargo\.toml/, 'харнесс не должен писать Cargo.toml');
  const manifest = fs.readFileSync(path.join(root, 'Cargo.toml'), 'utf8');
  assert.match(manifest, /\[profile\.release\]\s*\noverflow-checks = true/);
  assert.doesNotMatch(manifest, /opt-level|lto\s*=|codegen-units|strip\s*=/, 'профиль в Cargo.toml менять нельзя, пока нет измерений');
});

test('разбор CU-отчёта и режим report из сохранённых данных', async () => {
  const bench = await load();
  const rows = bench.parseCuReport(['| Instruction | Calls | Max CU | Median CU | Max, % of 200k |', '|---|---:|---:|---:|---:|', '| MintTool | 4 | 41000 | 38000 | 20.5% |', '| Craft | 2 | 91000 | 90000 | 45.5% |'].join('\n'));
  assert.deepEqual(rows, { MintTool: { calls: 4, maxCu: 41000, medianCu: 38000 }, Craft: { calls: 2, maxCu: 91000, medianCu: 90000 } });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aof-report-'));
  try {
    const saved = syntheticRun([{ name: 'baseline', bytes: 1_000_000 }, { name: 'oz', bytes: 700_000, spec: { optLevel: 'z' } }]);
    saved.results.forEach((r) => { r.programs = Object.fromEntries(PROGRAMS.map((n) => [n, { bytes: 1, sha256: 'x' }])); });
    fs.writeFileSync(path.join(tmp, 'results.json'), JSON.stringify(saved));
    const out = execFileSync(process.execPath, [scriptPath, 'report', path.join(tmp, 'results.json')], { encoding: 'utf8' });
    assert.match(out, /\*\*oz\*\* — oz: −30\.00%/);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('run без тулчейна честно отказывает, plan ничего не запускает', () => {
  const plan = spawnSync(process.execPath, [scriptPath, 'plan', '--matrix', 'full'], { encoding: 'utf8' });
  assert.equal(plan.status, 0);
  assert.match(plan.stdout, /Матрица full: 48 сборок × 6 программ\. Ничего не запускается; Cargo\.toml не меняется\./);
  const hasToolchain = ['anchor', 'cargo'].every((tool) => spawnSync(tool, ['--version'], { stdio: 'ignore' }).status === 0);
  if (!hasToolchain) {
    const run = spawnSync(process.execPath, [scriptPath, 'run'], { encoding: 'utf8' });
    assert.equal(run.status, 2);
    assert.match(run.stderr, /нет инструментов/);
  }
});

test('rent по живому RPC: харнесс берёт его у оценщика (только чтение), без ставок в коде', async () => {
  const bench = await load();
  const rate = 4321;
  const requests = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const { method, params, id } = JSON.parse(body);
      requests.push(method);
      const results = {
        getGenesisHash: 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG',
        getMinimumBalanceForRentExemption: (128 + params[0]) * rate,
        getLatestBlockhash: { context: { slot: 1 }, value: { blockhash: '4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi', lastValidBlockHeight: 1 } },
        getFeeForMessage: { context: { slot: 1 }, value: 5000 },
      };
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ jsonrpc: '2.0', id, result: results[method] }));
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aof-rent-'));
  try {
    const registry = JSON.parse(fs.readFileSync(path.join(root, 'watchtower/addresses.json'), 'utf8'));
    const dir = path.join(tmp, 'cell');
    fs.mkdirSync(dir);
    const sizes = {};
    registry.programs.forEach((p, i) => { sizes[p.name] = 10_000 + i * 1000; fs.writeFileSync(path.join(dir, `${p.name}.so`), Buffer.alloc(sizes[p.name], 1)); });
    const rent = await new Promise((resolve, reject) => {
      // rentFor синхронно ждёт python, а сервер в этом же процессе — выносим вызов в дочерний процесс
      const { spawn } = require('node:child_process');
      const child = spawn(process.execPath, ['--input-type=module', '-e',
        `import { rentFor } from ${JSON.stringify(pathToFileURL(scriptPath).href)}; console.log(JSON.stringify(rentFor({ cell: ${JSON.stringify(dir)} }, 'http://127.0.0.1:${server.address().port}')));`], { encoding: 'utf8' });
      let out = ''; let err = '';
      child.stdout.on('data', (c) => { out += c; });
      child.stderr.on('data', (c) => { err += c; });
      child.on('close', (code) => (code === 0 ? resolve(JSON.parse(out)) : reject(new Error(err || out))));
    });
    const expected = registry.programs.reduce((sum, p) => sum + (128 + 36) * rate + (128 + 45 + sizes[p.name]) * rate, 0);
    assert.equal(rent.cell, expected, 'rent = Σ (Program + ProgramData по exact) по ответам RPC');
    assert.ok(requests.includes('getMinimumBalanceForRentExemption'));
    assert.ok(requests.every((m) => ['getGenesisHash', 'getMinimumBalanceForRentExemption', 'getLatestBlockhash', 'getFeeForMessage'].includes(m)), `RPC-методы вне чтения: ${requests}`);
  } finally { server.close(); fs.rmSync(tmp, { recursive: true, force: true }); }
});
