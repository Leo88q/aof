#!/usr/bin/env node
/**
 * CJS fallback for ensure-idl.mjs — same logic, works when ESM loader fails
 * Seed target/idl from committed backend IDLs.
 */
const { seedIdl } = require('./seed-idl.cjs');

// Program ids are patched to the target/deploy keypairs (what `anchor test`
// deploys); without a build the committed ids are kept.
const seeded = seedIdl({ root: process.cwd(), log: (m) => console.log(`[ensure-idl] ${m}`) });
if (seeded === 0) {
  console.error('[ensure-idl] no IDL seeded from aof_backend/src/idl');
  process.exit(1);
}
console.log(`[ensure-idl] done: ${seeded} IDL(s) seeded.`);
