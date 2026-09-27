'use strict';
/**
 * Seed target/idl from the committed backend IDLs (aof_backend/src/idl) and
 * point every IDL at the program id `anchor test` actually deploys: the pubkey
 * of target/deploy/<name>-keypair.json, when that keypair exists.
 *
 * Why the address patch matters: CI builds the programs with generated
 * keypairs, and the committed IDLs carry the devnet ids. The workflow patched
 * target/idl, but the Anchor.toml test script then re-seeded it verbatim, so
 * the suite called ids that were never deployed on the local validator
 * ("Attempt to load a program that does not exist" in the first before-all
 * hook, on main as well). Locally the keypair is the ground truth too: it is
 * what `anchor test` deploys.
 *
 * Shared by scripts/ensure-env.{mjs,js} and scripts/ensure-idl.{mjs,js}.
 */
const fs = require('fs');
const path = require('path');

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58(bytes) {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let out = '';
  while (n > 0n) {
    out = ALPHABET[Number(n % 58n)] + out;
    n /= 58n;
  }
  for (const b of bytes) {
    if (b !== 0) break;
    out = '1' + out;
  }
  return out;
}

function keypairAddress(file) {
  const bytes = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(bytes) || bytes.length !== 64) {
    throw new Error(`${file}: expected a 64-byte keypair`);
  }
  return base58(bytes.slice(32));
}

function seedIdl({ root = process.cwd(), log = console.log } = {}) {
  const srcDir = path.join(root, 'aof_backend', 'src', 'idl');
  const dstDir = path.join(root, 'target', 'idl');
  const deployDir = path.join(root, 'target', 'deploy');
  if (!fs.existsSync(srcDir)) {
    log(`WARN: ${srcDir} not found, skipping IDL seeding`);
    return 0;
  }
  fs.mkdirSync(dstDir, { recursive: true });
  let seeded = 0;
  for (const file of fs.readdirSync(srcDir).filter((f) => f.endsWith('.json')).sort()) {
    const idl = JSON.parse(fs.readFileSync(path.join(srcDir, file), 'utf8'));
    const keypair = path.join(deployDir, file.replace(/\.json$/, '-keypair.json'));
    if (fs.existsSync(keypair)) {
      const built = keypairAddress(keypair);
      if (idl.address !== built) {
        log(`patched ${file}: address ${idl.address} -> ${built} (target/deploy keypair)`);
        idl.address = built;
        if (idl.metadata && typeof idl.metadata === 'object' && 'address' in idl.metadata) {
          idl.metadata.address = built;
        }
      }
    }
    fs.writeFileSync(path.join(dstDir, file), JSON.stringify(idl, null, 2) + '\n');
    log(`seeded IDL ${file}`);
    seeded += 1;
  }
  return seeded;
}

module.exports = { seedIdl, keypairAddress, base58 };
