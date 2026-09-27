#!/usr/bin/env node
/**
 * Seed target/idl from committed backend IDLs.
 * Anchor's IDL builder is upstream-blocked (anchor-syn 0.30.1 needs
 * proc_macro2::Span::source_file which was removed in proc-macro2 1.0.95,
 * but 1.0.94 fails on newer rustc with `SourceFile not found`).
 * CI uses the same workaround and marks idl_build as continue-on-error.
 *
 * This script copies aof_backend/src/idl/*.json -> target/idl/*.json
 * so `anchor test` and tests/aof_core.ts can run without regenerating IDL.
 */
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { seedIdl } = require('./seed-idl.cjs');

// Program ids are patched to the target/deploy keypairs (what `anchor test`
// deploys); without a build the committed ids are kept.
const seeded = seedIdl({ root: process.cwd(), log: (m) => console.log(`[ensure-idl] ${m}`) });
if (seeded === 0) {
  console.error('[ensure-idl] no IDL seeded from aof_backend/src/idl');
  process.exit(1);
}
console.log(`[ensure-idl] done: ${seeded} IDL(s) seeded. If you need fresh IDL, run anchor build --no-idl and regenerate manually (currently blocked upstream).`);
