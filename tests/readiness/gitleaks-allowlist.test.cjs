'use strict';
/*
 * Исключения gitleaks (.gitleaks.toml) — ровно то, что нужно, и не шире.
 *
 * Правило generic-api-key срабатывает на публичный Program ID, если в имени идентификатора есть «key»
 * (`aof_session_keys = "<ID>"`). Адрес не секрет, поэтому исключён ТОЧНЫЙ текущий адрес. Широкое исключение
 * («любой base58 длиной 32–44») недопустимо: 32-байтный seed выглядит как адрес, и такой шаблон пропустил бы
 * утёкший seed. Исключения по путям тоже запрещены: «file-wide exclusions hide leaks» (комментарий в .gitleaks.toml).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const config = JSON.parse(execFileSync('python3', ['-c',
  "import json,sys,tomllib; print(json.dumps(tomllib.load(open('.gitleaks.toml','rb'))))"], { cwd: root, encoding: 'utf8' }));
const registry = JSON.parse(fs.readFileSync(path.join(root, 'watchtower/addresses.json'), 'utf8'));
const addresses = new Map(registry.programs.map((p) => [p.address, p.name]));

test('конфиг по-прежнему расширяет правила gitleaks и сохраняет проектные правила', () => {
  assert.equal(config.extend.useDefault, true);
  const ids = (config.rules || []).map((r) => r.id);
  assert.ok(ids.includes('solana-keypair-array'));
  assert.ok(ids.includes('base58-private-key-assignment'));
});

test('исключены только точные адреса программ из реестра, без шаблонов и без путей', () => {
  const allow = config.allowlist || {};
  const regexes = allow.regexes || [];
  assert.ok(regexes.length >= 1, 'исключение для aof_session_keys пропало — secret scan снова покраснеет');
  for (const rx of regexes) {
    const m = /^\^([1-9A-HJ-NP-Za-km-z]{32,44})\$$/.exec(rx);
    assert.ok(m, `исключение «${rx}» не является точным base58-адресом (^…$): широкие шаблоны пропустят seed`);
    assert.ok(addresses.has(m[1]), `адрес ${m[1]} из исключения не принадлежит ни одной программе реестра (устарел после смены Program ID?)`);
  }
  assert.deepEqual(allow.paths || [], [], 'исключения по путям скрывают утечки целыми файлами');
  assert.deepEqual(allow.commits || [], [], 'исключения по коммитам запрещены');
  assert.deepEqual(allow.stopwords || [], [], 'свои стоп-слова ослабляют все правила');
});

test('адрес aof_session_keys исключён: в имени программы есть «key», и без этого CI падает на любом упоминании ID', () => {
  const session = registry.programs.find((p) => p.name === 'aof_session_keys').address;
  assert.ok((config.allowlist.regexes || []).includes(`^${session}$`), 'текущий Program ID aof_session_keys не в исключении gitleaks');
});

test('в тестовых фикстурах публичные адреса не лежат рядом со словом «key» в имени поля', () => {
  // Это и есть первопричина срабатывания: новое такое место снова даст ложную «утечку» вместе с настоящими.
  const offenders = [];
  const files = ['scripts/test-devnet-deploy-estimator.py', 'scripts/test-deploy-devnet.py', 'scripts/test-devnet-bringup.py'];
  for (const rel of files) {
    fs.readFileSync(path.join(root, rel), 'utf8').split('\n').forEach((line, index) => {
      if (/["'][A-Za-z_]*keys?[A-Za-z_]*["']\s*:\s*["'][1-9A-HJ-NP-Za-km-z]{32,44}["']/.test(line)) offenders.push(`${rel}:${index + 1}`);
    });
  }
  assert.deepEqual(offenders, []);
});
