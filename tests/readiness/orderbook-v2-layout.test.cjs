const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');

// Книга v2 читается `getProgramAccounts` с memcmp по адресу минта. Смещение
// зашито числом в routes/query.ts, и ошибка в нём не падает, а молча
// возвращает пустую книгу — то есть «заявок нет» там, где они есть. Этот тест
// выводит смещение из IDL (borsh: дискриминатор 8 байт, затем поля в порядке
// объявления) и сверяет с кодом.
const SIZE = { pubkey: 32, u64: 8, u8: 1, bool: 1 };

function offsets(typeName) {
  const idl = JSON.parse(fs.readFileSync(path.join(root, 'aof_backend/src/idl/aof_core.json'), 'utf8'));
  const entry = idl.types.find((t) => t.name === typeName);
  assert.ok(entry, `в IDL нет типа ${typeName}`);
  const out = {};
  let offset = 8; // discriminator
  for (const field of entry.type.fields) {
    out[field.name] = offset;
    const size = SIZE[typeof field.type === 'string' ? field.type : 'pubkey'];
    assert.ok(size, `${typeName}.${field.name}: неизвестный тип ${JSON.stringify(field.type)}`);
    offset += size;
  }
  return { offsets: out, space: offset };
}

test('ResourceOrderV2: минт остаётся на смещении, которое читает книга', () => {
  const { offsets: o, space } = offsets('ResourceOrderV2');
  assert.equal(o.maker, 8);
  assert.equal(o.price_lamports_per_whole, 42);
  assert.equal(o.amount_remaining, 50);
  assert.equal(o.mint, 58);
  assert.equal(o.escrow_lamports, 90);
  assert.equal(space, 99, 'размер аккаунта должен совпадать с RESOURCE_ORDER_V2_SPACE - 8');

  const query = fs.readFileSync(path.join(root, 'aof_backend/src/routes/query.ts'), 'utf8');
  const block = query.slice(query.indexOf('"/orderbook-v2/:mint"'));
  const memcmp = block.match(/memcmpFilter\((\d+), req\.params\.mint\)/);
  assert.ok(memcmp, 'маршрут /orderbook-v2/:mint должен фильтровать книгу по минту');
  assert.equal(Number(memcmp[1]), o.mint, 'смещение минта в маршруте разошлось с раскладкой аккаунта');
});

test('ResourceOrderV2: seed и пробелы объявлены в Rust и совпадают с клиентом', () => {
  const constants = fs.readFileSync(path.join(root, 'aof-core/src/constants.rs'), 'utf8');
  assert.match(constants, /RESOURCE_ORDER_V2_SEED: &\[u8\] = b"resource_order_v2"/);
  assert.match(constants, /RESOURCE_ORDER_V2_SPACE: usize = 8 \+ ResourceOrderV2::INIT_SPACE/);
  // v1 остаётся на своём seed: старые эскроу должны отменяться старыми
  // инструкциями, а не читаться как «заявок нет».
  assert.match(constants, /RESOURCE_ORDER_SEED: &\[u8\] = b"resource_order";/);

  const backendPda = fs.readFileSync(path.join(root, 'aof_backend/src/lib/pda.ts'), 'utf8');
  assert.match(backendPda, /resourceOrderV2Pda[\s\S]*enc\("resource_order_v2"\)/);
  const frontendIntent = fs.readFileSync(path.join(root, 'frontend/src/lib/transactionIntent.ts'), 'utf8');
  assert.match(frontendIntent, /resourceOrderV2|resource_order_v2/);
});
