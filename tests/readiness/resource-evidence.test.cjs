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

test('репозиторий проходит гейт: 17 active, 7 internal-only, 3 candidate-dead', () => {
  const result = run(['--check']);
  assert.equal(result.code, 0, result.out);
  assert.match(result.out, /27 ресурсов/);
  const statuses = Object.fromEntries(JSON.parse(read(EVIDENCE)).resources.map((r) => {
    const c = r.coverage;
    const clients = c.frontend || c.game;
    if (c.onchainSource) return [r.kind, 'active'];
    if (c.onchainSink) return [r.kind, 'internal-only'];
    return [r.kind, clients ? 'candidate-dead' : 'historical'];
  }));
  const counts = Object.values(statuses).reduce((a, s) => ({ ...a, [s]: (a[s] ?? 0) + 1 }), {});
  assert.deepEqual(counts, { active: 17, 'internal-only': 7, 'candidate-dead': 3 });
  assert.deepEqual(Object.entries(statuses).filter(([, s]) => s === 'candidate-dead').map(([k]) => k).sort(), ['AmberQuartz', 'Compute', 'SoulCore']);
});

test('источники и стоки подтверждены обработчиками, а не декларацией', () => {
  const evidence = JSON.parse(read(EVIDENCE));
  const byKind = new Map(evidence.resources.map((r) => [r.kind, r]));
  const sourceOf = (kind) => byKind.get(kind).onchainSource.map((f) => path.basename(f));
  const sinkOf = (kind) => byKind.get(kind).onchainSink.map((f) => path.basename(f));
  assert.deepEqual(sourceOf('Data'), ['exploration.rs']);
  assert.ok(sourceOf('Circuit').includes('collect_mining.rs'));
  assert.deepEqual(sourceOf('Synapse'), ['harvest_wheat.rs']);
  assert.deepEqual(sourceOf('Model'), ['collect_bread.rs']);
  assert.deepEqual(sourceOf('Power'), ['collect_well_water.rs']);
  assert.ok(sourceOf('QuantumBit').includes('craft_recipe.rs'));
  assert.deepEqual(sinkOf('Mind'), ['craft.rs']);
  for (const kind of ['BlueCore', 'PurpleCore', 'RedCore', 'ClearQuartz', 'RoseQuartz', 'BioChip']) {
    assert.equal(byKind.get(kind).onchainSource.length, 0, `${kind}: не должен иметь источника без обработчика`);
    assert.ok(byKind.get(kind).onchainSink.length > 0, `${kind}: потребляется рецептом`);
  }
  for (const kind of ['Compute', 'AmberQuartz', 'SoulCore']) {
    assert.equal(byKind.get(kind).onchainSource.length + byKind.get(kind).onchainSink.length, 0, `${kind}: цепочки нет вовсе`);
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
