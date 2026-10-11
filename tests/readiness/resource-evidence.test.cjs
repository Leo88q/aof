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

test('репозиторий проходит гейт: 27 active-player, 0 active-internal, 0 candidate-dead, 0 dead', () => {
  const result = run(['--check']);
  assert.equal(result.code, 0, result.out);
  assert.match(result.out, /27 ресурсов/);
  const evidence = JSON.parse(read(EVIDENCE));
  const byStatus = (status) => evidence.resources.filter((r) => r.status === status).map((r) => r.kind).sort();
  assert.equal(byStatus('active-player').length, 27);
  assert.equal(byStatus('active-internal').length, 0);
  assert.equal(byStatus('candidate-dead').length, 0);
  assert.equal(byStatus('dead').length, 0);
  assert.deepEqual(byStatus('candidate-dead'), []);
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
  assert.ok(sourceOf('Synapse').includes('harvest_synapse.rs'), 'Synapse is emitted by the canonical harvest instruction');
  assert.ok(sourceOf('Model').includes('collect_model.rs'), 'Model минтается на печи');
  assert.ok(sourceOf('Power').includes('collect_power.rs'), 'Power — колодец');
  assert.ok(sourceOf('Dataset').includes('collect_mining.rs'), 'Dataset даёт инструмент data_harvester');
  assert.ok(sourceOf('QuantumBit').includes('craft_recipe.rs'), 'QuantumBit — рецепт 0');
  assert.ok(sinkOf('Silicon').includes('repair.rs'), 'Silicon тратится на ремонт');
  assert.ok(sinkOf('Compute').includes('start_model_training.rs'), 'Compute — топливо печи');
  assert.ok(sinkOf('Data').includes('exploration.rs'), 'Data — стоимость трипа');
  assert.ok(sourceOf('Data').includes('craft_recipe.rs'), 'Data собирается из набора данных');
  assert.ok(sourceOf('AmberQuartz').includes('craft_recipe.rs'), 'AmberQuartz — сосуд из фотонного бита');
  assert.ok(sinkOf('AmberQuartz').includes('seal_laboratory.rs'), 'AmberQuartz сгорает в печати');
  assert.ok(sourceOf('SoulCore').includes('seal_laboratory.rs'), 'SoulCore выпускает печать');
  assert.ok(sinkOf('Model').includes('seal_laboratory.rs'), 'модель сгорает в печати');
});

test('dynamic dispatch посчитан: generic-пути, таблица инструментов и рецепты в evidence', () => {
  const evidence = JSON.parse(read(EVIDENCE));
  const g = evidence.genericPaths;
  assert.ok(g.adminMint.some((e) => e.includes('mint_resource.rs')), 'generic admin-минт обязан быть в evidence');
  assert.ok(g.playerClaim.some((e) => e.includes('mint_resource_once.rs')), 'claim игрока обязан быть в evidence');
  assert.deepEqual(g.miningKinds, ['Circuit', 'Dataset', 'Neuron', 'Silicon'], 'таблица resource_kind_for_tool');
  assert.equal(g.orderbookKinds, 27, 'ордербук принимает все 27 kinds — это не источник');
  assert.equal(g.recipes.length, 18, 'рецептов в craft_recipe.rs — 18');
  assert.deepEqual(evidence.productGaps.craftInputsWithoutPlayerSource, []);
  assert.deepEqual(evidence.productGaps.craftOutputsNeverConsumed, []);
});

