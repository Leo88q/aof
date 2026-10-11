const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

test("treasury market cuts are the 8-10% band and still pay the treasury", () => {
  const constants = read("aof-core/src/constants.rs");
  const expected = {
    MARKETPLACE_FEE_BPS: "800",
    AUCTION_FEE_BPS: "1_000",
    OFFER_FEE_BPS: "800",
    RENTAL_FEE_BPS: "1_000",
    ORDERBOOK_MAKER_FEE_BPS: "200",
    ORDERBOOK_TAKER_FEE_BPS: "600",
    CRAFT_ORDER_FEE_BPS: "800",
  };
  for (const [name, value] of Object.entries(expected)) {
    assert.match(constants, new RegExp(`pub const ${name}: u16 = ${value};`));
  }
  assert.match(constants, /RENTAL_MAX_OWNER_SPLIT_BPS: u16 = 10_000 - RENTAL_FEE_BPS/);
  assert.match(read("programs/aof-market/src/tools.rs"), /MARKET_TREASURY_FEE_MIN_BPS\.\.=crate::constants::MARKET_TREASURY_FEE_MAX_BPS/);
  assert.match(read("aof-core/src/instructions/marketplace.rs"), /split_bps\(price, MARKETPLACE_FEE_BPS\)/);
  assert.doesNotMatch(read("frontend/src/i18n/resourceCatalogCopy.ts"), /не имеют отдельных эффектов|have no separate effect|não têm efeito separado|no tienen un efecto aparte|không có tác dụng riêng|tidak punya efek terpisah|walang hiwalay na epekto/);
});

test("durability enchant enters the same subtraction and a session still costs one", () => {
  const source = read("aof-core/src/instructions/collect_mining.rs");
  assert.match(source, /fn durability_loss\(hours: u8, level: u8\)/);
  assert.match(source, /hours\.saturating_sub\(level\)/);
  assert.match(source, /if loss == 0 \{ 1 \} else \{ loss \}/);
  assert.match(source, /DURABILITY_ENCHANT_SLOT: u8 = 1/);
  assert.match(read("aof_backend/src/routes/tools.ts"), /enchantSlotPda\(mint, 1\)/);
  assert.match(read("frontend/src/lib/transactionIntent.ts"), /collect_mining_delegated/);
});

test("screens name the existing chain moments without inventing a drop", () => {
  const copy = read("frontend/src/i18n/chainMomentCopy.ts");
  assert.match(copy, /75/);
  assert.match(copy, /35/);
  assert.match(copy, /50/);
  assert.match(copy, /\+\$\{gain\}/);
  assert.match(read("aof-core/src/constants.rs"), /TRIP_COST_DATA: u64 = 75 \* RESOURCE_UNIT/);
  assert.match(read("aof-core/src/constants.rs"), /TRIP_COST_CIRCUIT: u64 = 35 \* RESOURCE_UNIT/);
  assert.match(read("aof-core/src/constants.rs"), /TRIP_COST_SILICON: u64 = 35 \* RESOURCE_UNIT/);
  assert.match(read("aof-core/src/constants.rs"), /TRIP_COST_DATASET: u64 = 50 \* RESOURCE_UNIT/);
  assert.match(read("aof-core/src/constants.rs"), /FLASK_ENERGY_GAIN: \[u8; 5\] = \[5, 5, 8, 10, ENERGY_CAP\]/);
  assert.match(read("aof-core/src/constants.rs"), /ENERGY_CAP: u8 = 20/);
  assert.match(read("frontend/src/pages/farm/FinalePage.tsx"), /soulCoreSupply/);
  assert.doesNotMatch(read("frontend/src/i18n/chainMomentCopy.ts"), /сжигает ядро|burns the soul core|exploration fluid/i);
});
