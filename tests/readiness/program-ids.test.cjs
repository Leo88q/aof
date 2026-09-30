'use strict';
/*
 * Адреса программ — это не «строчка в конфиге»: тот же base58 обязан совпасть в
 * declare_id!, Anchor.toml, реестре, IDL, watchtower и клиентах, иначе игра
 * молча зовёт программу, которой в сети нет. Эти проверки дублируют гейт
 * `scripts/rotate-program-ids.mjs --check` (его же зовёт CI) и добавляют то, что
 * ломается при смене адреса руками: генерация без списка, зашитый литерал в
 * локальном запуске и потеря истории старых адресов.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const run = (args, options = {}) => {
  try {
    const stdout = execFileSync(process.execPath, [path.join(root, 'scripts/rotate-program-ids.mjs'), ...args], {
      cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options,
    });
    return { code: 0, stdout };
  } catch (error) {
    return { code: error.status ?? 1, stdout: `${error.stdout ?? ''}${error.stderr ?? ''}` };
  }
};

const registry = JSON.parse(read('security/program-registry.json'));
const programs = registry.programs.filter((p) => p.onChain);
const byName = new Map(programs.map((p) => [p.name, p]));

test('смена адресов: гейт сходится (declare_id!, Anchor.toml, реестр, IDL, watchtower, клиенты)', () => {
  const result = run(['--check']);
  assert.equal(result.code, 0, `гейт адресов красный:\n${result.stdout}`);
});

test('реестр — единственный источник истины, и он не пустой', () => {
  assert.ok(programs.length >= 6, `в реестре ${programs.length} on-chain программ — ожидалось 6`);
  const anchor = read('Anchor.toml');
  for (const entry of programs) {
    assert.match(entry.address, /^[1-9A-HJ-NP-Za-km-z]{32,44}$/, `${entry.name}: адрес в реестре не base58`);
    for (const cluster of registry.clusters) {
      const section = anchor.split(`[programs.${cluster}]`)[1] || '';
      assert.ok(section.split('\n[')[0].includes(`${entry.name} = "${entry.address}"`),
        `Anchor.toml [programs.${cluster}] не знает ${entry.name} = ${entry.address}`);
    }
    const idl = JSON.parse(read(entry.idl));
    assert.equal(idl.address, entry.address, `${entry.idl}: адрес разошёлся с реестром`);
  }
});

test('замена адреса не может быть сделана «на глаз»: генерация требует список', () => {
  const result = run(['--generate']);
  assert.notEqual(result.code, 0, 'генерация без списка программ должна отказывать: у уже задеплоенной программы адрес менять нельзя');
  assert.match(result.stdout, /--generate требует список программ/);
});

test('локальный запуск и бэкенд читают адрес из реестра, а не из литерала', () => {
  const dev = read('scripts/dev-local.sh');
  for (const entry of programs) {
    assert.ok(!dev.includes(entry.address), `scripts/dev-local.sh: адрес ${entry.name} зашит литералом — читайте security/program-registry.json`);
  }
  assert.match(dev, /registry_address aof_core/, 'обещание «адрес из реестра» не выполнено: нет registry_address aof_core');
  assert.match(dev, /scripts\/rotate-program-ids\.mjs/, 'локальный запуск не умеет менять ключи/адреса одной командой');
});

test('история адресов сохраняется: старые адреса не выдают себя за текущие', () => {
  for (const entry of programs) {
    for (const old of entry.previousAddresses || []) {
      assert.notEqual(old, entry.address, `${entry.name}: прошлый адрес совпал с текущим`);
    }
  }
  // Если адрес меняли, в объявлении обязан быть новый: пара «реестр == declare_id!»
  // проверяется гейтом, здесь — что в файле вообще есть declare_id! у каждой программы.
  for (const entry of programs) {
    const source = { aof_core: 'aof-core/src/lib.rs', aof_market: 'programs/aof-market/src/lib.rs', aof_quests: 'programs/aof-quests/src/lib.rs', aof_rebirth: 'programs/aof-rebirth/src/lib.rs', aof_liquidity: 'programs/aof-liquidity/src/lib.rs', aof_session_keys: 'programs/aof-session-keys/src/lib.rs' }[entry.name];
    assert.ok(source, `нет файла declare_id! для ${entry.name}`);
    assert.match(read(source), new RegExp(`declare_id!\\("${entry.address}"\\)`), `${source}: declare_id! не совпал с реестром`);
  }
});

test('девнет-путь умеет ключи, уборку, тесты, деплой и тестовый запуск', () => {
  const dev = read('scripts/dev-local.sh');
  for (const command of ['clean)', 'keys)', 'devnet)']) {
    assert.ok(dev.includes(command), `dev-local.sh не знает команду ${command.replace(')', '')}`);
  }
  for (const step of ['cmd_clean', 'cmd_keys', 'cmd_test', 'cmd_build', 'cmd_devnet', 'cmd_up']) {
    assert.ok(dev.includes(`${step}()`), `нет шага ${step}`);
  }
  // Деплой не должен случаться без явного --apply.
  assert.match(dev, /APPLY=0/);
  assert.match(dev, /for arg in "\$@"; do \[ "\$arg" = "--apply" \] && APPLY=1; done/);
  assert.match(dev, /scripts\/devnet-bringup\.sh( --apply)?/);
  // Ключи программ не удаляются уборкой: их потеря — потеря доступа к адресу.
  const clean = dev.slice(dev.indexOf('cmd_clean()'), dev.indexOf('cmd_keys()'));
  assert.ok(!/rm -rf[^\n]*keys/.test(clean), 'уборка удаляет ключи программ');
});
