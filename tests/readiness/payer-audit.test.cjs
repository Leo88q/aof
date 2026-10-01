'use strict';
/*
 * Гейт плательщиков (scripts/payer-audit.mjs): каждый init-аккаунт шести программ обязан быть
 * классифицирован в security/payer-policy.json, матрица docs/PAYER_MATRIX.* обязана быть свежей, а
 * расхождение «в коде платит оператор, по политике должен игрок» обязано называться скрытой субсидией.
 *
 * Тесты мутируют не репозиторий, а временную копию — иначе «зелёный» гейт можно было бы получить,
 * просто выключив проверку.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const script = path.join(root, 'scripts/payer-audit.mjs');
const POLICY = 'security/payer-policy.json';
const MATRIX_JSON = 'docs/PAYER_MATRIX.json';
const MATRIX_MD = 'docs/PAYER_MATRIX.md';
const KEY = 'aof_core.MintTool.tool_data';

const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

function run(args, cwd = root) {
  try {
    const stdout = execFileSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, out: stdout };
  } catch (error) {
    return { code: error.status ?? 1, out: `${error.stdout ?? ''}${error.stderr ?? ''}` };
  }
}

/** Копия репозитория ровно в том объёме, который читает payer-audit.mjs. */
function makeRoot(withPolicy = true) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aof-payer-'));
  const copy = (rel) => {
    const from = path.join(root, rel);
    if (!fs.existsSync(from)) return;
    fs.cpSync(from, path.join(tmp, rel), { recursive: true, filter: (src) => !/node_modules|\/target(\/|$)/.test(src) });
  };
  for (const rel of ['watchtower/addresses.json', 'aof-core/src', 'programs']) copy(rel);
  fs.mkdirSync(path.join(tmp, 'security'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'docs'), { recursive: true });
  if (withPolicy) copy(POLICY);
  copy(MATRIX_JSON);
  copy(MATRIX_MD);
  return tmp;
}
const editJson = (tmp, rel, fn) => {
  const p = path.join(tmp, rel);
  fs.writeFileSync(p, `${JSON.stringify(fn(JSON.parse(fs.readFileSync(p, 'utf8'))), null, 2)}\n`);
};
const withRoot = (fn, withPolicy = true) => { const tmp = makeRoot(withPolicy); try { return fn(tmp); } finally { fs.rmSync(tmp, { recursive: true, force: true }); } };

test('репозиторий проходит гейт: 91 инициализация, 5 долгов (MigrateTool удалён в шаге B)', () => {
  const result = run(['--check']);
  assert.equal(result.code, 0, result.out);
  assert.match(result.out, /91 инициализаций классифицированы/);
  assert.match(result.out, /долг \(платит оператор вместо игрока\): 5/);
});

test('политика и матрица покрывают одни и те же 91 аккаунт', () => {
  const policy = JSON.parse(read(POLICY));
  const matrix = JSON.parse(read(MATRIX_JSON));
  assert.equal(Object.keys(policy.entries).length, 91);
  assert.equal(matrix.rows.length, 91);
  const debt = matrix.rows.filter((r) => r.status === 'debt').map((r) => `${r.program}.${r.instruction}.${r.account}`);
  assert.deepEqual(debt, [
    'aof_core.GrantSeasonXp.season_pass',
    'aof_core.MintResource.player',
    'aof_core.MintResourceOnce.player',
    'aof_core.MintResourceOnce.reward_receipt',
    'aof_core.MintTool.tool_data',
  ]);
  for (const row of matrix.rows) {
    assert.ok(row.owner && row.requiredPayer && row.status, `${row.program}.${row.instruction}.${row.account}: не классифицирован`);
    if (row.requiredPayer === 'cranker-deposit') assert.ok(row.settlement && row.refund, 'cranker-deposit без settlement/refund');
  }
});

test('снятый долг (ok вместо debt) роняет гейт как скрытая субсидия', () => {
  withRoot((tmp) => {
    editJson(tmp, POLICY, (p) => { p.entries[KEY].status = 'ok'; return p; });
    const result = run(['--check', '--root', tmp]);
    assert.equal(result.code, 1, result.out);
    assert.match(result.out, /скрытая субсидия/);
  });
});

test('правка политики ломает гейт ожидаемым сообщением', () => {
  const cases = [
    [(p) => { p.entries['aof_core.StartMining.player'].payer = 'operator'; }, /аккаунт игрока не может по политике оплачиваться оператором/],
    [(p) => { delete p.entries['aof_core.Craft.new_tool_data']; }, /не классифицирована в security\/payer-policy\.json/],
    [(p) => { p.entries['aof_core.Ghost.ghost'] = { owner: 'player', payer: 'player', status: 'ok', reason: 'призрак без инициализации' }; }, /запись aof_core\.Ghost\.ghost устарела/],
    [(p) => { p.entries['aof_core.Craft.new_tool_data'].status = 'debt'; }, /помечено debt, но в коде платит не оператор/],
    [(p) => { p.entries['aof_core.StartMining.player'].reason = 'коротко'; }, /нужна причина \(reason\)/],
    [(p) => { p.entries['aof_core.StartMining.player'].reason = undefined; }, /нужна причина \(reason\)/],
  ];
  for (const [mutate, pattern] of cases) {
    withRoot((tmp) => {
      editJson(tmp, POLICY, (p) => { mutate(p); return p; });
      const result = run(['--check', '--root', tmp]);
      assert.equal(result.code, 1, `ожидался отказ для ${pattern}: ${result.out}`);
      assert.match(result.out, pattern);
    });
  }
});

test('гейт требует политику и свежую матрицу', () => {
  withRoot((tmp) => {
    const result = run(['--check', '--root', tmp]);
    assert.equal(result.code, 1);
    assert.match(result.out, /нет security\/payer-policy\.json/);
  }, false); // копия без политики
  withRoot((tmp) => {
    fs.appendFileSync(path.join(tmp, MATRIX_MD), '\nустаревшая строка\n');
    const result = run(['--check', '--root', tmp]);
    assert.equal(result.code, 1);
    assert.match(result.out, /docs\/PAYER_MATRIX\.md устарел/);
  });
});

test('--write восстанавливает матрицу, --check её принимает', () => {
  withRoot((tmp) => {
    fs.rmSync(path.join(tmp, MATRIX_JSON));
    assert.equal(run(['--check', '--root', tmp]).code, 1);
    assert.equal(run(['--write', '--root', tmp]).code, 0);
    assert.equal(run(['--check', '--root', tmp]).code, 0);
  });
});
