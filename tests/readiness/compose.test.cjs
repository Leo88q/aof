'use strict';
// [F-06] The production compose files must parse (docker compose reads the
// whole file even for `up -d backend vrf-settler`), every override must target
// services the base defines, and the mandatory VRF settler must be wired with
// its signing key and a liveness check.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const composeFiles = fs.readdirSync(root).filter((f) => /^docker-compose.*\.ya?ml$/.test(f));

/** Duplicate keys inside one block mapping (a YAML error docker compose rejects). */
function duplicateKeys(text) {
  const problems = [];
  const stack = [];
  text.split('\n').forEach((raw, i) => {
    if (!raw.trim() || raw.trim().startsWith('#')) return;
    const indent = raw.length - raw.trimStart().length;
    const item = /^( *)- ([A-Za-z0-9_.<-]+):(\s|$)/.exec(raw);
    const key = item ? null : /^( *)([A-Za-z0-9_.<-]+):(\s|$)/.exec(raw);
    if (item) {
      while (stack.length && stack[stack.length - 1].indent >= indent + 2) stack.pop();
      stack.push({ indent: indent + 2, keys: new Set([item[2]]) });
      return;
    }
    if (!key) return;
    while (stack.length && stack[stack.length - 1].indent > indent) stack.pop();
    const top = stack[stack.length - 1];
    if (top && top.indent === indent) {
      if (top.keys.has(key[2])) problems.push(`line ${i + 1}: duplicate key "${key[2]}"`);
      top.keys.add(key[2]);
    } else {
      stack.push({ indent, keys: new Set([key[2]]) });
    }
  });
  return problems;
}

/** Top-level service names (two-space indented keys under `services:`). */
function services(text) {
  const out = [];
  let inServices = false;
  for (const line of text.split('\n')) {
    if (/^services:\s*$/.test(line)) { inServices = true; continue; }
    if (/^\S/.test(line)) inServices = false;
    const m = inServices && /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line);
    if (m) out.push(m[1]);
  }
  return out;
}

function serviceBlock(text, name) {
  const start = text.indexOf(`\n  ${name}:\n`);
  if (start < 0) return null;
  const rest = text.slice(start + 1);
  const next = rest.slice(1).search(/\n {2}[A-Za-z0-9_-]+:\n|\n\S/);
  return next < 0 ? rest : rest.slice(0, next + 1);
}

test('F-06 detector catches the corruption it guards against', () => {
  assert.deepEqual(duplicateKeys('services:\n  a:\n    profiles: [x]\n    depends_on:\n      b:\n    profiles: [y]\n'), ['line 6: duplicate key "profiles"']);
  assert.deepEqual(duplicateKeys('services:\n  a:\n    env_file:\n      - path: x\n        required: false\n      - path: y\n'), []);
});

for (const file of composeFiles) {
  test(`F-06 ${file} has no duplicate keys`, () => {
    assert.deepEqual(duplicateKeys(read(file)), []);
  });
}

test('F-06 overrides only target services of the production base', () => {
  const base = new Set(services(read('docker-compose.prod.yml')));
  for (const file of composeFiles.filter((f) => f !== 'docker-compose.prod.yml')) {
    for (const name of services(read(file))) {
      if (file === 'docker-compose.postgres.yml' && name === 'postgres') continue;
      assert.ok(base.has(name), `${file}: service "${name}" is not defined in docker-compose.prod.yml`);
    }
  }
});

test('F-06 vrf-settler is mandatory, signs with the secret key and has a liveness check', () => {
  const prod = read('docker-compose.prod.yml');
  const settler = serviceBlock(prod, 'vrf-settler');
  assert.ok(settler, 'vrf-settler service');
  assert.doesNotMatch(settler, /profiles:/, 'the settler starts by default, not behind a profile');
  assert.match(settler, /dist-workers\/services\/vrf-settler\/index\.js/);
  assert.match(settler, /healthcheck:[\s\S]*vrf-settler\.heartbeat/);
  assert.match(settler, /restart: unless-stopped/);
  const secrets = serviceBlock(read('docker-compose.secrets.yml'), 'vrf-settler');
  assert.ok(secrets, 'docker-compose.secrets.yml gives the settler the operator key');
  assert.match(secrets, /AUTHORITY_SECRET_KEY_FILE: \/run\/secrets\/authority_secret_key/);
  for (const file of composeFiles) assert.doesNotMatch(read(file), /commit-expirer/, `${file}: the removed worker is still referenced`);
});
