'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'aof_backend/scripts/miningDevnetPreflight.ts'), 'utf8');

test('mining devnet preflight uses the selected private RPC, not the public fallback', () => {
  assert.match(source, /import\s+['"]dotenv\/config['"]/,
    'standalone preflight must load aof_backend/.env');
  assert.match(source,
    /process\.env\.DEVNET_RPC_URL\s*\|\|\s*process\.env\.RPC_URL\s*\|\|\s*['"]https:\/\/api\.devnet\.solana\.com['"]?/,
    'prefer DEVNET_RPC_URL, then the umbrella RPC_URL, and use public devnet only as the last resort');
});

test('raw Borsh snake_case fields are normalized before mining, mint and cap checks', () => {
  const idl = require(path.join(root, 'aof_backend/src/idl/aof_core.json'));
  const fields = name => idl.types.find(type => type.name === name).type.fields.map(field => field.name);
  assert.ok(fields('Config').includes('mining_enabled'));
  assert.ok(fields('Config').includes('circuit_mint'));
  assert.ok(fields('Config').includes('silicon_mint'));
  assert.ok(fields('MaterialMints').includes('max_supply'));

  const normalizer = fs.readFileSync(path.join(root, 'aof_backend/src/lib/miningPreflightAccounts.ts'), 'utf8');
  for (const line of [
    'miningEnabled: rawConfig.mining_enabled',
    'circuitMint: rawConfig.circuit_mint',
    'siliconMint: rawConfig.silicon_mint',
    'maxSupply: rawMaterialMints.max_supply',
  ]) assert.ok(normalizer.includes(line), `нет адаптации ${line}`);
  assert.match(source, /normalizeMiningPreflightAccounts\(rawConfig,\s*rawMaterialMints\)/);
  assert.match(source, /typeof cfg\.miningEnabled !== 'boolean'/,
    'нечитаемый флаг должен иметь отдельный blocker, а не выдаваться за true');
});
