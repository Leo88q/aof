'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const script = path.join(root, 'scripts/resource-drift.mjs');
function check() {
  try {
    return { code: 0, out: execFileSync(process.execPath, [script, '--check'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
  } catch (error) {
    return { code: error.status ?? 1, out: `${error.stdout ?? ''}${error.stderr ?? ''}` };
  }
}

test('all six resource-drift metrics and the committed report are current', () => {
  const result = check();
  assert.equal(result.code, 0, result.out);
  assert.match(result.out, /all required metrics are zero/);
});
