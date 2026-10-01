'use strict';
/*
 * Product evidence по ресурсам (scripts/resource-usage.mjs): статус ресурса обязан опираться на
 * реальные использования в frontend/game/backend/цепочке, а не на факт наличия варианта в enum.
 * Гейт не даёт «протухнуть» evidence и не даёт повысить статус ресурса без источника в цепочке.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const script = path.join(root, 'scripts/resource-usage.mjs');
const EVIDENCE = 'docs/RESOURCE_EVIDENCE.json';
const EVIDENCE_MD = 'docs/RESOURCE_EVIDENCE.md';
const CLIENT_INVENTORY = 'docs/CLIENT_INVENTORY.txt';

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
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aof-evidence-'));
  for (const rel of ['aof-core/src', 'aof_backend/src', 'frontend/src', 'game', 'docs', 'scripts/resource-manifest.mjs']) {
    const from = path.join(root, rel);
    if (!fs.existsSync(from)) continue;
    const to = path.join(tmp, rel);
    fs.cpSync(from, to, { recursive: true, filter: (src) => !/node_modules|\/target(\/|$)/.test(src) });
  }
  return tmp;
}
const editJson = (tmp, rel, fn) => {
  const p = path.join(tmp, rel);
  fs.writeFileSync(p, `${JSON.stringify(fn(JSON.parse(fs.readFileSync(p, 'utf8'))), null, 2)}\n`);
};
const withRoot = (fn) => { const tmp = makeRoot(); try { return fn(tmp); } finally { fs.rmSync(tmp, { recursive: true, force: true }); } };

test('репозиторий проходит гейт: 21 active, 4 internal-only, 2 candidate-dead', () => {
  const result = run(['--check']);
  assert.equal(result.code, 0, result.out);
  assert.match(result.out, /27 ресурсов/);
  const resources = JSON.parse(read(EVIDENCE)).resources;
  const counts = Object.values(resources.reduce((a, r) => ({ ...a, [r.status]: (a[r.status] ?? 0) + 1 }), {}))
    .reduce((a, v) => a, {});
  assert.deepEqual(
    Object.entries(resources.reduce((a, r) => ({ ...a, [r.status]: (a[r.status] ?? 0) + 1 }), {})).sort(),
    [['active', 21], ['candidate-dead', 2], ['internal-only', 4]].sort(),
  );
  const byStatus = (status) => resources.filter((r) => r.status === status).map((r) => r.kind).sort();
  assert.deepEqual(byStatus('candidate-dead'), ['AmberQuartz', 'SoulCore']);
  assert.deepEqual(byStatus('internal-only'), ['Compute', 'Data', 'Dataset', 'Mind']);
  assert.ok(counts);
});

test('источники и стоки подтверждены обработчиками, а не декларацией', () => {
  const evidence = JSON.parse(read(EVIDENCE));
  const byKind = new Map(evidence.resources.map((r) => [r.kind, r]));
  const sourceOf = (kind) => byKind.get(kind).onchainSource.map((s) => path.basename(s.split('#')[0]));
  const sinkOf = (kind) => byKind.get(kind).onchainSink.map((s) => path.basename(s.split('#')[0]));
  assert.ok(sourceOf('Circuit').includes('season.rs'), 'Circuit выдаётся в награде сезона');
  assert.ok(sourceOf('Synapse').includes('harvest_wheat.rs'), 'Synapse — пшеница');
  assert.ok(sourceOf('Model').includes('collect_bread.rs'), 'Model минтается на печи');
  assert.ok(sourceOf('Power').includes('collect_well_water.rs'), 'Power — колодец');
  assert.ok(sourceOf('QuantumBit').includes('craft_recipe.rs'), 'QuantumBit — рецепт 0');
  assert.ok(sinkOf('Silicon').includes('repair.rs'), 'Silicon тратится на ремонт');
  assert.ok(sinkOf('Compute').includes('start_baking.rs'), 'Compute — топливо печи');
  assert.ok(sinkOf('Data').includes('exploration.rs'), 'Data — стоимость трипа');
  for (const kind of ['AmberQuartz', 'SoulCore']) {
    const r = byKind.get(kind);
    assert.equal(r.onchainSource.length + r.onchainSink.length, 0, `${kind}: в коде нет ни выдачи, ни траты`);
    assert.ok(r.frontend.length > 0, `${kind}: при этом присутствует во фронтенд-каталоге`);
  }
});

test('правка статуса на active без источника в цепочке роняет гейт', () => {
  withRoot((tmp) => {
    editJson(tmp, EVIDENCE, (e) => {
      // попытка вручную поднять статус:allowlist'ов у гейта нет — статус выводится из evidence
      e.resources = e.resources.map((r) => (r.kind === 'SoulCore' ? { ...r, status: 'active' } : r));
      return e;
    });
    const result = run(['--check', '--root', tmp]);
    assert.equal(result.code, 1, result.out);
    assert.match(result.out, /SoulCore: статус active, а evidence даёт/);
  });
});

test('новый ресурс без evidence роняет гейт', () => {
  withRoot((tmp) => {
    editJson(tmp, EVIDENCE, (e) => { e.resources = e.resources.filter((r) => r.kind !== 'Mind'); return e; });
    const result = run(['--check', '--root', tmp]);
    assert.equal(result.code, 1, result.out);
    assert.match(result.out, /Mind: нет evidence/);
  });
});

test('устаревший markdown и отсутствие evidence — ошибки', () => {
  withRoot((tmp) => {
    fs.appendFileSync(path.join(tmp, EVIDENCE_MD), '\nустаревшая строка\n');
    const result = run(['--check', '--root', tmp]);
    assert.equal(result.code, 1);
    assert.match(result.out, /устарел/);
  });
  withRoot((tmp) => {
    fs.rmSync(path.join(tmp, EVIDENCE));
    const result = run(['--check', '--root', tmp]);
    assert.equal(result.code, 1);
    assert.match(result.out, /нет docs\/RESOURCE_EVIDENCE\.json/);
  });
});

test('инвентарь клиентов сохранён в репозитории (требование шага A)', () => {
  const inventory = read(CLIENT_INVENTORY);
  for (const needle of ['git ls-files frontend game', 'find frontend -maxdepth 6 -type f | sort', 'find game -maxdepth 8 -type f | sort']) {
    assert.ok(inventory.includes(needle), `в ${CLIENT_INVENTORY} нет команды: ${needle}`);
  }
  assert.ok(inventory.includes('frontend/src/pages/farm'), 'инвентарь должен перечислять реальные файлы frontend');
  assert.ok(inventory.includes('game/godot/products/'), 'инвентарь должен перечислять реальные файлы game');
});
