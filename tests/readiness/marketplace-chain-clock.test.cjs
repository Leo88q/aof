'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');

for (const file of ['tests/aof_core.ts', 'tests/aof_extended.ts']) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  test(`${file} builds marketplace quote deadlines from the validator Clock sysvar`, () => {
    assert.match(source, /SYSVAR_CLOCK_PUBKEY/,
      'marketplace tests must read the on-chain Clock sysvar');
    assert.match(source, /readBigInt64LE\(32\)/,
      'Clock.unix_timestamp is the signed i64 at byte offset 32');
    assert.match(source, /new BN\(\(await chainUnixTimestamp\(\)\) \+ 120\)/,
      'bounded marketplace quote deadline must use validator time');
  });
}
