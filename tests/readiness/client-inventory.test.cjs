'use strict';
/*
 * Инвентарь клиентов (scripts/client-inventory.mjs) и осиротевшие записи IDL
 * (scripts/check-idl-orphans.py).
 *
 * Замечания владельца: (1) нельзя хранить environment-dependent дамп `find` — инвентарь
 * обязан строиться по tracked-файлам и быть воспроизводимым; (2) после удаления инструкций
 * IDL не должен накапливать осиротевшие accounts/types/events/errors, но и общий тип,
 * который ещё используется, удалять нельзя.
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
const withTmpCopy = (fn) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aof-inventory-'));
  try {
    for (const rel of ['docs', 'scripts/client-inventory.mjs', 'scripts/check-idl-orphans.py', 'aof_backend/src/idl', 'aof-core/src', 'programs']) {
      const from = path.join(root, rel);
      if (fs.existsSync(from)) fs.cpSync(from, path.join(tmp, rel), { recursive: true, filter: (src) => !/node_modules|\/target(\/|$)/.test(src) });
    }
    return fn(tmp);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
};

test('инвентарь клиентов воспроизводим и проходит гейт', () => {
  const result = runNode(inventoryScript, ['--check']);
  assert.equal(result.code, 0, result.out);
  assert.match(result.out, /605 tracked-файлов/);
});

test('в инвентаре нет environment-dependent мусора и есть sha256', () => {
  const text = read(INVENTORY);
  assert.match(text, /sha256: [0-9a-f]{64}/);
  assert.match(text, /git ls-files -- frontend game/);
  assert.doesNotMatch(text, /find frontend -maxdepth|find game -maxdepth/, 'сырой find-дамп не должен быть источником истины');
  const lines = text.split('\n');
  const start = lines.indexOf('```') + 1;
  const end = lines.lastIndexOf('```');
  const files = lines.slice(start, end).filter(Boolean);
  // проверяем именно список файлов, а не пояснительную шапку
  for (const file of files) {
    assert.doesNotMatch(file, /node_modules|\/Users\/|\/home\/|(^|\/)(dist|build|out|coverage|target)(\/|$)|(^|\/)\.(next|turbo|cache|venv)(\/|$)|^\//, `мусор в инвентаре: ${file}`);
  }
  assert.deepEqual(files, [...files].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)), 'файлы обязаны быть отсортированы байтово');
});

test('устаревший инвентарь роняет гейт, пересборка его чинит (на своём git-репозитории)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aof-inv-git-'));
  try {
    execFileSync('git', ['init', '-q'], { cwd: tmp });
    for (const rel of ['frontend/src/app.ts', 'game/godot/main.gd']) {
      fs.mkdirSync(path.dirname(path.join(tmp, rel)), { recursive: true });
      fs.writeFileSync(path.join(tmp, rel), '// tracked\n');
    }
    execFileSync('git', ['add', '-A'], { cwd: tmp });
    fs.mkdirSync(path.join(tmp, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(tmp, INVENTORY), 'устаревший дамп без sha256\n');
    const stale = runNode(inventoryScript, ['--check', '--root', tmp], tmp);
    assert.equal(stale.code, 1, stale.out);
    assert.match(stale.out, /устарел/);
    const rebuilt = runNode(inventoryScript, ['--write', '--root', tmp], tmp);
    assert.equal(rebuilt.code, 0, rebuilt.out);
    const fresh = runNode(inventoryScript, ['--check', '--root', tmp], tmp);
    assert.equal(fresh.code, 0, fresh.out);
    const text = fs.readFileSync(path.join(tmp, INVENTORY), 'utf8');
    assert.ok(text.includes('frontend/src/app.ts') && text.includes('game/godot/main.gd'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('IDL не содержит осиротевших записей', () => {
  const result = runPy([]);
  assert.equal(result.code, 0, result.out);
  assert.match(result.out, /чисто \(6 IDL/);
});

test('удаление нужного типа из исходников роняет гейт осиротевших записей', () => {
  withTmpCopy((tmp) => {
    const idlPath = path.join(tmp, 'aof_backend/src/idl/aof_market.json');
    const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
    idl.accounts.push({ name: 'GhostAccount', discriminator: [1, 2, 3, 4, 5, 6, 7, 8] });
    fs.writeFileSync(idlPath, `${JSON.stringify(idl, null, 2)}\n`);
    const result = runPy(['--root', tmp], tmp);
    assert.equal(result.code, 1, result.out);
    assert.match(result.out, /осиротевшая запись accounts\/GhostAccount/);
  });
});

test('общий тип, который ещё используется, не считается осиротевшим', () => {
  const idl = JSON.parse(read('aof_backend/src/idl/aof_market.json'));
  assert.ok(idl.types.some((t) => t.name === 'Currency'), 'Currency — общий тип, он должен остаться в IDL');
  const src = fs.readFileSync(path.join(root, 'programs/aof-market/src/state.rs'), 'utf8');
  assert.ok(src.includes('enum Currency'), 'Currency по-прежнему объявлен в исходниках');
});
