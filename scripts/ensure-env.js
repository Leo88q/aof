#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = process.cwd();
function log(m){console.log(`[ensure-env] ${m}`);}
// IDL, address patched to the target/deploy keypair (see seed-idl.cjs).
require('./seed-idl.cjs').seedIdl({ root, log });
const walletPath = path.join(root,'solana','keys','aof-authority-devnet.json');
if(!fs.existsSync(walletPath)){
  log(`wallet not found at ${walletPath}, creating...`);
  fs.mkdirSync(path.dirname(walletPath),{recursive:true});
  try{execSync(`solana-keygen new --silent --no-bip39-passphrase --force -o "${walletPath}"`,{stdio:'inherit'}); log(`created ${walletPath}`);}catch(e){log(`solana-keygen failed: ${e.message}`);}
}else log(`wallet exists: ${walletPath}`);
log(`done. Run: anchor test --skip-build`);
