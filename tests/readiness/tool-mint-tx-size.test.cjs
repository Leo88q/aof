'use strict';
// Direct craft/fuse instructions are too close to Solana's 1,232-byte legacy
// packet limit to preserve the required 64-byte headroom after Metadata. Model the concrete
// account aliases used by the backend and require a v0 transaction with the
// shared Devnet ALT plus 64 bytes of size headroom. This is source-only; it does
// not inspect a live lookup table or submit/simulate a transaction.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const idl = JSON.parse(read('aof_backend/src/idl/aof_core.json'));
const PACKET_DATA_SIZE = 1232;
const MAX_WITH_HEADROOM = 1168;
const LOOKUP_KEYS = new Set([
  'config', 'auth', 'tool_metadata_registry', 'token_metadata_program',
  'token_program', 'system_program', 'craft_economy', 'rarity_counter',
  'circuit_mint', 'silicon_mint', 'data_mint', 'neuron_mint', 'power_mint', 'mind_mint',
]);
const PRIMITIVE = { u8: 1, i8: 1, bool: 1, u16: 2, i16: 2, u32: 4, i32: 4, u64: 8, i64: 8, u128: 16, i128: 16, pubkey: 32 };

function typeSize(type) {
  if (typeof type === 'string') {
    if (!(type in PRIMITIVE)) throw new Error(`variable-size IDL argument: ${type}`);
    return PRIMITIVE[type];
  }
  if (type.defined) {
    const name = typeof type.defined === 'string' ? type.defined : type.defined.name;
    const definition = idl.types.find((entry) => entry.name === name).type;
    if (definition.kind === 'enum') {
      return 1 + Math.max(0, ...definition.variants.map((variant) =>
        (variant.fields || []).reduce((sum, field) => sum + typeSize(field.type || field), 0)));
    }
    if (definition.kind === 'struct') return definition.fields.reduce((sum, field) => sum + typeSize(field.type), 0);
  }
  if (type.array) return typeSize(type.array[0]) * type.array[1];
  throw new Error(`unsupported IDL argument: ${JSON.stringify(type)}`);
}

const compact = (value) => value < 0x80 ? 1 : value < 0x4000 ? 2 : 3;

function measure(ix, kind, toolTypeLength = 20) {
  const argBytes = ix.args.reduce((sum, arg) => {
    if (arg.type === 'string') return sum + 4 + toolTypeLength;
    return sum + typeSize(arg.type);
  }, 0);
  const dataBytes = 8 + argBytes;
  const aliases = (name) => {
    if (name === 'user') return 'fee_payer';
    if (kind === 'craft' && name === 'skr_mint') return 'data_mint';
    if (kind === 'craft' && name === 'user_skr') return 'user_data';
    return name;
  };
  const keys = new Set(['fee_payer', 'program:core', ...ix.accounts.map((account) => aliases(account.name))]);
  const signerKeys = new Set(['fee_payer', ...ix.accounts.filter((account) => account.signer).map((account) => aliases(account.name))]);
  const signatures = ix.accounts.filter((account) => account.signer).length;
  const bodyBytes = 1 + compact(ix.accounts.length) + ix.accounts.length + compact(dataBytes) + dataBytes;
  const legacyBytes = compact(signatures) + signatures * 64 + 3 + compact(keys.size) + keys.size * 32 + 32 +
    compact(1) + bodyBytes;

  const loaded = [...keys].filter((key) => LOOKUP_KEYS.has(key) && !signerKeys.has(key));
  const staticCount = keys.size - loaded.length;
  const writableNames = new Set(ix.accounts.filter((account) => account.writable).map((account) => aliases(account.name)));
  const loadedWritable = loaded.filter((key) => writableNames.has(key));
  const loadedReadonly = loaded.length - loadedWritable.length;
  const lookupBytes = compact(1) + 32 + compact(loadedWritable.length) + loadedWritable.length +
    compact(loadedReadonly) + loadedReadonly;
  const v0Bytes = compact(signatures) + signatures * 64 + 1 + 3 + compact(staticCount) + staticCount * 32 + 32 +
    compact(1) + bodyBytes + lookupBytes;
  return { legacyBytes, v0Bytes, keys: keys.size, loaded: loaded.length, dataBytes };
}

for (const kind of ['craft', 'reroll']) {
  test(`aof_core.${kind}: legacy lacks headroom; lookup-table v0 fits safely`, () => {
    const ix = idl.instructions.find((instruction) => instruction.name === kind);
    assert.ok(ix, `${kind} instruction is present in committed IDL`);
    const size = measure(ix, kind);
    assert.ok(size.legacyBytes > MAX_WITH_HEADROOM,
      `legacy must leave at least 64 bytes below the ${PACKET_DATA_SIZE}-byte packet cap (${size.legacyBytes} bytes, ${size.keys} distinct keys)`);
    assert.ok(size.v0Bytes <= MAX_WITH_HEADROOM,
      `v0 estimate ${size.v0Bytes} bytes must fit below ${MAX_WITH_HEADROOM} (loaded ${size.loaded} keys)`);

    const route = kind === 'craft' ? read('aof_backend/src/routes/tools.ts') : read('aof_backend/src/routes/reroll.ts');
    assert.match(route, /coSignWithVrfLookupTableQuoted\(\[ix\], user,/,
      `${kind} uses a v0 builder with a transaction-bound payer quote`);
  });
}

test('Devnet ALT initializer includes static craft/fuse account families used by the size model', () => {
  const initializer = read('aof_backend/scripts/initVrfAddressLookupTable.ts');
  assert.match(initializer, /craftEconomyPda\(\)\[0\]/);
  assert.match(initializer, /Array\.from\(\{ length: 5 \}, \(_, rarity\) => rarityCounterPda\(rarity\)\[0\]\)/);
  for (const key of ['neuronMint', 'powerMint', 'mindMint']) {
    assert.match(initializer, new RegExp(`config\\.${key} as PublicKey`));
  }
});
