const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');

// Точки входа, которые документация и ответы на инциденты зовут ПРЯМО:
// `scripts/deploy-devnet.sh`, `scripts/devnet-bringup.sh`, ... Если у файла нет
// executable-бита, у владельца команда падает с `Permission denied`, а CI этого
// не видит: он везде вызывает `bash <файл>` и `python3 <файл>`. Ровно так
// `scripts/deploy-devnet.sh` уехал в main как 100644 при живом runbook.
const ENTRYPOINTS = [
  'scripts/deploy-devnet.sh',
  'scripts/devnet-bringup.sh',
  'scripts/enable-mining-devnet.sh',
  'scripts/build-local.sh',
  'scripts/verify-programs.sh',
  'scripts/devnet-program-probe.py',
  'scripts/check-idl-drift.py',
  'scripts/verify-address-registry.cjs',
];

test('документированные точки входа исполняемые', () => {
  for (const rel of ENTRYPOINTS) {
    const file = path.join(root, rel);
    assert.ok(fs.existsSync(file), `нет файла ${rel}`);
    const mode = fs.statSync(file).mode;
    assert.ok(mode & 0o111, `${rel} не исполняемый (mode ${(mode & 0o777).toString(8)}) — runbook зовёт его напрямую`);
  }
});

test('bringup — сухой прогон по умолчанию и не включает mainnet', () => {
  const source = fs.readFileSync(path.join(root, 'scripts/devnet-bringup.sh'), 'utf8');
  assert.match(source, /APPLY=0/);
  assert.match(source, /--apply\) APPLY=1/);
  assert.match(source, /AOF_DEPLOY_TARGET.*=.*"devnet"/);
  // Все шаги пути §0 должны быть в одном скрипте: иначе «одна команда» врёт.
  for (const step of [
    'scripts/deploy-devnet.sh',
    'scripts/initConfig.ts',
    'scripts/initMintsV2.ts',
    'caps:init',
    'preflight:mining-devnet',
    'scripts/enable-mining-devnet.sh',
    '/admin/config/collector-mint',
  ]) {
    assert.ok(source.includes(step), `bringup не выполняет шаг ${step}`);
  }
});

test('bringup-тест существует и пинит отказы', () => {
  const source = fs.readFileSync(path.join(root, 'scripts/test-devnet-bringup.py'), 'utf8');
  for (const caseName of [
    'test_wrong_target_refuses_before_any_command',
    'test_backend_steps_need_admin_token',
    'test_dry_run_changes_nothing',
    'test_preflight_blocked_never_turns_mining_on',
  ]) {
    assert.ok(source.includes(caseName), `нет теста ${caseName}`);
  }
});
