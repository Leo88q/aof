const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.join(__dirname, '../..');

async function loadDecoder() {
  const source = fs.readFileSync(path.join(root, 'aof_backend/src/lib/laboratoryFinale.ts'), 'utf8')
    .replace(/export type[\s\S]*?;\n/, '')
    .replace(/: Buffer|: Uint8Array \| null|: Uint8Array|: LaboratoryFinaleDecode/g, '');
  const file = path.join(os.tmpdir(), 'aof-laboratory-finale.mjs');
  fs.writeFileSync(file, source);
  return import(file);
}

test('счётчик печатей: нет счёта — ноль, битый счёт — не ноль', async () => {
  const { decodeLaboratoryFinale, laboratoryFinaleDiscriminator, LABORATORY_FINALE_ACCOUNT_SIZE } = await loadDecoder();
  const owner = Buffer.alloc(32, 7);
  assert.equal(LABORATORY_FINALE_ACCOUNT_SIZE, 45);
  assert.deepEqual(
    laboratoryFinaleDiscriminator(),
    createHash('sha256').update('account:LaboratoryFinale').digest().subarray(0, 8),
  );
  assert.deepEqual(decodeLaboratoryFinale(null, owner), { ok: true, exists: false, seals: 0 });

  const account = Buffer.alloc(45);
  laboratoryFinaleDiscriminator().copy(account, 0);
  owner.copy(account, 8);
  account.writeUInt32LE(3, 40);
  account[44] = 1;
  assert.deepEqual(decodeLaboratoryFinale(account, owner), { ok: true, exists: true, seals: 3 });

  const foreign = Buffer.from(account);
  foreign[8] = 9;
  assert.equal(decodeLaboratoryFinale(foreign, owner).ok, false);
  assert.equal(decodeLaboratoryFinale(account.subarray(0, 44), owner).ok, false);
  const wrongDisc = Buffer.from(account);
  wrongDisc[0] ^= 1;
  assert.equal(decodeLaboratoryFinale(wrongDisc, owner).ok, false);
});

test('экран конца читает счётчик и не подменяет отказ нулём', () => {
  const page = fs.readFileSync(path.join(root, 'frontend/src/pages/farm/FinalePage.tsx'), 'utf8');
  const route = fs.readFileSync(path.join(root, 'aof_backend/src/routes/query.ts'), 'utf8');
  assert.match(page, /api\.query\.laboratoryFinale\(address\)/);
  assert.match(page, /copy\.sealsUnread/);
  assert.match(page, /copy\.sealsNone/);
  assert.match(page, /copy\.sealsHeld\(seals\.count\)/);
  assert.match(route, /r\.get\("\/laboratory-finale\/:owner"/);
  assert.match(route, /LABORATORY_FINALE_READ_FAILED/);
  assert.doesNotMatch(page, /seals \?\? 0|seals \|\| 0/);
});
