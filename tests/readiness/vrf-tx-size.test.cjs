'use strict';
// [F-06] Every VRF instruction must fit the Solana packet limit with headroom.
// Exploration commit/reveal/refund are atomic v0 transactions using the
// provisioned VRF address lookup table; the other mechanics remain legacy.
// Reveals include two ComputeBudget instructions (CU limit + priority fee).
// Each symbolic account name is a distinct address except explicit ATA aliases.
// Expiry models four absent player ATAs and their top-level idempotent creates.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const PACKET_DATA_SIZE = 1232;
const HEADROOM = 64; // room for one more account plus slack
const VRF_LOOKUP_ADDRESSES = new Set([
  'program:core', 'program:AssociatedToken', 'program:ComputeBudget',
  'token_metadata_program', 'tool_metadata_registry',
  'config', 'material_mints', 'auth', 'data_mint', 'circuit_mint', 'silicon_mint', 'dataset_mint',
  'escrow_data', 'escrow_circuit', 'escrow_silicon', 'escrow_dataset',
  'issuance_cap_circuit', 'issuance_cap_silicon', 'vrf_authority', 'queue', 'recent_slothashes',
  'switchboard_program', 'token_program', 'associated_token_program', 'system_program',
  'wrapped_sol_mint', 'program_state',
]);

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

function instructionMessageParts(instructions) {
  const keys = new Set(['fee_payer']);
  let body = 0;
  for (const ix of instructions) {
    keys.add(`program:${ix.program}`);
    ix.accounts.forEach((a) => keys.add(a));
    body += 1 + compact(ix.accounts.length) + ix.accounts.length + compact(ix.data) + ix.data;
  }
  return { keys, body };
}

function legacyTxSize(instructions, signatures) {
  // The fee payer is kept distinct from the player in this worst-case model;
  // aliases shared by ATA setup and the core instruction remain one key.
  const { keys, body } = instructionMessageParts(instructions);
  const sigs = Math.max(1, signatures);
  return compact(sigs) + 64 * sigs + 3 + compact(keys.size) + 32 * keys.size + 32 + compact(instructions.length) + body;
}

function v0LookupTxSize(instructions, signatures, requiredSignerNames) {
  const { keys, body } = instructionMessageParts(instructions);
  // Signers and the fee payer are always static even if a table happens to
  // contain their addresses. Missing dynamic accounts stay static as well.
  // V0 compilers keep all invoked program IDs in static keys even if their
  // addresses also appear in the ALT. Include them here to match web3.js.
  const invokedPrograms = instructions.map((ix) => `program:${ix.program}`);
  const mustStayStatic = new Set(['fee_payer', ...requiredSignerNames, ...invokedPrograms]);
  const loaded = [...keys].filter((key) => VRF_LOOKUP_ADDRESSES.has(key) && !mustStayStatic.has(key));
  const staticKeyCount = keys.size - loaded.length;
  const sigs = Math.max(1, signatures);
  const lookupSection = compact(1) + 32 + compact(0) + compact(loaded.length) + loaded.length;
  return compact(sigs) + 64 * sigs + 1 + 3 + compact(staticKeyCount) + 32 * staticKeyCount + 32 +
    compact(instructions.length) + body + lookupSection;
}

for (const [file, program] of [['aof_core.json', 'core'], ['aof_quests.json', 'quests']]) {
  const idl = JSON.parse(fs.readFileSync(path.join(root, 'aof_backend/src/idl', file), 'utf8'));
  const vrfInstructions = idl.instructions.filter((ix) => ix.accounts.some((a) => a.name === 'randomness' || a.name === 'vrf_slot'));

  test(`F-06 ${program}: VRF instructions are discovered from the IDL`, () => {
    const names = vrfInstructions.map((ix) => ix.name);
    if (program === 'quests') {
      assert.deepEqual(names, [], 'quests drum VRF instructions must stay deleted');
    } else {
      const expected = ['pack_open_commit', 'pack_open_reveal', 'reroll_random_commit', 'reroll_random_reveal', 'start_exploration_commit', 'explore_reveal', 'forge_attempt_commit', 'forge_attempt_reveal', 'commit_lottery_draw', 'draw_lottery', 'vrf_pool_add'];
      for (const name of expected) assert.ok(names.includes(name), `${name} missing`);
    }
  });

  for (const ix of vrfInstructions) {
    const useV0Lookup = program === 'core' &&
      ['start_exploration_commit', 'explore_reveal', 'explore_expire', 'pack_open_reveal', 'reroll_random_reveal'].includes(ix.name);
    test(`F-06 ${program}.${ix.name} fits ${useV0Lookup ? 'v0+ALT' : 'legacy'} transaction`, () => {
      const data = 8 + ix.args.reduce((n, a) => n + typeSize(a.type, idl), 0);
      const signers = ix.accounts.filter((a) => a.signer).length;
      const missingRefundAtaAccounts = ix.name === 'explore_expire'
        ? [
            ['user_data', 'data_mint'], ['user_circuit', 'circuit_mint'],
            ['user_silicon', 'silicon_mint'], ['user_dataset', 'dataset_mint'],
          ]
        : ix.name === 'forge_attempt_expire'
          ? [['user_circuit', 'circuit_mint'], ['user_silicon', 'silicon_mint']]
          : [];
      const ataSetup = missingRefundAtaAccounts.map(([recipientAta, mint]) => ({
        program: 'AssociatedToken',
        // Worst case: every refundable user ATA was closed. The payer, owner,
        // mint, and destination ATA deliberately alias their canonical keys in
        // the expiry instruction; setup is top-level, never an SBF CPI.
        accounts: ['fee_payer', recipientAta, 'user', mint, 'system_program', 'token_program'],
        data: 1,
      }));
      const instructions = [
        { program: 'ComputeBudget', accounts: [], data: 5 }, // setComputeUnitLimit
        { program: 'ComputeBudget', accounts: [], data: 9 }, // setComputeUnitPrice
        ...ataSetup,
        { program, accounts: ix.accounts.map((a) => a.name), data },
      ];
      const size = useV0Lookup
        ? v0LookupTxSize(instructions, signers, ix.accounts.filter((a) => a.signer).map((a) => a.name))
        : legacyTxSize(instructions, signers);
      assert.ok(size <= PACKET_DATA_SIZE - HEADROOM,
        `${ix.name}: ${size} bytes (limit ${PACKET_DATA_SIZE}, headroom ${HEADROOM}, transport ${useV0Lookup ? 'v0+ALT' : 'legacy'})`);
    });
  }
}
