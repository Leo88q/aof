'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function writeEnv(dir, extra = '') {
  const body = [
    'AOF_CLUSTER=mainnet',
    'RPC_URL=https://rpc.example.com',
    'CORS_ORIGIN=https://app.example.com',
    'WALLET_PROOF_DOMAIN=app.example.com',
    'AUTHORITY_PUBKEY=pubkey',
    'PROGRAM_ID=program',
    'TREASURY_PUBKEY=treasury',
    'EXPECTED_GENESIS_HASH=genesis',
    'ADMIN_TOKEN=0123456789abcdef0123456789abcdef',
    extra,
  ].filter(Boolean).join('\n') + '\n';
  const file = path.join(dir, 'backend.env');
  fs.writeFileSync(file, body);
  return file;
}

function settlerKey(dir, mode = 0o600) {
  const secrets = path.join(dir, 'secrets');
  fs.mkdirSync(secrets, { recursive: true, mode: 0o700 });
  const key = path.join(secrets, 'vrf_settler_secret_key');
  fs.writeFileSync(key, JSON.stringify(Array.from({ length: 64 }, (_, i) => i)) + '\n', { mode });
  fs.chmodSync(key, mode);
  return secrets;
}

function run(script, args, env) {
  return spawnSync('bash', [path.join(root, script), ...args], {
    cwd: root,
    env: { PATH: '/usr/bin:/bin', HOME: os.tmpdir(), ...env },
    encoding: 'utf8',
  });
}

