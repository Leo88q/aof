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

test('статический payer-audit: 96 init-аккаунта, debt=0 не закрывает пять owner-tracked live debts', () => {
  const result = run(['--check']);
  assert.equal(result.code, 0, result.out);
  assert.match(result.out, /96 инициализац[а-я]*/);
  assert.match(result.out, /долг \(платит оператор вместо игрока\): 0/);
  assert.match(read('docs/PAYER_AUDIT.md'), /5 live payer debts/,
    'source-level debt=0 не является закрытием owner acceptance');
  assert.match(read('docs/PAYER_REMEDIATION.md'), /5 live payer debts open/,
    'remediation status must keep all five live debts open until validator proof');
});

test('политика и матрица покрывают одни и те же 96 аккаунта', () => {
  const policy = JSON.parse(read(POLICY));
  const matrix = JSON.parse(read(MATRIX_JSON));
  assert.equal(Object.keys(policy.entries).length, 96);
  assert.equal(matrix.rows.length, 96);
  assert.equal(policy.entries['aof_core.InitPlayer.player_profile'].payer, 'player');
  // Операторская выдача больше не создаёт профиль игрока: записи
  // `aof_core.MintResource.player` в политике быть не должно — иначе гейт
  // сообщил бы об устаревшей записи, а `init_if_needed, payer = authority`
  // вернулся бы незамеченным.
  assert.equal(policy.entries['aof_core.MintResource.player'], undefined);
  const debt = matrix.rows.filter((r) => r.status === 'debt').map((r) => `${r.program}.${r.instruction}.${r.account}`);
  assert.deepEqual(debt, [], 'долгов плательщиков быть не должно');
  // XP claim may initialize both player-owned PDAs, but the player signs and pays their rent.
  assert.equal(policy.entries['aof_core.GrantSeasonXp.season_pass'].payer, 'player');
  assert.equal(policy.entries['aof_core.GrantSeasonXp.claim_cursor'].payer, 'player');
  assert.equal(policy.entries['aof_core.InitSeasonPass.season_pass'].payer, 'player');
  assert.equal(policy.entries['aof_core.MintResourceOnce.player'].payer, 'player');
  assert.equal(policy.entries['aof_core.MintResourceOnce.reward_receipt'].payer, 'player');
  const byKey = new Map(matrix.rows.map((r) => [`${r.program}.${r.instruction}.${r.account}`, r]));
  for (const key of [
    'aof_core.MintResourceOnce.player', 'aof_core.MintResourceOnce.reward_receipt',
    'aof_core.InitSeasonPass.season_pass', 'aof_core.GrantSeasonXp.season_pass',
    'aof_core.GrantSeasonXp.claim_cursor',
  ]) {
    const row = byKey.get(key);
    assert.ok(row, `${key}: строка матрицы пропала`);
    assert.equal(row.payerIsOperatorOrAuthority, false, `${key}: платит оператор`);
  }
  for (const row of matrix.rows) {
    assert.ok(row.owner && row.requiredPayer && row.status, `${row.program}.${row.instruction}.${row.account}: не классифицирован`);
    if (row.requiredPayer === 'cranker-deposit') assert.ok(row.settlement && row.refund, 'cranker-deposit без settlement/refund');
  }
});

test('код, вернувший оператору оплату аккаунта игрока, роняет гейт как скрытая субсидия', () => {
  // Source classifier has no current debt rows, so introduce a regression in
  // the sandbox code: player `payer = user` becomes `payer = authority`. The
  // gate must detect that even though the policy stays untouched; this static
  // result still does not close the five owner-tracked acceptance debts.
  withRoot((tmp) => {
    const file = path.join(tmp, 'aof-core/src/lib.rs');
    const src = fs.readFileSync(file, 'utf8');
    assert.match(src, /init_if_needed, payer = user/);
    fs.writeFileSync(file, src.replace('init_if_needed, payer = user', 'init_if_needed, payer = authority'));
    const result = run(['--check', '--root', tmp]);
    assert.equal(result.code, 1, result.out);
    assert.match(result.out, /скрытая субсидия/);
  });
});

test('запись политики для удалённой инициализации — ошибка', () => {
  // `MintResource.player` больше не инициализируется; возврат старой записи должен ловиться как stale.
  for (const key of ['aof_core.MintResource.player']) {
    withRoot((tmp) => {
      editJson(tmp, POLICY, (p) => {
        p.entries[key] = {
          owner: 'player', payer: 'player', status: 'ok', reason: 'вернули init_if_needed оператора в обход гейта',
        };
        return p;
      });
      const result = run(['--check', '--root', tmp]);
      assert.equal(result.code, 1, result.out);
      assert.match(result.out, /устарела/);
    });
  }
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
