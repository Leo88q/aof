#!/usr/bin/env node
/**
 * Ensure local dev environment is ready for `anchor test`
 * - seeds target/idl from aof_backend/src/idl
 * - creates solana/keys/aof-authority-devnet.json if missing (throwaway wallet)
 * - checks ANCHOR_PROVIDER_URL / validator
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const root = process.cwd();

function log(msg) { console.log(`[ensure-env] ${msg}`); }

// 1. IDL
const srcDir = path.join(root, 'aof_backend', 'src', 'idl');
const dstDir = path.join(root, 'target', 'idl');
if (fs.existsSync(srcDir)) {
  fs.mkdirSync(dstDir, { recursive: true });
  const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.json'));
  for (const file of files) {
    fs.copyFileSync(path.join(srcDir, file), path.join(dstDir, file));
    log(`seeded IDL ${file}`);
  }
} else {
  log(`WARN: ${srcDir} not found, skipping IDL seeding`);
}

// 2. Wallet
const walletPath = path.join(root, 'solana', 'keys', 'aof-authority-devnet.json');
if (!fs.existsSync(walletPath)) {
  log(`wallet not found at ${walletPath}, creating throwaway keypair...`);
  fs.mkdirSync(path.dirname(walletPath), { recursive: true });
  try {
    execSync(`solana-keygen new --silent --no-bip39-passphrase --force -o "${walletPath}"`, { stdio: 'inherit' });
    log(`created wallet ${walletPath}`);
  } catch (e) {
    log(`solana-keygen failed, trying to create empty placeholder (you need to run solana-keygen manually)`);
    // create dummy file so anchor doesn't crash with "Unable to read keypair file"
    // This will still fail later but with clearer message
    try {
      execSync(`which solana-keygen`, { stdio: 'ignore' });
    } catch {
      log(`ERROR: solana CLI not in PATH. Install Agave 4.2.1: https://release.anza.xyz/v4.2.1/install`);
    }
  }
} else {
  log(`wallet exists: ${walletPath}`);
}

// 3. Check validator / provider
const providerUrl = process.env.ANCHOR_PROVIDER_URL;
if (!providerUrl) {
  log(`ANCHOR_PROVIDER_URL not set (normal for anchor test, it starts its own validator)`);
  log(`If you run mocha directly, you need:`);
  log(`  solana-test-validator --reset (in separate terminal)`);
  log(`  export ANCHOR_PROVIDER_URL=http://127.0.0.1:8899`);
  log(`  export ANCHOR_WALLET=${walletPath}`);
} else {
  log(`ANCHOR_PROVIDER_URL=${providerUrl}`);
}

log(`done. You can now run:`);
log(`  anchor test --skip-build`);
log(`or`);
log(`  anchor build --no-idl && anchor test --skip-build`);
