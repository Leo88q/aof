'use strict';
// [F-06] Switchboard On-Demand integration pins.
//
// The Rust programs build Switchboard CPIs by hand (no Switchboard crate on
// this toolchain). These tests keep the hand-written builders byte-compatible
// with the published sb_on_demand IDL (docs/vendor/switchboard_on_demand_randomness.json)
// and keep the two per-program copies of vrf.rs identical.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const CORE = 'aof-core/src/vrf.rs';
const QUESTS = 'programs/aof-quests/src/vrf.rs';
const idl = JSON.parse(read('docs/vendor/switchboard_on_demand_randomness.json'));

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58(bytes) {
  let n = 0n;
  for (const b of bytes) n = n * 256n + BigInt(b);
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

function constKey(src, name) {
  const m = new RegExp(`pub const ${name}: Pubkey = Pubkey::new_from_array\\(\\[([\\s\\S]*?)\\]\\);`).exec(src);
  assert.ok(m, `${name} not found`);
  return b58(m[1].split(',').map((x) => x.trim()).filter(Boolean).map(Number));
}

function constBytes(src, name) {
  const m = new RegExp(`pub const ${name}: \\[u8; 8\\] = \\[([^\\]]*)\\];`).exec(src);
  assert.ok(m, `${name} not found`);
  return m[1].split(',').map((x) => Number(x.trim()));
}

/** Account metas of a `pub fn <name>_instruction` builder: [key expr, signer, writable]. */
function builderMetas(src, fn) {
  const start = src.indexOf(`pub fn ${fn}(`);
  assert.ok(start >= 0, `${fn} not found`);
  const body = src.slice(start, src.indexOf('\n}\n', start));
  return [...body.matchAll(/AccountMeta::(new|new_readonly)\(([^,]+), (true|false)\)/g)]
    .map((m) => [m[2].trim(), m[3] === 'true', m[1] === 'new']);
}

function idlAccounts(name) {
  const ix = idl.instructions.find((i) => i.name === name);
  assert.ok(ix, `${name} missing from the vendored IDL`);
  return ix.accounts.map((a) => [a.name, Boolean(a.signer), Boolean(a.writable)]);
}

const sha8 = (s) => [...crypto.createHash('sha256').update(s).digest().subarray(0, 8)];

test('F-06 discriminators are the IDL / Anchor-namespace hashes', () => {
  const src = read(CORE);
  const pairs = [
    ['RANDOMNESS_INIT_IX_DISCRIMINATOR', 'randomness_init', 'global'],
    ['RANDOMNESS_COMMIT_IX_DISCRIMINATOR', 'randomness_commit', 'global'],
    ['RANDOMNESS_REVEAL_IX_DISCRIMINATOR', 'randomness_reveal', 'global'],
  ];
  for (const [constant, name, ns] of pairs) {
    const expected = sha8(`${ns}:${name}`);
    assert.deepEqual(constBytes(src, constant), expected, constant);
    assert.deepEqual(idl.instructions.find((i) => i.name === name).discriminator, expected, `${name} in the vendored IDL`);
  }
  assert.deepEqual(constBytes(src, 'RANDOMNESS_ACCOUNT_DISCRIMINATOR'), sha8('account:RandomnessAccountData'));
});

test('F-06 CPI builders follow the IDL account order and signer/writable flags', () => {
  const src = read(CORE);
  for (const [fn, ix] of [['init_instruction', 'randomness_init'], ['commit_instruction', 'randomness_commit'],
    ['reveal_instruction', 'randomness_reveal']]) {
    const metas = builderMetas(src, fn);
    const expected = idlAccounts(ix);
    assert.equal(metas.length, expected.length, `${fn}: account count`);
    metas.forEach((m, i) => {
      assert.equal(m[1], expected[i][1], `${fn}[${i}] ${expected[i][0]}: signer flag`);
      assert.equal(m[2], expected[i][2], `${fn}[${i}] ${expected[i][0]}: writable flag`);
    });
  }
  // Reveal params layout: signature [u8;64], recovery_id u8, value [u8;32].
  const params = idl.types.find((t) => t.name === 'RandomnessRevealParams').type.fields;
  assert.deepEqual(params.map((f) => [f.name, JSON.stringify(f.type)]),
    [['signature', '{"array":["u8",64]}'], ['recovery_id', '"u8"'], ['value', '{"array":["u8",32]}']]);
  const vrfParams = /pub struct VrfRevealParams \{([\s\S]*?)\}/.exec(src)[1];
  assert.deepEqual([...vrfParams.matchAll(/pub (\w+): ([^,]+),/g)].map((m) => [m[1], m[2].trim()]),
    [['signature', '[u8; 64]'], ['recovery_id', 'u8'], ['value', '[u8; 32]']]);
  assert.match(read('docs/vendor/switchboard_on_demand_randomness.json'), /"name": "recent_slot"/);
});

test('F-06 randomness account offsets match the IDL layout', () => {
  const fields = idl.types.find((t) => t.name === 'RandomnessAccountData').type.fields;
  const size = (t) => (t === 'pubkey' ? 32 : t === 'u64' ? 8 : t.array ? t.array[1] : null);
  let at = 8;
  const offsets = {};
  for (const f of fields) {
    offsets[f.name] = at;
    at += size(f.type);
  }
  const src = read(CORE);
  const off = (name) => Number(new RegExp(`const ${name}: usize = (\\d+);`).exec(src)[1]);
  assert.equal(off('AUTHORITY_AT'), offsets.authority);
  assert.equal(off('QUEUE_AT'), offsets.queue);
  assert.equal(off('SEED_SLOT_AT'), offsets.seed_slot);
  assert.equal(off('ORACLE_AT'), offsets.oracle);
  assert.equal(off('REVEAL_SLOT_AT'), offsets.reveal_slot);
  assert.equal(off('VALUE_AT'), offsets.value);
  assert.ok(Number(/pub const RANDOMNESS_ACCOUNT_LEN: usize = (\d+);/.exec(src)[1]) <= at, 'minimum length within the account');
});

test('F-06 trusted program, queue and state are the published addresses', () => {
  const src = read(CORE);
  assert.equal(constKey(src, 'SWITCHBOARD_ON_DEMAND_MAINNET'), 'SBondMDrcV3K4kxZR1HNVT7osZxAHVHgYXL5Ze1oMUv');
  assert.equal(constKey(src, 'SWITCHBOARD_ON_DEMAND_DEVNET'), 'Aio4gaXjXzJNVLtzwtNVmSqGKpANtXhybbkhtAC94ji2');
  assert.equal(constKey(src, 'SWITCHBOARD_QUEUE_MAINNET'), 'A43DyUGA7s8eXPxqEjJY6EBu1KKbNgfxF8h17VAHn13w');
  assert.equal(constKey(src, 'SWITCHBOARD_QUEUE_DEVNET'), 'EYiAmGSdsQTuCw413V5BzaruWuCCSDgTPtBGvLkXHbe7');
  assert.equal(constKey(src, 'SWITCHBOARD_STATE_MAINNET'), '7Gs9n5FQMeC9XcEhg281bRZ6VHRrCvqp5Yq1j78HkvNa');
  assert.equal(constKey(src, 'SWITCHBOARD_STATE_DEVNET'), '4UFmCebEmzESoDTtHrmaftXj7YAsAH4HMios3yMWyVUT');
  assert.equal(constKey(src, 'ADDRESS_LOOKUP_TABLE_PROGRAM_ID'), 'AddressLookupTab1e1111111111111111111111111');
  // The backend / frontend use the same ids.
  const backend = read('aof_backend/src/lib/vrf.ts');
  for (const id of ['SBondMDrcV3K4kxZR1HNVT7osZxAHVHgYXL5Ze1oMUv', 'Aio4gaXjXzJNVLtzwtNVmSqGKpANtXhybbkhtAC94ji2',
    'A43DyUGA7s8eXPxqEjJY6EBu1KKbNgfxF8h17VAHn13w', 'EYiAmGSdsQTuCw413V5BzaruWuCCSDgTPtBGvLkXHbe7']) {
    assert.ok(backend.includes(id), `aof_backend/src/lib/vrf.ts lacks ${id}`);
  }
});

test('F-06 the aof-quests copy of vrf.rs is the aof-core module, not a fork', () => {
  const normalize = (src) => src
    .replace(/^\/\/![^\n]*\n/gm, '')
    .replace(/use crate::errors::(QuestError as AofError|AofError);/, 'use crate::errors::AofError;')
    .replace(/crate::constants::|crate::randomness::/g, '')
    .replace(/pub const (VRF_AUTHORITY_SEED|VRF_SLOT_SEED|VRF_RANDOMNESS_SEED|VRF_REFUND_AFTER_SLOTS|SLOT_HASHES_ID)[^\n]*\n/g, '')
    .replace(/\/\/\/ (Same reveal window|SlotHashes sysvar)[^\n]*\n/g, '')
    .replace(/\n\/\/\/ Rent the settler[\s\S]*$/, '\n')
    .replace(/\n\s*\n/g, '\n')
    .trim();
  assert.equal(normalize(read(QUESTS)), normalize(read(CORE)), 'regenerate programs/aof-quests/src/vrf.rs from aof-core/src/vrf.rs');
  const quests = read(QUESTS);
  assert.match(quests, /pub const VRF_REFUND_AFTER_SLOTS: u64 = 18_000;/);
  assert.match(read('aof-core/src/constants.rs'), /pub const VRF_REFUND_AFTER_SLOTS: u64 = 18_000;/);
});

test('F-06 the backend reveal path never forwards its RPC URL to the oracle gateway', () => {
  // The SDK's Randomness.revealIx POSTs connection.rpcEndpoint (usually with a
  // paid API key) to a third-party gateway and sleeps a fixed 3 s first.
  const backend = read('aof_backend/src/lib/vrf.ts');
  const settler = read('aof_backend/services/vrf-settler/index.ts');
  for (const [name, src] of [['lib/vrf.ts', backend], ['vrf-settler', settler]]) {
    assert.doesNotMatch(src, /\.revealIx\s*\(/, `${name} must not use the SDK revealIx`);
    assert.doesNotMatch(src, /commitAndReveal\s*\(/, `${name} must not use the SDK commitAndReveal`);
  }
  const body = backend.slice(backend.indexOf('export function revealRequestBody'), backend.indexOf('export function parseRevealResponse'));
  assert.match(body, /if \(rpc\) body\.rpc = rpc;/, 'rpc is opt-in');
  assert.doesNotMatch(backend, /revealRequestBody\([^)]*(\bRPC_URL\b|rpcEndpoint)/, 'never pass the backend RPC URL');
  assert.match(backend, /SWITCHBOARD_GATEWAY_RPC_URL/);
});

test('F-06 settlement instructions stay permissionless (the settler signs with a fee-only wallet)', () => {
  // vrf-settler holds no operator key (lib/settlerSigner.ts): every reveal,
  // expire and draw it sends must accept an arbitrary funded cranker.
  const settled = {
    aof_core: {
      source: ['aof-core/src/lib.rs'],
      ix: {
        pack_open_reveal: 'PackOpenReveal', pack_open_expire: 'PackOpenExpire',
        reroll_random_reveal: 'RerollRandomReveal', reroll_random_expire: 'RerollRandomExpire',
        explore_reveal: 'ExploreReveal', explore_expire: 'ExploreExpire',
        forge_attempt_reveal: 'ForgeAttemptReveal', forge_attempt_expire: 'ForgeAttemptExpire',
        draw_lottery: 'DrawLottery', expire_lottery_draw: 'ExpireLotteryDraw',
      },
    },
    aof_quests: {
      source: ['programs/aof-quests/src/instructions/drum/drum_reveal.rs', 'programs/aof-quests/src/instructions/drum/drum_expire.rs'],
      ix: { drum_reveal: 'DrumReveal', drum_expire: 'DrumExpire' },
    },
  };
  for (const [program, { source, ix }] of Object.entries(settled)) {
    const programIdl = JSON.parse(read(`aof_backend/src/idl/${program}.json`));
    const rust = source.map(read).join('\n');
    for (const [name, context] of Object.entries(ix)) {
      const entry = programIdl.instructions.find((i) => i.name === name);
      assert.ok(entry, `${program}.${name} is in the IDL`);
      const signers = entry.accounts.filter((a) => a.signer).map((a) => a.name);
      assert.ok(signers.every((s) => s === 'cranker'), `${program}.${name}: only an arbitrary cranker may sign, got ${signers}`);
      const body = new RegExp(`pub struct ${context}<'info> \\{([\\s\\S]*?)\\n\\}`).exec(rust);
      assert.ok(body, `${context} context found`);
      const field = /((?:#\[account\([^\]]*\)\]\s*)*)pub cranker: Signer<'info>/.exec(body[1]);
      if (signers.length) {
        assert.ok(field, `${context}.cranker`);
        assert.equal(field[1].trim(), '#[account(mut)]', `${context}.cranker must stay unconstrained (mut only)`);
      }
    }
  }
  // The only cranker/operator comparison is the lottery draw COMMIT (not a
  // settlement): the operator may close sales early, anyone after 7 days.
  const handlers = fs.readdirSync(path.join(root, 'aof-core/src/instructions')).map((f) => `aof-core/src/instructions/${f}`)
    .concat(['programs/aof-quests/src/instructions/drum/drum_reveal.rs', 'programs/aof-quests/src/instructions/drum/drum_expire.rs']);
  for (const file of handlers) {
    const src = read(file);
    const hits = [...src.matchAll(/cranker\.key\(\)\s*[!=]=/g)];
    if (file.endsWith('/lottery.rs')) {
      assert.equal(hits.length, 1, 'lottery.rs: one cranker comparison (commit_draw_handler)');
      const commitDraw = /pub fn commit_draw_handler[\s\S]*?\n\}/.exec(src)[0];
      assert.match(commitDraw, /cranker\.key\(\)\s*==\s*ctx\.accounts\.config\.operator/);
    } else {
      assert.equal(hits.length, 0, `${file}: settlement handlers must not gate on the cranker`);
    }
  }
});
