'use strict';
/*
 * Канонический манифест ресурсов (scripts/resource-manifest.mjs): Rust ResourceKind, IDL-имена,
 * места хранения минтов и farming-алиасы обязаны быть сведены в один документ, а расхождения —
 * перечислены поимённо (это долг пункта 12). Манифест не имеет права «протухнуть» молча, и
 * farming-слово не имеет права попасть в player-facing `display`.
 *
 * Тесты мутируют временную копию: «зелёный» гейт нельзя получить, отключив проверку.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const script = path.join(root, 'scripts/resource-manifest.mjs');
const MANIFEST = 'docs/RESOURCE_MANIFEST.json';
const MANIFEST_MD = 'docs/RESOURCE_MANIFEST.md';

const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

function run(args, cwd = root) {
  try {
    const stdout = execFileSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, out: stdout };
  } catch (error) {
    return { code: error.status ?? 1, out: `${error.stdout ?? ''}${error.stderr ?? ''}` };
  }
}

/** Копия репозитория в объёме, который читает resource-manifest.mjs. */
function makeRoot() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aof-resources-'));
  for (const rel of ['aof-core/src', 'aof_backend/src/idl', 'aof_backend/src/routes', 'docs']) {
    fs.cpSync(path.join(root, rel), path.join(tmp, rel), {
      recursive: true,
      filter: (src) => !/node_modules|\/target(\/|$)/.test(src),
    });
  }
  return tmp;
}
const edit = (tmp, rel, fn) => { const p = path.join(tmp, rel); fs.writeFileSync(p, fn(fs.readFileSync(p, 'utf8'))); };
const editJson = (tmp, rel, fn) => edit(tmp, rel, (text) => `${JSON.stringify(fn(JSON.parse(text)), null, 2)}\n`);
const withRoot = (fn) => { const tmp = makeRoot(); try { return fn(tmp); } finally { fs.rmSync(tmp, { recursive: true, force: true }); } };

test('репозиторий проходит гейт: 27 ресурсов, 43 расхождения с каноном — долг пункта 12', () => {
  const result = run(['--check']);
  assert.equal(result.code, 0, result.out);
  assert.match(result.out, /27 ресурсов, расхождений до переименования: 43/);
});

test('манифест описывает все 27 вариантов и точно называет долг', () => {
  const manifest = JSON.parse(read(MANIFEST));
  assert.equal(manifest.resources.length, 27);
  assert.deepEqual(manifest.resources.map((r) => r.id), [...Array(27).keys()]);
  assert.equal(manifest.resources[0].kind, 'Data');
  assert.equal(manifest.resources[26].kind, 'Mind');
  const byType = new Map();
  for (const d of manifest.drift) byType.set(d.type, (byType.get(d.type) ?? 0) + 1);
  assert.deepEqual([...byType.entries()].sort(), [['backend-legacy-name', 16], ['idl-variant-name', 27]]);
  const backendFiles = new Set(manifest.drift.filter((d) => d.type === 'backend-legacy-name').map((d) => d.file));
  assert.deepEqual([...backendFiles], ['aof_backend/src/routes/resources.ts']);
  for (const r of manifest.resources) {
    assert.ok(r.display && r.apiName && r.mintSource && r.legacyField, `${r.kind}: неполная запись`);
    assert.equal(r.idlRename, 'pending', `${r.kind}: расхождение IDL обязано быть помечено`);
  }
});

test('переименование в IDL без обновления манифеста роняет гейт', () => {
  withRoot((tmp) => {
    editJson(tmp, 'aof_backend/src/idl/aof_core.json', (idl) => {
      const kind = idl.types.find((t) => t.name === 'ResourceKind');
      kind.type.variants[0].name = 'Data'; // код «исправили», манифест — нет
      return idl;
    });
    const result = run(['--check', '--root', tmp]);
    assert.equal(result.code, 1, result.out);
    assert.match(result.out, /drift в манифесте не совпадает с кодом/);
  });
});

test('запись, порядок и IDL-долг манифеста проверяются по коду', () => {
  const cases = [
    [(m) => { m.resources = m.resources.filter((r) => r.kind !== 'Circuit'); }, /нет записи для ResourceKind::Circuit/],
    [(m) => { m.resources[0].mintSource = 'config.wood_mint'; }, /mintSource .* а mint_for_kind даёт/],
    [(m) => { m.resources[0].idlRename = 'canonical'; }, /IDL-имя .* расходится с Rust — idlRename обязан быть pending/],
    [(m) => { m.resources[0].display = ''; }, /нет player-facing display/],
    [(m) => { m.resources[1].display = 'Farm wood'; }, /farming-алиас 'wood' в player-facing display/],
    [(m) => { m.resources.pop(); }, /в манифесте 26 ресурсов, а в enum — 27/],
  ];
  for (const [mutate, pattern] of cases) {
    withRoot((tmp) => {
      editJson(tmp, MANIFEST, (m) => { mutate(m); return m; });
      const result = run(['--check', '--root', tmp]);
      assert.equal(result.code, 1, `ожидался отказ для ${pattern}: ${result.out}`);
      assert.match(result.out, pattern);
    });
  }
});

test('гейт требует манифест и свежий markdown', () => {
  withRoot((tmp) => {
    fs.rmSync(path.join(tmp, MANIFEST));
    const result = run(['--check', '--root', tmp]);
    assert.equal(result.code, 1);
    assert.match(result.out, /нет docs\/RESOURCE_MANIFEST\.json/);
  });
  withRoot((tmp) => {
    fs.appendFileSync(path.join(tmp, MANIFEST_MD), '\nустаревшая строка\n');
    const result = run(['--check', '--root', tmp]);
    assert.equal(result.code, 1);
    assert.match(result.out, /docs\/RESOURCE_MANIFEST\.md устарел/);
  });
});

test('--write восстанавливает документ, --check его принимает', () => {
  withRoot((tmp) => {
    fs.rmSync(path.join(tmp, MANIFEST_MD));
    assert.equal(run(['--check', '--root', tmp]).code, 1);
    assert.equal(run(['--write', '--root', tmp]).code, 0);
    assert.equal(run(['--check', '--root', tmp]).code, 0);
  });
});
