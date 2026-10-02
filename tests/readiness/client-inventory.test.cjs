'use strict';
/*
 * Инвентарь клиентских файлов (scripts/client-inventory.mjs) и осиротевшие
 * записи IDL (scripts/check-idl-orphans.py).
 *
 * Важная граница: baseline строится по committed HEAD только после проверки
 * HEAD/index/worktree и известных remote refs. --check не переписывает файл;
 * --write разрешён только на чистом, согласованном snapshot.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const inventoryScript = path.join(root, 'scripts/client-inventory.mjs');
const orphansScript = path.join(root, 'scripts/check-idl-orphans.py');
const INVENTORY = 'docs/CLIENT_INVENTORY.txt';

const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

function runNode(script, args, cwd = root) {
  try {
    return { code: 0, out: execFileSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
  } catch (error) {
    return { code: error.status ?? 1, out: `${error.stdout ?? ''}${error.stderr ?? ''}` };
  }
}
function runPy(args, cwd = root) {
  try {
    return { code: 0, out: execFileSync('python3', [orphansScript, ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
  } catch (error) {
    return { code: error.status ?? 1, out: `${error.stdout ?? ''}${error.stderr ?? ''}` };
  }
}
function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
function makeInventoryRepo() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aof-inventory-git-'));
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: tmp });
  execFileSync('git', ['config', 'user.name', 'Inventory Test'], { cwd: tmp });
  execFileSync('git', ['config', 'user.email', 'inventory@example.invalid'], { cwd: tmp });
  for (const rel of ['frontend/src/app.ts', 'game/godot/main.gd']) {
    fs.mkdirSync(path.dirname(path.join(tmp, rel)), { recursive: true });
    fs.writeFileSync(path.join(tmp, rel), '// tracked\n');
  }
  execFileSync('git', ['add', 'frontend', 'game'], { cwd: tmp });
  execFileSync('git', ['commit', '-q', '-m', 'initial inventory sources'], { cwd: tmp });

  // Baseline creation is explicit; then commit it so --check sees a committed,
  // clean snapshot rather than treating generated output as evidence by itself.
  const written = runNode(inventoryScript, ['--write', '--root', tmp], tmp);
  assert.equal(written.code, 0, written.out);
  execFileSync('git', ['add', INVENTORY], { cwd: tmp });
  execFileSync('git', ['commit', '-q', '-m', 'commit client inventory baseline'], { cwd: tmp });
  return tmp;
}
function withInventoryRepo(fn) {
  const tmp = makeInventoryRepo();
  try { return fn(tmp); } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}
const checkIn = (cwd) => runNode(inventoryScript, ['--check', '--root', cwd], cwd);
const writeIn = (cwd) => runNode(inventoryScript, ['--write', '--root', cwd], cwd);

test('инвентарь текущего checkout либо проходит, либо честно блокируется на несогласованном snapshot', () => {
  const before = fs.readFileSync(path.join(root, INVENTORY));
  const result = runNode(inventoryScript, ['--check']);
  if (result.code === 0) {
    const declared = Number(/Файлов: (\d+) \(/.exec(read(INVENTORY))?.[1]);
    assert.ok(declared > 0, 'в committed inventory обязан быть счётчик файлов');
    assert.match(result.out, new RegExp(`${declared} committed tracked-файлов`));
  } else {
    assert.match(result.out, /HEAD отсутствует|index не совпадает с HEAD|worktree не совпадает с index|untracked path|HEAD отстаёт от origin\/|HEAD и origin\/|CLIENT_INVENTORY\.txt отсутствует в committed HEAD/,
      'ошибка должна называть snapshot inconsistency, а не молча принимать старый index');
    assert.deepEqual(fs.readFileSync(path.join(root, INVENTORY)), before,
      '--check не должен автоматически переписывать baseline');
  }
});

test('инвентарь не содержит мусор, использует sha256 и bytewise-порядок', () => {
  const text = read(INVENTORY);
  assert.match(text, /sha256: [0-9a-f]{64}/);
  // Legacy inventory remains visible but is rejected by the new clean-snapshot gate until explicitly refreshed.
  assert.match(text, /git (?:ls-tree -r HEAD|ls-files) -- frontend game/);
  assert.doesNotMatch(text, /find frontend -maxdepth|find game -maxdepth/, 'сырой find-дамп не должен быть источником истины');
  const lines = text.split('\n');
  const start = lines.indexOf('```') + 1;
  const end = lines.lastIndexOf('```');
  const files = lines.slice(start, end).filter(Boolean);
  for (const file of files) {
    assert.doesNotMatch(file, /node_modules|\/Users\/|\/home\/|(^|\/)(dist|build|out|coverage|target)(\/|$)|(^|\/)\.(next|turbo|cache|venv)(\/|$)|^\//, `мусор в inventory: ${file}`);
  }
  const byteSorted = [...files].sort((a, b) => Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8')));
  assert.deepEqual(files, byteSorted, 'пути обязаны быть отсортированы по UTF-8 bytes');
});

test('чистый committed HEAD даёт воспроизводимый inventory check', () => {
  withInventoryRepo((tmp) => {
    const result = checkIn(tmp);
    assert.equal(result.code, 0, result.out);
    assert.match(result.out, /HEAD\/index\/worktree согласованы/);
  });
});

test('устаревший baseline не переписывается check; явная запись возможна только после commit источников', () => {
  withInventoryRepo((tmp) => {
    const before = fs.readFileSync(path.join(tmp, INVENTORY));
    fs.mkdirSync(path.join(tmp, 'frontend/src'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'frontend/src/new-client.ts'), 'export const added = true;\n');
    execFileSync('git', ['add', 'frontend/src/new-client.ts'], { cwd: tmp });
    execFileSync('git', ['commit', '-q', '-m', 'add client source'], { cwd: tmp });

    const stale = checkIn(tmp);
    assert.equal(stale.code, 1, stale.out);
    assert.match(stale.out, /CLIENT_INVENTORY\.txt устарел/);
    assert.deepEqual(fs.readFileSync(path.join(tmp, INVENTORY)), before,
      '--check не должен маскировать stale baseline через автоматическую перегенерацию');

    const rebuilt = writeIn(tmp);
    assert.equal(rebuilt.code, 0, rebuilt.out);
    const rewritten = fs.readFileSync(path.join(tmp, INVENTORY));
    assert.notDeepEqual(rewritten, before);
    assert.match(rewritten.toString('utf8'), /frontend\/src\/new-client\.ts/);

    const uncommittedBaseline = checkIn(tmp);
    assert.equal(uncommittedBaseline.code, 1, uncommittedBaseline.out);
    assert.match(uncommittedBaseline.out, /worktree не совпадает с index/);
    execFileSync('git', ['add', INVENTORY], { cwd: tmp });
    execFileSync('git', ['commit', '-q', '-m', 'refresh client inventory baseline'], { cwd: tmp });
    const fresh = checkIn(tmp);
    assert.equal(fresh.code, 0, fresh.out);
  });
});

test('staged, unstaged и untracked изменения блокируют check/write и не меняют baseline', () => {
  withInventoryRepo((tmp) => {
    const baselinePath = path.join(tmp, INVENTORY);
    const before = fs.readFileSync(baselinePath);
    const source = path.join(tmp, 'frontend/src/app.ts');

    fs.writeFileSync(source, '// staged change\n');
    execFileSync('git', ['add', 'frontend/src/app.ts'], { cwd: tmp });
    let result = checkIn(tmp);
    assert.equal(result.code, 1, result.out);
    assert.match(result.out, /index не совпадает с HEAD/);
    result = writeIn(tmp);
    assert.equal(result.code, 1, result.out);
    assert.deepEqual(fs.readFileSync(baselinePath), before);
    execFileSync('git', ['read-tree', 'HEAD'], { cwd: tmp });
    fs.writeFileSync(source, '// tracked\n');

    fs.writeFileSync(source, '// unstaged change\n');
    result = checkIn(tmp);
    assert.equal(result.code, 1, result.out);
    assert.match(result.out, /worktree не совпадает с index/);
    result = writeIn(tmp);
    assert.equal(result.code, 1, result.out);
    assert.deepEqual(fs.readFileSync(baselinePath), before);
    fs.writeFileSync(source, '// tracked\n');

    fs.writeFileSync(path.join(tmp, 'game/new-runtime.gd'), 'extends Node\n');
    result = checkIn(tmp);
    assert.equal(result.code, 1, result.out);
    assert.match(result.out, /untracked path/);
    result = writeIn(tmp);
    assert.equal(result.code, 1, result.out);
    assert.deepEqual(fs.readFileSync(baselinePath), before);
  });
});

test('HEAD, отстающий от известного origin branch ref, не используется для inventory', () => {
  withInventoryRepo((tmp) => {
    const base = git(tmp, ['rev-parse', 'HEAD']);
    fs.writeFileSync(path.join(tmp, 'remote-only-note.txt'), 'remote advances\n');
    execFileSync('git', ['add', 'remote-only-note.txt'], { cwd: tmp });
    const tree = git(tmp, ['write-tree']);
    const remoteCommit = git(tmp, ['commit-tree', tree, '-p', base, '-m', 'remote branch advances']);
    execFileSync('git', ['read-tree', base], { cwd: tmp });
    fs.rmSync(path.join(tmp, 'remote-only-note.txt'));
    execFileSync('git', ['update-ref', 'refs/remotes/origin/main', remoteCommit], { cwd: tmp });

    const before = fs.readFileSync(path.join(tmp, INVENTORY));
    const stale = checkIn(tmp);
    assert.equal(stale.code, 1, stale.out);
    assert.match(stale.out, /HEAD отстаёт от origin\/main/);
    assert.deepEqual(fs.readFileSync(path.join(tmp, INVENTORY)), before);
    const refusedWrite = writeIn(tmp);
    assert.equal(refusedWrite.code, 1, refusedWrite.out);
    assert.deepEqual(fs.readFileSync(path.join(tmp, INVENTORY)), before);
  });
});

test('IDL не содержит осиротевших записей', () => {
  const result = runPy([]);
  assert.equal(result.code, 0, result.out);
  assert.match(result.out, /чисто \(6 IDL/);
});

test('удаление нужного типа из исходников роняет гейт осиротевших записей', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aof-inventory-'));
  try {
    for (const rel of ['aof_backend/src/idl', 'aof-core/src', 'programs']) {
      const from = path.join(root, rel);
      if (fs.existsSync(from)) fs.cpSync(from, path.join(tmp, rel), { recursive: true, filter: (src) => !/node_modules|\/target(\/|$)/.test(src) });
    }
    const idlPath = path.join(tmp, 'aof_backend/src/idl/aof_market.json');
    const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
    idl.accounts.push({ name: 'GhostAccount', discriminator: [1, 2, 3, 4, 5, 6, 7, 8] });
    fs.writeFileSync(idlPath, `${JSON.stringify(idl, null, 2)}\n`);
    const result = runPy(['--root', tmp], tmp);
    assert.equal(result.code, 1, result.out);
    assert.match(result.out, /осиротевшая запись accounts\/GhostAccount/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('общий тип, который ещё используется, не считается осиротевшим', () => {
  const idl = JSON.parse(read('aof_backend/src/idl/aof_market.json'));
  assert.ok(idl.types.some((t) => t.name === 'Currency'), 'Currency — общий тип, он должен остаться в IDL');
  const src = fs.readFileSync(path.join(root, 'programs/aof-market/src/state.rs'), 'utf8');
  assert.ok(src.includes('enum Currency'), 'Currency по-прежнему объявлен в исходниках');
});