test('ops/up --check accepts a read-only mainnet fixture and does not use the operator overlay', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aof-up-'));
  const result = run('ops/up.sh', ['--check'], {
    AOF_ENV_FILE: writeEnv(dir),
    AOF_SECRETS_DIR: settlerKey(dir),
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /docker-compose\.vps\.yml/);
  assert.doesNotMatch(result.stdout, /docker-compose\.secrets\.yml/);
  assert.match(result.stdout, /not starting containers/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('ops/up refuses closed flags, a devnet RPC on mainnet, a loose key, and the operator file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aof-up-'));
  const secrets = settlerKey(dir);
  const live = run('ops/up.sh', ['--check'], {
    AOF_ENV_FILE: writeEnv(dir, 'AOF_SKR_CRAFT=live'),
    AOF_SECRETS_DIR: secrets,
  });
  assert.notEqual(live.status, 0);
  assert.match(live.stderr, /AOF_SKR_CRAFT=live/);

  const randomness = run('ops/up.sh', ['--check'], {
    AOF_ENV_FILE: writeEnv(dir, 'AOF_RANDOMNESS=slot-hash'),
    AOF_SECRETS_DIR: secrets,
  });
  assert.match(randomness.stderr, /AOF_RANDOMNESS/);

  const badRpc = writeEnv(dir, 'RPC_URL=https://api.devnet.solana.com').replace('backend.env', 'bad-rpc.env');
  fs.writeFileSync(badRpc, fs.readFileSync(path.join(dir, 'backend.env'), 'utf8').replace(
    'RPC_URL=https://rpc.example.com',
    'RPC_URL=https://api.devnet.solana.com',
  ));
  const rpcResult = run('ops/up.sh', ['--check'], { AOF_ENV_FILE: badRpc, AOF_SECRETS_DIR: secrets });
  assert.match(rpcResult.stderr, /devnet/);

  fs.chmodSync(path.join(secrets, 'vrf_settler_secret_key'), 0o644);
  const loose = run('ops/up.sh', ['--check'], {
    AOF_ENV_FILE: writeEnv(dir),
    AOF_SECRETS_DIR: secrets,
  });
  assert.match(loose.stderr, /mode is 644/);
  fs.chmodSync(path.join(secrets, 'vrf_settler_secret_key'), 0o600);
  fs.writeFileSync(path.join(secrets, 'authority_secret_key'), 'nope\n', { mode: 0o600 });
  const operator = run('ops/up.sh', ['--check'], {
    AOF_ENV_FILE: writeEnv(dir),
    AOF_SECRETS_DIR: secrets,
  });
  assert.match(operator.stderr, /operator key/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('ops/up --apply does not start containers without a pinned release', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aof-up-'));
  const result = run('ops/up.sh', ['--apply'], {
    AOF_ENV_FILE: writeEnv(dir),
    AOF_SECRETS_DIR: settlerKey(dir),
    PATH: '/usr/bin:/bin',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /release\.sha/);
  assert.doesNotMatch(result.stdout, /Creating|Started/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('static build refuses a mainnet bundle pointed at devnet and does not call npm', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aof-fe-'));
  const env = path.join(dir, 'frontend.env');
  fs.writeFileSync(env, 'VITE_API_URL=/api\nVITE_RPC_URL=https://api.devnet.solana.com\nVITE_WALLET_PROOF_DOMAIN=app.example.com\n');
  const called = path.join(dir, 'npm');
  fs.writeFileSync(called, '#!/bin/sh\necho called > "$HOME/npm-called"\n', { mode: 0o755 });
  const result = run('ops/build-static.sh', ['mainnet'], {
    AOF_FRONTEND_ENV: env,
    PATH: `${dir}:/usr/bin:/bin`,
    HOME: dir,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /devnet/);
  assert.equal(fs.existsSync(path.join(dir, 'npm-called')), false);

  fs.writeFileSync(env, 'VITE_API_URL=/api\nVITE_RPC_URL=https://rpc.example.com/?api-key=secret\nVITE_WALLET_PROOF_DOMAIN=app.example.com\n');
  const keyed = run('ops/build-static.sh', ['mainnet'], {
    AOF_FRONTEND_ENV: env,
    PATH: `${dir}:/usr/bin:/bin`,
    HOME: dir,
  });
  assert.notEqual(keyed.status, 0);
  assert.match(keyed.stderr, /credentials/);
  assert.equal(fs.existsSync(path.join(dir, 'npm-called')), false);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('Cloudflare range refresh fails closed and does not keep a partial file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aof-cf-'));
  const bin = path.join(dir, 'bin');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'curl'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  const dest = path.join(dir, 'ranges.conf');
  const failed = spawnSync('bash', [path.join(root, 'ops/nginx/refresh-cloudflare-ips.sh'), dest], {
    env: { PATH: `${bin}:/usr/bin:/bin`, HOME: dir },
    encoding: 'utf8',
  });
  assert.notEqual(failed.status, 0);
  assert.equal(fs.existsSync(dest), false);

  fs.writeFileSync(path.join(bin, 'curl'), `#!/bin/sh
url=""
for arg in "$@"; do url="$arg"; done
case "$url" in
  *ips-v4*)
    i=0
    while [ "$i" -lt 12 ]; do echo "10.$i.0.0/24"; i=$((i+1)); done
    ;;
  *ips-v6*) echo "2001:db8::/32" ;;
  *) exit 1 ;;
esac
`, { mode: 0o755 });
  const ok = spawnSync('bash', [path.join(root, 'ops/nginx/refresh-cloudflare-ips.sh'), dest], {
    env: { PATH: `${bin}:/usr/bin:/bin`, HOME: dir },
    encoding: 'utf8',
  });
  assert.equal(ok.status, 0, ok.stderr);
  const written = fs.readFileSync(dest, 'utf8');
  assert.match(written, /set_real_ip_from 10\.0\.0\.0\/24;/);
  assert.match(written, /set_real_ip_from 2001:db8::\/32;/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('nginx install check and repo preflight do not write outside the checkout', () => {
  const install = run('ops/nginx/install.sh', ['--check'], {});
  assert.equal(install.status, 0, install.stderr);
  const preflight = run('ops/preflight.sh', [], {});
  assert.equal(preflight.status, 0, preflight.stderr);
  assert.match(preflight.stdout, /no box was started/);
});

test('ops/up refuses a symlink, an empty settler key, and a testnet RPC on mainnet', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aof-up-holes-'));
  const linked = path.join(dir, 'linked');
  fs.mkdirSync(linked);
  fs.symlinkSync(path.join(settlerKey(dir), 'vrf_settler_secret_key'), path.join(linked, 'vrf_settler_secret_key'));
  const linkResult = run('ops/up.sh', ['--check'], { AOF_ENV_FILE: writeEnv(dir), AOF_SECRETS_DIR: linked });
  assert.notEqual(linkResult.status, 0);
  assert.match(linkResult.stderr, /symlink/);

  const empty = path.join(dir, 'empty');
  fs.mkdirSync(empty);
  fs.writeFileSync(path.join(empty, 'vrf_settler_secret_key'), '', { mode: 0o600 });
  const emptyResult = run('ops/up.sh', ['--check'], { AOF_ENV_FILE: writeEnv(dir), AOF_SECRETS_DIR: empty });
  assert.notEqual(emptyResult.status, 0);
  assert.match(emptyResult.stderr, /empty/);

  const testnetFile = writeEnv(dir).replace('backend.env', 'testnet.env');
  fs.writeFileSync(testnetFile, fs.readFileSync(path.join(dir, 'backend.env'), 'utf8').replace(
    'RPC_URL=https://rpc.example.com',
    'RPC_URL=https://api.testnet.solana.com',
  ));
  const testnet = run('ops/up.sh', ['--check'], { AOF_ENV_FILE: testnetFile, AOF_SECRETS_DIR: settlerKey(dir) });
  assert.notEqual(testnet.status, 0);
  assert.match(testnet.stderr, /testnet/);
  fs.rmSync(dir, { recursive: true, force: true });
});

