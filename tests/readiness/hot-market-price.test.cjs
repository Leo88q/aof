const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.join(__dirname, '../..');

async function loadPrice() {
  const source = fs.readFileSync(path.join(root, 'aof_backend/src/lib/hotMarketPrice.ts'), 'utf8')
    .replace(/type IntLike = [\s\S]*?;\n/, '')
    .replace(/export type HotPoolQuote = \{[\s\S]*?\};\n/, '')
    .replace(/: IntLike|: bigint|: "core" \| "gem"|: number|: HotPoolQuote/g, '');
  const file = path.join(os.tmpdir(), 'aof-hot-market-price.mjs');
  fs.writeFileSync(file, source);
  return import(file);
}

test('цена пула считается целым делением, как в программе', async () => {
  const { applyGrowth, applyDecay, poolTradePrice, scaleAtoms } = await loadPrice();
  assert.equal(applyGrowth(1_000n, 500n, 1n), 1_050n);
  assert.equal(applyGrowth(10n, 1n, 1n), 10n);
  assert.equal(applyDecay(1_050n, 1_000n, 1_000n, 1n), 1_000n);
  const pool = {
    targetPriceCore: 1_000n,
    targetPriceGem: 2_000n,
    growthBpsPerSale: 0,
    decayBpsPerHour: 0,
    purchasesInWindow: 3,
    lastTradeTs: 10_000n,
    hotWindowEndTs: 20_000n,
    hotMultiplierBps: 1_000,
  };
  assert.equal(poolTradePrice(pool, 'core', 15_000n), 1_100n);
  assert.equal(poolTradePrice(pool, 'gem', 20_000n), 2_000n);
  assert.equal(scaleAtoms(1_250_000_000n, 9), 1.25);
});

test('крутилка зовёт crank_market, индексатор читает hot_pool', () => {
  const cranker = fs.readFileSync(path.join(root, 'aof_backend/services/price-cranker/index.ts'), 'utf8');
  const indexer = fs.readFileSync(path.join(root, 'aof_backend/services/indexer/priceTracker.ts'), 'utf8');
  assert.match(cranker, /\.crankMarket\(rarity\)/);
  assert.match(cranker, /accounts\(\{ pool \}\)/);
  assert.match(cranker, /const RARITIES = \[0, 1, 2, 3\]/);
  assert.doesNotMatch(cranker, /hotMarketCrank/);
  assert.match(indexer, /hotMarketPoolPda\(rarity\)/);
  assert.match(indexer, /poolTradePrice\(pool, "core"/);
  assert.doesNotMatch(indexer, /hot_market_pool|currentPriceMascot|currentPriceSolLamports/);
});
