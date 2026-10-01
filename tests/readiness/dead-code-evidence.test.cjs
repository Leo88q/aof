'use strict';
/*
 * Evidence для удаления мёртвого кода (scripts/dead-code-evidence.mjs): решение «удалить» допустимо
 * только для доказанных категорий (замена активной инструкцией, pre-genesis миграция, механика,
 * нерабочая by construction, deprecated без потребителей). Всё остальное обязано остаться с
 * причиной — иначе гейт разрешил бы снести фичу, которая просто ещё не включена.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const script = path.join(root, 'scripts/dead-code-evidence.mjs');
const OUT_JSON = 'docs/DEAD_CODE_EVIDENCE.json';
const OUT_MD = 'docs/DEAD_CODE_EVIDENCE.md';

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
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aof-deadcode-'));
  for (const rel of ['docs', 'aof-core/src', 'aof_backend/src', 'programs', 'tests']) {
    const from = path.join(root, rel);
    if (!fs.existsSync(from)) continue;
    fs.cpSync(from, path.join(tmp, rel), { recursive: true, filter: (src) => !/node_modules|\/target(\/|$)/.test(src) });
  }
  return tmp;
}
const editJson = (tmp, rel, fn) => {
  const p = path.join(tmp, rel);
  fs.writeFileSync(p, `${JSON.stringify(fn(JSON.parse(fs.readFileSync(p, 'utf8'))), null, 2)}\n`);
};
const withRoot = (fn) => { const tmp = makeRoot(); try { return fn(tmp); } finally { fs.rmSync(tmp, { recursive: true, force: true }); } };

test('репозиторий проходит гейт: 7 отключённых инструкций, к удалению 0 (все — product decision pending)', () => {
  const result = run(['--check']);
  assert.equal(result.code, 0, result.out);
  assert.match(result.out, /7 инструкций, к удалению 0/);
});

test('удаляются только доказанные категории, остальные — keep с причиной', () => {
  const evidence = JSON.parse(read(OUT_JSON));
  const byName = new Map(evidence.instructions.map((i) => [`${i.program}.${i.name}`, i]));
  const remove = evidence.instructions.filter((i) => /^remove/.test(i.decision)).map((i) => i.name).sort();
  // Шаг B закрыл все доказанно мёртвое: migrate_tool, marketplace_buy, rental_start и
  // place_limit_order удалены. Оставшиеся 7 — отключённые фичи, ждущие решения владельца.
  assert.deepEqual(remove, []);
  for (const name of ['aof_quests.potato_spin_commit', 'aof_session_keys.session_create', 'aof_core.purchase_season_pass']) {
    const entry = byName.get(name);
    assert.match(entry.decision, /^keep — disabled \/ product decision pending: .+/, `${name}: keep обязан нести статус и причину`);
    assert.ok(entry.guard.code, `${name}: guard должен быть подтверждён кодом`);
  }
});

test('call sites и тесты зафиксированы, а не выдуманы', () => {
  const evidence = JSON.parse(read(OUT_JSON));
  const byName = new Map(evidence.instructions.map((i) => [`${i.program}.${i.name}`, i]));
  assert.deepEqual(byName.get('aof_quests.challenge_contribute').backendCallSites.files, ['aof_backend/src/routes/challenges.ts']);
  assert.deepEqual(byName.get('aof_quests.achievement_unlock').backendCallSites.files, ['aof_backend/src/routes/quests.ts']);
  assert.ok(byName.get('aof_quests.drum_commit').tests.includes('tests/readiness/vrf-tx-size.test.cjs'));
});

test('потеря инструкции в инвентаре роняет гейт (evidence и код обязаны идти вместе)', () => {
  withRoot((tmp) => {
    editJson(tmp, 'docs/INSTRUCTION_INVENTORY.json', (inv) => {
      inv.instructions = inv.instructions.filter((i) => i.name !== 'drum_commit');
      return inv;
    });
    const result = run(['--check', '--root', tmp]);
    assert.equal(result.code, 1, result.out);
    assert.match(result.out, /evidence ссылается на инструкции, которых больше нет в инвентаре: aof_quests\.drum_commit/);
  });
  withRoot((tmp) => {
    editJson(tmp, 'docs/INSTRUCTION_INVENTORY.json', (inv) => {
      // инструкцию «отключили» в инвентаре, но evidence про это ещё не знает
      const entry = inv.instructions.find((i) => i.name === 'sync_tool_owner');
      entry.status = 'disabled-on-chain';
      return inv;
    });
    const result = run(['--check', '--root', tmp]);
    assert.equal(result.code, 1, result.out);
    assert.match(result.out, /в evidence нет отключённых инструкций: aof_core\.sync_tool_owner/);
  });
});

test('ложное «remove» для живой механики и «admin/security на удаление» роняют гейт', () => {
  withRoot((tmp) => {
    editJson(tmp, OUT_JSON, (e) => {
      const entry = e.instructions.find((i) => i.name === 'potato_spin_commit');
      entry.decision = 'remove — отключена по дизайну, живого пути нет';
      return e;
    });
    const result = run(['--check', '--root', tmp]);
    assert.equal(result.code, 1, result.out);
    assert.match(result.out, /удаление допускается только для доказанных категорий/);
  });
  withRoot((tmp) => {
    editJson(tmp, OUT_JSON, (e) => {
      const entry = e.instructions.find((i) => i.name === 'session_create');
      entry.adminOrSecurityNeed = true;
      entry.decision = 'remove — by construction: парной инструкции (матчинг\/расчёт) в программе нет';
      return e;
    });
    const result = run(['--check', '--root', tmp]);
    assert.equal(result.code, 1, result.out);
    assert.match(result.out, /admin\/security путь помечен на удаление/);
  });
});

test('устаревший markdown и отсутствие evidence — ошибки', () => {
  withRoot((tmp) => {
    fs.appendFileSync(path.join(tmp, OUT_MD), '\nустаревшая строка\n');
    const result = run(['--check', '--root', tmp]);
    assert.equal(result.code, 1);
    assert.match(result.out, /устарел/);
  });
  withRoot((tmp) => {
    fs.rmSync(path.join(tmp, OUT_JSON));
    const result = run(['--check', '--root', tmp]);
    assert.equal(result.code, 1);
    assert.match(result.out, /нет docs\/DEAD_CODE_EVIDENCE\.json/);
  });
});