test('флаги каждого ресурса согласованы со списками, а статус — с флагами', () => {
  const evidence = JSON.parse(read(EVIDENCE));
  for (const r of evidence.resources) {
    const playerHeld = r.flow.playerSource.length > 0 || r.flow.playerSink.length > 0
      || r.flow.craftInput.length > 0 || r.flow.craftOutput.length > 0;
    assert.deepEqual(r.flow.flags, {
      player_held: playerHeld,
      ui_visible: r.frontend.length > 0,
      tradable: r.flow.tradable.length > 0,
      has_player_source: r.flow.playerSource.length > 0,
      has_player_sink: r.flow.playerSink.length > 0,
      has_admin_source: r.flow.adminMint.length > 0,
      recipe_input: r.flow.craftInput.length > 0,
      recipe_output: r.flow.craftOutput.length > 0,
      mining_output: r.flow.miningOutput.length > 0,
      generic_claim_output: r.flow.playerClaim.length > 0,
      internal_only: !playerHeld && r.flow.projectSink.length > 0,
    }, `${r.kind}: флаги разошлись со списками`);
    // Статус описывает природу ресурса: player_held => active-player, независимо от того,
    // есть ли у ресурса источник и сток (решение владельца от 2026-10-01).
    if (r.flow.flags.player_held) assert.equal(r.status, 'active-player', `${r.kind}: ресурс бывает балансом игрока, статус обязан быть active-player`);
    if (r.status === 'active-internal') assert.ok(r.flow.flags.internal_only, `${r.kind}: active-internal без internal_only`);
    if (r.status === 'candidate-dead') {
      assert.ok(!r.flow.flags.player_held, `${r.kind}: candidate-dead, но ресурс бывает балансом игрока`);
      assert.ok(r.frontend.length > 0 || r.flow.tradable.length > 0 || r.onchainRefs.length > 0,
        `${r.kind}: candidate-dead без записи в каталоге/реестре`);
    }
    const issue = r.economyIssue ?? null;
    const sink = r.flow.flags.has_player_sink || r.flow.flags.recipe_input;
    const source = r.flow.flags.has_player_source || r.flow.flags.recipe_output;
    const trophy = r.kind === 'SoulCore' && source && !sink;
    const expectedIssue = trophy ? null : (sink && !source ? 'missing_source' : (!sink && source ? 'missing_sink' : null));
    assert.equal(issue, expectedIssue, `${r.kind}: economy_issue разошёлся со связностью источника/стока`);
  }
});

test('отсутствие источника/стока не понижает player-ресурс (коррекция владельца 2026-10-01)', () => {
  const evidence = JSON.parse(read(EVIDENCE));
  const byKind = new Map(evidence.resources.map((r) => [r.kind, r]));
  const data = byKind.get('Data');
  assert.equal(data.status, 'active-player', 'Data лежит в ATA игрока и сжигается стоимостью трипа — это player-ресурс');
  assert.equal(data.flow.flags.player_held, true);
  assert.equal(data.flow.flags.has_player_sink, true);
  assert.equal(data.flow.flags.has_player_source, true, 'Data собирается из набора данных');
  assert.equal(data.economyIssue, null, 'разрыв закрыт рецептом, статус не менялся');
  const fluid = byKind.get('BioFluid');
  assert.equal(fluid.status, 'active-player', 'BioFluid выходит из рецепта в ATA игрока');
  assert.equal(fluid.flow.flags.has_player_source, true);
  assert.equal(fluid.flow.flags.has_player_sink, true, 'флюид сгорает в печати');
  assert.equal(fluid.economyIssue, null);
  for (const kind of ['BlueCore', 'PurpleCore', 'RedCore', 'ClearQuartz', 'RoseQuartz', 'BioChip', 'Compute', 'Mind', 'AmberQuartz', 'SoulCore']) {
    assert.equal(byKind.get(kind).status, 'active-player', `${kind}: рецепт, печать или топливо держат его на счёте игрока`);
  }
  assert.equal(byKind.get('SoulCore').economyIssue, null, 'ядро души — сохранённый трофей, не дыра');
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
    assert.match(result.out, /SoulCore: статус active, а evidence даёт active-player/);
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
  assert.ok(inventory.includes('git ls-tree -r HEAD -- frontend game'), `в ${CLIENT_INVENTORY} нет команды-источника committed HEAD`);
  assert.ok(inventory.includes('frontend/src/pages/farm'), 'инвентарь должен перечислять реальные файлы frontend');
  assert.ok(inventory.includes('game/godot/products/'), 'инвентарь должен перечислять реальные файлы game');
  assert.doesNotMatch(inventory, /find frontend -maxdepth|find game -maxdepth/, 'find-дамп больше не источник истины');
  assert.match(inventory, /sha256: [0-9a-f]{64}/);
});
