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

test('репозиторий проходит гейт: 16 active-player, 9 active-internal, 2 candidate-dead, 0 dead', () => {
  const result = run(['--check']);
  assert.equal(result.code, 0, result.out);
  assert.match(result.out, /27 ресурсов/);
  const evidence = JSON.parse(read(EVIDENCE));
  const byStatus = (status) => evidence.resources.filter((r) => r.status === status).map((r) => r.kind).sort();
  assert.equal(byStatus('active-player').length, 16);
  assert.equal(byStatus('active-internal').length, 9);
  assert.equal(byStatus('candidate-dead').length, 2);
  assert.equal(byStatus('dead').length, 0);
  assert.deepEqual(byStatus('candidate-dead'), ['AmberQuartz', 'SoulCore']);
  // Статусы взаимоисключающие и не дублируются: «Data и активен, и internal-only» — ошибка.
  const seen = new Set();
  for (const r of evidence.resources) {
    assert.ok(!seen.has(r.kind), `${r.kind}: дубликат записи`);
    seen.add(r.kind);
    assert.ok(['active-player', 'active-internal', 'candidate-dead', 'dead'].includes(r.status),
      `${r.kind}: статус ${r.status} вне взаимоисключающего набора`);
  }
});

test('источники и стоки подтверждены обработчиками, а не декларацией', () => {
  const evidence = JSON.parse(read(EVIDENCE));
  const byKind = new Map(evidence.resources.map((r) => [r.kind, r]));
  const sourceOf = (kind) => byKind.get(kind).flow.playerSource.map((s) => path.basename(s.split('#')[0]));
  const sinkOf = (kind) => byKind.get(kind).flow.playerSink.map((s) => path.basename(s.split('#')[0]));
  assert.ok(sourceOf('Circuit').includes('season.rs'), 'Circuit выдаётся в награде сезона');
  assert.ok(sourceOf('Circuit').includes('collect_mining.rs'), 'Circuit выбирается таблицей инструментов');
  assert.ok(sourceOf('Synapse').includes('harvest_wheat.rs'), 'Synapse — пшеница');
  assert.ok(sourceOf('Model').includes('collect_bread.rs'), 'Model минтается на печи');
  assert.ok(sourceOf('Power').includes('collect_well_water.rs'), 'Power — колодец');
  assert.ok(sourceOf('Dataset').includes('collect_mining.rs'), 'Dataset даёт инструмент data_harvester');
  assert.ok(sourceOf('QuantumBit').includes('craft_recipe.rs'), 'QuantumBit — рецепт 0');
  assert.ok(sinkOf('Silicon').includes('repair.rs'), 'Silicon тратится на ремонт');
  assert.ok(sinkOf('Compute').includes('start_baking.rs'), 'Compute — топливо печи');
  assert.ok(sinkOf('Data').includes('exploration.rs'), 'Data — стоимость трипа');
  for (const kind of ['AmberQuartz', 'SoulCore']) {
    const r = byKind.get(kind);
    assert.equal(r.flow.playerSource.length + r.flow.playerSink.length, 0, `${kind}: в коде нет ни выдачи, ни траты`);
    assert.ok(r.frontend.length > 0, `${kind}: при этом присутствует во фронтенд-каталоге`);
    assert.ok(r.flow.flags.admin_mintable && r.flow.flags.player_claimable, `${kind}: generic-пути открыты для любого kind`);
  }
});

test('dynamic dispatch посчитан: generic-пути, таблица инструментов и рецепты в evidence', () => {
  const evidence = JSON.parse(read(EVIDENCE));
  const g = evidence.genericPaths;
  assert.ok(g.adminMint.some((e) => e.includes('mint_resource.rs')), 'generic admin-минт обязан быть в evidence');
  assert.ok(g.playerClaim.some((e) => e.includes('mint_resource_once.rs')), 'claim игрока обязан быть в evidence');
  assert.deepEqual(g.miningKinds, ['Circuit', 'Dataset', 'Neuron', 'Silicon'], 'таблица resource_kind_for_tool');
  assert.equal(g.orderbookKinds, 27, 'ордербук принимает все 27 kinds — это не источник');
  assert.equal(g.recipes.length, 8, 'рецептов в craft_recipe.rs — 8');
  assert.deepEqual(evidence.productGaps.craftInputsWithoutPlayerSource.sort(),
    ['BioChip', 'BlueCore', 'ClearQuartz', 'Data', 'PurpleCore', 'RedCore', 'RoseQuartz']);
  assert.deepEqual(evidence.productGaps.craftOutputsNeverConsumed.sort(),
    ['BioFluid', 'CryoFluid', 'NanoFluid', 'PhotonBit', 'QuantumFluid', 'VoltFluid']);
});

test('флаги каждого ресурса согласованы со списками, а статус — с флагами', () => {
  const evidence = JSON.parse(read(EVIDENCE));
  for (const r of evidence.resources) {
    assert.deepEqual(r.flow.flags, {
      has_player_source: r.flow.playerSource.length > 0,
      has_player_sink: r.flow.playerSink.length > 0,
      tradable: r.flow.tradable.length > 0,
      craft_input: r.flow.craftInput.length > 0,
      craft_output: r.flow.craftOutput.length > 0,
      admin_mintable: r.flow.adminMint.length > 0,
      player_claimable: r.flow.playerClaim.length > 0,
      ui_visible: r.frontend.length > 0,
    }, `${r.kind}: флаги разошлись со списками`);
    if (r.status === 'active-player') assert.ok(r.flow.flags.has_player_source, `${r.kind}: active-player без источника`);
    if (r.status === 'candidate-dead') {
      assert.ok(!r.flow.flags.has_player_source && !r.flow.flags.has_player_sink
        && !r.flow.flags.craft_input && !r.flow.flags.craft_output, `${r.kind}: candidate-dead с тратой или источником`);
    }
  }
});

test('возвратные пути не выдают за источник игрока', () => {
  const evidence = JSON.parse(read(EVIDENCE));
  const byKind = new Map(evidence.resources.map((r) => [r.kind, r]));
  for (const kind of ['Circuit', 'Silicon']) {
    const refunds = byKind.get(kind).flow.refund;
    assert.ok(refunds.some((e) => /forge\.rs/.test(e)), `${kind}: возврат forge expire должен быть в refund`);
    assert.ok(!byKind.get(kind).flow.playerSource.some((e) => /forge\.rs/.test(e)),
      `${kind}: возврат из эскроу — не новый источник для игрока`);
  }
  const expedition = byKind.get('Compute').flow.projectSink;
  assert.deepEqual(expedition, [], 'у Compute нет проектных стоков');
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
    assert.match(result.out, /SoulCore: статус active, а evidence даёт candidate-dead/);
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

test('инвентарь клиентов воспроизводим (требование шага A, замечание владельца)', () => {
  const inventory = read(CLIENT_INVENTORY);
  assert.ok(inventory.includes('git ls-files -- frontend game'), `в ${CLIENT_INVENTORY} нет команды-источника`);
  assert.ok(inventory.includes('frontend/src/pages/farm'), 'инвентарь должен перечислять реальные файлы frontend');
  assert.ok(inventory.includes('game/godot/products/'), 'инвентарь должен перечислять реальные файлы game');
  assert.doesNotMatch(inventory, /find frontend -maxdepth|find game -maxdepth/, 'find-дамп больше не источник истины');
  assert.match(inventory, /sha256: [0-9a-f]{64}/);
});
