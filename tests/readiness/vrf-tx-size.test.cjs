'use strict';
// [F-06] Every VRF instruction must fit a legacy transaction (1232 bytes) with
// headroom. The backend builds legacy transactions (no lookup tables) and
// reveals add two ComputeBudget instructions (vrfComputeBudget: CU limit and
// priority fee). The bound assumes every account is distinct and both budget
// instructions for all of them (worst case); the fee payer is one of the
// instruction's signers (user or cranker).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const PACKET_DATA_SIZE = 1232;
const HEADROOM = 64; // room for one more account plus slack

const PRIMITIVE = { u8: 1, i8: 1, bool: 1, u16: 2, i16: 2, u32: 4, i32: 4, u64: 8, i64: 8, u128: 16, i128: 16, pubkey: 32 };

function typeSize(t, idl) {
  if (typeof t === 'string') {
    if (!(t in PRIMITIVE)) throw new Error(`variable-size arg type ${t}`);
    return PRIMITIVE[t];
  }
  if (t.array) return typeSize(t.array[0], idl) * t.array[1];
  if (t.option) return 1 + typeSize(t.option, idl);
  if (t.defined) {
    const name = typeof t.defined === 'string' ? t.defined : t.defined.name;
    const def = idl.types.find((x) => x.name === name).type;
    if (def.kind === 'struct') return def.fields.reduce((n, f) => n + typeSize(f.type, idl), 0);
    if (def.kind === 'enum') {
      return 1 + Math.max(0, ...def.variants.map((v) => (v.fields || []).reduce((n, f) => n + typeSize(f.type || f, idl), 0)));
    }
  }
  throw new Error(`unsupported type ${JSON.stringify(t)}`);
}

const compact = (n) => (n < 0x80 ? 1 : n < 0x4000 ? 2 : 3);

function legacyTxSize(instructions, signatures) {
  const keys = new Set(signatures > 0 ? [] : ['fee_payer']);
  let body = 0;
  for (const ix of instructions) {
    keys.add(`program:${ix.program}`);
    ix.accounts.forEach((a) => keys.add(`${ix.program}:${a}`));
    body += 1 + compact(ix.accounts.length) + ix.accounts.length + compact(ix.data) + ix.data;
  }
  const sigs = Math.max(1, signatures);
  return compact(sigs) + 64 * sigs + 3 + compact(keys.size) + 32 * keys.size + 32 + compact(instructions.length) + body;
}

for (const [file, program] of [['aof_core.json', 'core'], ['aof_quests.json', 'quests']]) {
  const idl = JSON.parse(fs.readFileSync(path.join(root, 'aof_backend/src/idl', file), 'utf8'));
  const vrfInstructions = idl.instructions.filter((ix) => ix.accounts.some((a) => a.name === 'randomness' || a.name === 'vrf_slot'));

  test(`F-06 ${program}: VRF instructions are discovered from the IDL`, () => {
    const names = vrfInstructions.map((ix) => ix.name);
    const expected = program === 'core'
      ? ['pack_open_commit', 'pack_open_reveal', 'reroll_random_commit', 'reroll_random_reveal', 'start_exploration_commit', 'explore_reveal', 'forge_attempt_commit', 'forge_attempt_reveal', 'commit_lottery_draw', 'draw_lottery', 'vrf_pool_add']
      : ['drum_commit', 'drum_reveal', 'vrf_pool_add'];
    for (const name of expected) assert.ok(names.includes(name), `${name} missing`);
  });

  for (const ix of vrfInstructions) {
    test(`F-06 ${program}.${ix.name} fits a legacy transaction`, () => {
      const data = 8 + ix.args.reduce((n, a) => n + typeSize(a.type, idl), 0);
      const signers = ix.accounts.filter((a) => a.signer).length;
      const size = legacyTxSize([
        { program: 'ComputeBudget', accounts: [], data: 5 }, // setComputeUnitLimit
        { program: 'ComputeBudget', accounts: [], data: 9 }, // setComputeUnitPrice
        { program, accounts: ix.accounts.map((a) => a.name), data },
      ], signers);
      assert.ok(size <= PACKET_DATA_SIZE - HEADROOM, `${ix.name}: ${size} bytes (limit ${PACKET_DATA_SIZE}, headroom ${HEADROOM})`);
    });
  }
}
