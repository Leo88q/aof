#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = process.cwd();
function log(m){console.log(`[ensure-env] ${m}`);}
const srcDir = path.join(root,'aof_backend','src','idl');
const dstDir = path.join(root,'target','idl');
if(fs.existsSync(srcDir)){
  fs.mkdirSync(dstDir,{recursive:true});
  fs.readdirSync(srcDir).filter(f=>f.endsWith('.json')).forEach(f=>{
    fs.copyFileSync(path.join(srcDir,f), path.join(dstDir,f));
    log(`seeded IDL ${f}`);
  });
}
const walletPath = path.join(root,'solana','keys','aof-authority-devnet.json');
if(!fs.existsSync(walletPath)){
  log(`wallet not found at ${walletPath}, creating...`);
  fs.mkdirSync(path.dirname(walletPath),{recursive:true});
  try{execSync(`solana-keygen new --silent --no-bip39-passphrase --force -o "${walletPath}"`,{stdio:'inherit'}); log(`created ${walletPath}`);}catch(e){log(`solana-keygen failed: ${e.message}`);}
}else log(`wallet exists: ${walletPath}`);
log(`done. Run: anchor test --skip-build`);
