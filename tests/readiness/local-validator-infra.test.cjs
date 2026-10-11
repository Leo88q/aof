'use strict';
/*
 * Локальный прогон `make test` должен видеть тот же валидатор, что и CI:
 * историю транзакций целиком (иначе `tests/aof_cu_report.ts` читает обрезанный
 * ledger). Двойник Switchboard удалён и не должен возвращаться в genesis.
 * Порог CU для VRF-раскрытий живёт в трёх местах и обязан совпадать.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const SWITCHBOARD = 'SBondMDrcV3K4kxZR1HNVT7osZxAHVHgYXL5Ze1oMUv';
const VRF_PATTERN = String.raw`^(VrfPoolAdd|\w+Commit|\w+Reveal)$`;

test('Anchor.toml удерживает историю локального валидатора', () => {
  const toml = read('Anchor.toml');
  assert.match(toml, /limit_ledger_size = "500000"/);
  assert.doesNotMatch(toml, /\[\[test\.genesis\]\]/, 'genesis-запись двойника не постоянная: её добавляет прогон, файла .so в свежем клоне нет');
});

test('make test идёт через обёртку, которая не возвращает двойник Switchboard', () => {
  const makefile = read('Makefile');
  assert.match(makefile, /^test: ensure-env\n\t@echo .*\n\tbash scripts\/anchor-test\.sh$/m);
  const wrapper = read('scripts/anchor-test.sh');
  assert.match(wrapper, new RegExp(SWITCHBOARD));
  assert.match(wrapper, /must not pin a Switchboard genesis program/);
  assert.match(wrapper, /tests\/mock-switchboard must stay deleted/);
  assert.doesNotMatch(wrapper, /AOF_REQUIRE_SWITCHBOARD_MOCK/);
  assert.match(wrapper, /exec anchor test --skip-build/);
  assert.equal(fs.statSync(path.join(root, 'scripts/anchor-test.sh')).mode & 0o111, 0o111);
  assert.equal(fs.existsSync(path.join(root, 'tests/mock-switchboard')), false);
});

test('порог CU для VRF-раскрытий один и тот же в отчёте, инвентаре и бенчмарке', () => {
  const sources = [
    ['tests/aof_cu_report.ts', /const HEADROOM_LIMIT = 150_000;/, /const VRF_HEADROOM_LIMIT = 175_000;/],
    ['scripts/instruction-inventory.mjs', /export const CU_LIMIT = 150000;/, /export const CU_LIMIT_VRF = 175000;/],
    ['scripts/bench-sbf-profiles.mjs', /export const CU_THRESHOLD = 150_000;/, /export const CU_THRESHOLD_VRF = 175_000;/],
  ];
  for (const [rel, general, vrf] of sources) {
    const text = read(rel);
    assert.match(text, general, `${rel}: общий порог 150 000`);
    assert.match(text, vrf, `${rel}: порог VRF 175 000`);
    assert.ok(text.includes(VRF_PATTERN), `${rel}: класс VRF-инструкций разошёлся`);
  }
});

test('обёртка не меняет Anchor.toml и пробрасывает код anchor', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aof-anchor-test-'));
  const bin = path.join(tmp, 'bin');
  const repo = path.join(tmp, 'repo');
  fs.mkdirSync(bin);
  fs.mkdirSync(path.join(repo, 'scripts'), { recursive: true });
  fs.copyFileSync(path.join(root, 'scripts/anchor-test.sh'), path.join(repo, 'scripts/anchor-test.sh'));
  fs.copyFileSync(path.join(root, 'Anchor.toml'), path.join(repo, 'Anchor.toml'));
  fs.writeFileSync(path.join(bin, 'anchor'), '#!/bin/sh\nif grep -q SBondMDrcV3K4kxZR1HNVT7osZxAHVHgYXL5Ze1oMUv Anchor.toml; then echo "switchboard genesis returned" >&2; exit 9; fi\nexit "${FAKE_ANCHOR_EXIT:-0}"\n');
  fs.chmodSync(path.join(bin, 'anchor'), 0o755);
  const before = fs.readFileSync(path.join(repo, 'Anchor.toml'));
  const run = (extraEnv) => spawnSync('bash', ['scripts/anchor-test.sh'], {
    cwd: repo,
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, ...extraEnv },
    encoding: 'utf8',
  });
  try {
    const ok = run({});
    assert.equal(ok.status, 0, `${ok.stdout}\n${ok.stderr}`);
    assert.deepEqual(fs.readFileSync(path.join(repo, 'Anchor.toml')), before, 'прогон изменил Anchor.toml');
    const failed = run({ FAKE_ANCHOR_EXIT: '3' });
    assert.equal(failed.status, 3, 'код выхода anchor должен дойти до вызывающего');
    assert.deepEqual(fs.readFileSync(path.join(repo, 'Anchor.toml')), before, 'падение anchor изменило Anchor.toml');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
