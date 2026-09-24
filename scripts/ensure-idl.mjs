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
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const srcDir = path.join(root, 'aof_backend', 'src', 'idl');
const dstDir = path.join(root, 'target', 'idl');

if (!fs.existsSync(srcDir)) {
  console.error(`[ensure-idl] source dir not found: ${srcDir}`);
  process.exit(1);
}

fs.mkdirSync(dstDir, { recursive: true });

const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.json'));
if (files.length === 0) {
  console.error(`[ensure-idl] no json files in ${srcDir}`);
  process.exit(1);
}

let seeded = 0;
for (const file of files) {
  const src = path.join(srcDir, file);
  const dst = path.join(dstDir, file);
  // For localnet, keep the canonical address from committed IDL.
  // CI patches address to match generated keypairs; local dev uses
  // the real devnet ids from Anchor.toml, which already match committed IDLs.
  fs.copyFileSync(src, dst);
  console.log(`[ensure-idl] seeded ${file} -> target/idl/${file}`);
  seeded++;
}

console.log(`[ensure-idl] done: ${seeded} IDL(s) seeded. If you need fresh IDL, run anchor build --no-idl and regenerate manually (currently blocked upstream).`);
