'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'aof_backend/scripts/initMintsV2.ts'), 'utf8');

test('resource mint bootstrap refuses wrong clusters before any SPL mint creation', () => {
  const genesisCheck = source.indexOf('if (genesis !== DEVNET_GENESIS)');
  const createMint = source.indexOf('createMintWithRetry(connection, name)');
  assert.ok(genesisCheck >= 0 && createMint > genesisCheck);
  assert.match(source, /RPC is not devnet/);
});

test('an existing resource registry is fully validated and never replaced by new mints', () => {
  const existingCheck = source.indexOf('if (await existingResourceMints(connection)) return;');
  const createMint = source.indexOf('createMintWithRetry(connection, name)');
  assert.ok(existingCheck >= 0 && createMint > existingCheck);
  assert.match(source, /getAccountInfo\(MATERIAL_MINTS_ADDRESS/);
  assert.match(source, /validateCanonicalResourceRegistry\(connection, config, materialMints, MINT_AUTHORITY\)/);
  assert.match(source, /refusing to create replacement mints/);
  assert.match(source, /CIRCUIT.*SILICON.*DATASET.*NEURON/s);
});
