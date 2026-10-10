const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('часы добычи совпадают с потолком редкости в программе', () => {
  const constants = read('aof-core/src/constants.rs');
  const expected = {
    common: /MAX_HOURS_COMMON: u8 = 8;/,
    uncommon: /MAX_HOURS_UNCOMMON: u8 = 12;/,
    rare: /MAX_HOURS_RARE: u8 = 14;/,
    epic: /MAX_HOURS_EPIC: u8 = 20;/,
    legendary: /MAX_HOURS_LEGENDARY: u8 = 20;/,
  };
  for (const pattern of Object.values(expected)) assert.match(constants, pattern);
  for (const file of ['frontend/src/lib/miningHours.ts', 'aof_backend/src/lib/miningHours.ts']) {
    const src = read(file);
    assert.match(src, /common: 8/);
    assert.match(src, /uncommon: 12/);
    assert.match(src, /rare: 14/);
    assert.match(src, /epic: 20/);
    assert.match(src, /legendary: 20/);
  }
  const card = read('frontend/src/components/ToolMiningCard.tsx');
  const route = read('aof_backend/src/routes/tools.ts');
  assert.match(card, /maxSelectableMiningHours\(tool\.rarity, durability\)/);
  assert.doesNotMatch(card, /Math\.min\(20, durability/);
  assert.match(route, /HOURS_EXCEED_RARITY_CAP/);
  assert.match(route, /rarityHourCap\(toolData\?\.rarity\)/);
});
