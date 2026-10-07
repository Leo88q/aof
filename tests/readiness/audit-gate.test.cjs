'use strict';
/*
 * [SECURITY_CHECKLIST #66] The dependency audit gate must stay honest for
 * cyclic advisory graphs. npm builds cycles (metro <-> metro-config,
 * react-native <-> @react-native/virtualized-lists); a coverage check that
 * treats a back edge as "unreviewed" can never be satisfied by any allowlist
 * entry, which turns the gate into a permanent red for the whole repository.
 * The rule in the gate header is "every reachable high/critical advisory is
 * reviewed"; the self-test pins that semantics for chains, cycles, reviewed and
 * unreviewed leaves. The live npm audit itself runs as its own CI step.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const script = path.join(root, 'scripts/audit-gate.mjs');

function run(args) {
  try {
    return { code: 0, out: execFileSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8' }) };
  } catch (error) {
    return { code: error.status ?? 1, out: `${error.stdout ?? ''}${error.stderr ?? ''}` };
  }
}

test('audit gate: циклы advisory-графа покрываются allowlist, а не вечным отказом', () => {
  const result = run(['--self-test']);
  assert.equal(result.code, 0, result.out);
  assert.match(result.out, /8 cases \(chains, cycles, allowlist, moderate\) passed/);
});
