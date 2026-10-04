'use strict';
/*
 * `scripts/set-backend-authority.mjs` — выравнивание ключа backend'а с ключом
 * оператора. Проверяется офлайн, на временных файлах: скрипт трогает секреты,
 * поэтому его контракт (что печатается, что пишется, какие коды выхода) должен
 * быть зафиксирован, а не «проверен руками один раз».
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '../..');
const SCRIPT = path.join(ROOT, 'scripts/set-backend-authority.mjs');
const require_ = require('node:module').createRequire(path.join(ROOT, 'aof_backend/package.json'));
const bs58 = require_('bs58');
const { Keypair } = require_('@solana/web3.js');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'aof-auth-'));
}

function writeKeypair(dir, name, keypair) {
  const file = path.join(dir, name);
  fs.writeFileSync(file, JSON.stringify(Array.from(keypair.secretKey)));
  return file;
}

function writeEnv(dir, body) {
  const file = path.join(dir, '.env');
  fs.writeFileSync(file, body, 'utf8');
  return file;
}

function run(args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { cwd: ROOT, encoding: 'utf8' });
}

test('расхождение authority и ключа оператора: --check называет его и выходит с кодом 1', () => {
  const dir = tempDir();
  const operator = Keypair.generate();
  const backend = Keypair.generate();
  const keypair = writeKeypair(dir, 'operator.json', operator);
  const env = writeEnv(dir, `NODE_ENV=development\nAUTHORITY_SECRET_KEY=${bs58.encode(backend.secretKey)}\n`);
  const done = run(['--keypair', keypair, '--backend-env', env]);
  assert.equal(done.status, 1, done.stdout + done.stderr);
  assert.ok(done.stdout.includes(operator.publicKey.toBase58()), 'нет ключа оператора');
  assert.ok(done.stdout.includes(backend.publicKey.toBase58()), 'нет authority backend\'а');
  assert.ok(done.stdout.includes('РАСХОЖДЕНИЕ'), 'нет объяснения');
  assert.ok(done.stdout.includes('set-backend-authority.mjs --apply'), 'нет команды исправления');
});

test('--apply записывает base58-секрет оператора, сохраняя остальные строки, и не печатает секрет', () => {
  const dir = tempDir();
  const operator = Keypair.generate();
  const backend = Keypair.generate();
  const keypair = writeKeypair(dir, 'operator.json', operator);
  const env = writeEnv(dir, [
    'NODE_ENV=development',
    'RPC_URL=https://example.invalid/?api-key=SECRET',
    `AUTHORITY_SECRET_KEY=${bs58.encode(backend.secretKey)}`,
    'AUTHORITY_MODE=read-only',
    '',
  ].join('\n'));
  const done = run(['--apply', '--keypair', keypair, '--backend-env', env]);
  assert.equal(done.status, 0, done.stdout + done.stderr);
  const secret = bs58.encode(operator.secretKey);
  assert.ok(!done.stdout.includes(secret) && !done.stderr.includes(secret), 'секрет попал в вывод');
  const text = fs.readFileSync(env, 'utf8');
  assert.ok(!text.includes(bs58.encode(backend.secretKey)), 'старый секрет остался');
  const written = /^AUTHORITY_SECRET_KEY=(.*)$/m.exec(text)[1];
  assert.equal(Keypair.fromSecretKey(bs58.decode(written)).publicKey.toBase58(), operator.publicKey.toBase58());
  assert.match(text, /^AUTHORITY_MODE=hot$/m);
  assert.match(text, /^AUTHORITY_PUBKEY=[1-9A-HJ-NP-Za-km-z]{32,44}$/m);
  assert.ok(text.includes('RPC_URL=https://example.invalid/?api-key=SECRET'), 'чужие строки не пережили правку');
  assert.match(text, /^NODE_ENV=development$/m);

  const again = run(['--keypair', keypair, '--backend-env', env]);
  assert.equal(again.status, 0, again.stdout + again.stderr);
  assert.ok(again.stdout.includes('совпадают'));
});

test('--quiet молчит при совпадении и молчит при расхождении (код выхода — сигнал)', () => {
  const dir = tempDir();
  const operator = Keypair.generate();
  const keypair = writeKeypair(dir, 'operator.json', operator);
  const env = writeEnv(dir, `AUTHORITY_SECRET_KEY=${bs58.encode(operator.secretKey)}\n`);
  const ok = run(['--quiet', '--keypair', keypair, '--backend-env', env]);
  assert.equal(ok.status, 0);
  assert.equal(ok.stdout.trim(), '');
  const other = writeEnv(dir, `AUTHORITY_SECRET_KEY=${bs58.encode(Keypair.generate().secretKey)}\n`);
  const bad = run(['--quiet', '--keypair', keypair, '--backend-env', other]);
  assert.equal(bad.status, 1);
  assert.equal(bad.stdout.trim(), '');
});

test('негодный вход отказывает понятно: нет файла, не keypair, нет .env, лишний аргумент', () => {
  const dir = tempDir();
  const operator = Keypair.generate();
  const keypair = writeKeypair(dir, 'operator.json', operator);
  const env = writeEnv(dir, 'AUTHORITY_SECRET_KEY=x\n');

  const missing = run(['--keypair', path.join(dir, 'nope.json'), '--backend-env', env]);
  assert.equal(missing.status, 2);
  assert.ok(missing.stderr.includes('нет файла ключа'));

  const notKeypair = path.join(dir, 'garbage.json');
  fs.writeFileSync(notKeypair, '{"secret": "nope"}');
  const garbage = run(['--keypair', notKeypair, '--backend-env', env]);
  assert.equal(garbage.status, 2);
  assert.ok(garbage.stderr.includes('keypair'));

  const noEnv = run(['--keypair', keypair, '--backend-env', path.join(dir, 'absent.env')]);
  assert.equal(noEnv.status, 2);
  assert.ok(noEnv.stderr.includes('нет'));

  const badArg = run(['--wat']);
  assert.equal(badArg.status, 2);
  assert.ok(badArg.stderr.includes('неизвестный аргумент'));
});

test('unreadable секрет в .env не выдаётся за совпадение', () => {
  const dir = tempDir();
  const operator = Keypair.generate();
  const keypair = writeKeypair(dir, 'operator.json', operator);
  const env = writeEnv(dir, 'AUTHORITY_SECRET_KEY="not-base58!!"\n');
  const done = run(['--keypair', keypair, '--backend-env', env]);
  assert.equal(done.status, 1);
  assert.ok(done.stdout.includes('не читается как base58-секрет'), done.stdout);
});

test('включение девнета и dev-local ссылаются на этот путь исправления', () => {
  const bringup = fs.readFileSync(path.join(ROOT, 'scripts/devnet-bringup.sh'), 'utf8');
  assert.ok(bringup.includes('node scripts/set-backend-authority.mjs --apply'), 'bringup не подсказывает команду');
  const devLocal = fs.readFileSync(path.join(ROOT, 'scripts/dev-local.sh'), 'utf8');
  assert.ok(devLocal.includes('node "$ROOT/scripts/set-backend-authority.mjs" --quiet'), 'dev-local не проверяет authority');
});
