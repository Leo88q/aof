'use strict';
// Offsite backup must not look successful when the operator asked for one and
// the tool is missing. The VPS layout must keep the settler off the operator key.
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const script = path.join(root, 'scripts/backup-offsite.sh');

function run(env, args) {
  return spawnSync('bash', [script, ...args], { env, encoding: 'utf8' });
}

test('BACKUP_S3_URI unset does not call an uploader', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aof-backup-'));
  const calls = path.join(dir, 'calls');
  const bin = path.join(dir, 'bin');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'aws'), `#!/bin/sh\necho "$@" >> ${JSON.stringify(calls)}\n`, { mode: 0o755 });
  const file = path.join(dir, 'aof-test.db.gz');
  fs.writeFileSync(file, 'not-a-real-gzip');
  const result = run({ PATH: `${bin}:/usr/bin:/bin`, HOME: dir }, [file]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(calls), false);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('BACKUP_S3_URI set without aws or rclone fails and keeps the local file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aof-backup-'));
  const file = path.join(dir, 'aof-test.db.gz');
  fs.writeFileSync(file, 'not-a-real-gzip');
  const result = run({ PATH: '/usr/bin:/bin', HOME: dir, BACKUP_S3_URI: 's3://bucket/aof/mainnet' }, [file]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /neither aws nor rclone/);
  assert.equal(fs.readFileSync(file, 'utf8'), 'not-a-real-gzip');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('BACKUP_S3_URI uploads the artifact and its checksum via aws, not rclone', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aof-backup-'));
  const calls = path.join(dir, 'calls');
  const bin = path.join(dir, 'bin');
  fs.mkdirSync(bin);
  const stub = `#!/bin/sh\necho "$0 $*" >> ${JSON.stringify(calls)}\n`;
  fs.writeFileSync(path.join(bin, 'aws'), stub, { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'rclone'), stub, { mode: 0o755 });
  const file = path.join(dir, 'aof-test.db.gz');
  fs.writeFileSync(file, 'gzip-bytes');
  fs.writeFileSync(file + '.sha256', 'abc  aof-test.db.gz\n');
  const result = run({
    PATH: `${bin}:/usr/bin:/bin`,
    HOME: dir,
    BACKUP_S3_URI: 's3://bucket/aof/mainnet/',
  }, [file]);
  assert.equal(result.status, 0, result.stderr);
  const log = fs.readFileSync(calls, 'utf8');
  assert.match(log, /aws s3 cp/);
  assert.match(log, /s3:\/\/bucket\/aof\/mainnet\/aof-test\.db\.gz\n/);
  assert.match(log, /aof-test\.db\.gz\.sha256/);
  assert.doesNotMatch(log, /rclone/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('the shared VPS layout does not merge the settler into the API or move its key', () => {
  const layout = fs.readFileSync(path.join(root, 'docs/VPS_CLOUDFLARE_LAYOUT.md'), 'utf8');
  assert.match(layout, /vrf-settler/);
  assert.match(layout, /secrets\/vrf_settler_secret_key/);
  assert.match(layout, /AUTHORITY_MODE=read-only/);
  assert.match(layout, /Redis не нужен/);
  assert.match(layout, /AOF_SKR_CRAFT=live/);
  assert.match(layout, /AOF_RANDOMNESS/);
  assert.match(fs.readFileSync(path.join(root, 'scripts/backup-db.sh'), 'utf8'), /backup-offsite\.sh/);
  assert.match(fs.readFileSync(path.join(root, 'ops/nginx/aof.conf.example'), 'utf8'), /127\.0\.0\.1:8080/);
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'ops/nginx/aof.conf.example'), 'utf8'), /listen 8080/);
});
