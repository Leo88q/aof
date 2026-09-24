#!/usr/bin/env node
/**
 * CJS fallback for ensure-idl.mjs — same logic, works when ESM loader fails
 * Seed target/idl from committed backend IDLs.
 */
const fs = require('fs');
const path = require('path');

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
  fs.copyFileSync(src, dst);
  console.log(`[ensure-idl] seeded ${file} -> target/idl/${file}`);
  seeded++;
}

console.log(`[ensure-idl] done: ${seeded} IDL(s) seeded.`);
