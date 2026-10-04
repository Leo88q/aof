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
