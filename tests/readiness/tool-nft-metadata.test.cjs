'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const metadataToolsPromise = import('../../aof_backend/scripts/toolNftMetadata.mjs');
test('load local tool metadata helpers', async () => {
  assert.ok(await metadataToolsPromise);
});

test('catalog covers exactly the 5 × 5 English tool variants and every artwork file exists', async () => {
  const metadataTools = await metadataToolsPromise;
  const variants = metadataTools.listToolNftVariants();
  assert.deepEqual(metadataTools.TOOL_TYPES.map((tool) => tool.name), [
    'Plasma Cutter', 'Silicon Extractor', 'Data Harvester', 'Quantum Transmitter', 'Neural Seeder',
  ]);
  assert.deepEqual(metadataTools.TOOL_RARITIES.map((rarity) => rarity.displayName), [
    'Base', 'Enhanced', 'Quantum', 'Singularity', 'Transcendent',
  ]);
  assert.equal(variants.length, 25);
  assert.equal(new Set(variants.map((variant) => variant.key)).size, 25);
  assert.equal(new Set(variants.map((variant) => variant.toolType)).size, 5);
  assert.deepEqual([...new Set(variants.map((variant) => variant.rarity))], [
    'common', 'uncommon', 'rare', 'epic', 'legendary',
  ]);
  for (const variant of variants) {
    const imagePath = path.join(root, 'frontend/public/assets/nfts', variant.imageFile);
    assert.ok(fs.existsSync(imagePath), `${variant.key} is missing ${variant.imageFile}`);
    assert.ok(fs.statSync(imagePath).size > 0, `${variant.key} artwork is empty`);
  }
  assert.deepEqual(
    variants.filter((variant) => variant.toolType === 'quantum_transmitter').map((variant) => variant.toolName),
    Array(5).fill('Quantum Transmitter'),
  );
});

test('metadata uses English traits and Arweave images; draft omits symbol/royalty fields until release values are explicit', async () => {
  const metadataTools = await metadataToolsPromise;
  const variants = metadataTools.listToolNftVariants();
  for (const variant of variants) {
    const imageUri = metadataTools.arweaveUrl('A'.repeat(43));
    const metadata = metadataTools.createToolNftMetadata({
      toolType: variant.toolType,
      rarity: variant.rarity,
      imageUri,
    });
    assert.equal(metadata.name, variant.toolName);
    assert.ok(Buffer.byteLength(metadata.name, 'utf8') <= 32, `${variant.key} exceeds Metaplex's 32-byte name limit`);
    assert.equal(metadata.image, imageUri);
    assert.equal(Object.hasOwn(metadata, 'seller_fee_basis_points'), false, 'draft helper does not silently apply release terms');
    const withApprovedFee = metadataTools.createToolNftMetadata({
      toolType: variant.toolType,
      rarity: variant.rarity,
      imageUri,
      sellerFeeBasisPoints: 0,
    });
    assert.equal(withApprovedFee.seller_fee_basis_points, 0, 'the approved Devnet release setting is zero bps');
    assert.throws(() => metadataTools.createToolNftMetadata({
      toolType: variant.toolType,
      rarity: variant.rarity,
      imageUri,
      sellerFeeBasisPoints: 10_001,
    }), /approved integer/);
    assert.equal(metadata.attributes.find((trait) => trait.trait_type === 'Rarity').value, variant.rarityName);
    assert.equal(metadata.attributes.find((trait) => trait.trait_type === 'Display Rarity').value, variant.displayRarity);
    assert.match(metadata.description, new RegExp(variant.displayRarity));
    assert.deepEqual(metadata.properties.files, [{ uri: imageUri, type: 'image/jpeg' }]);
    assert.equal(Object.hasOwn(metadata, 'symbol'), false, 'no tool-NFT symbol has been approved; do not copy the utility-token symbol');
    assert.equal(Object.hasOwn(metadata.properties, 'creators'), false, 'no creator shares have been approved');
  }
});

test('Arweave URL and cost helpers validate IDs and preserve Winston precision', async () => {
  const metadataTools = await metadataToolsPromise;
  assert.equal(metadataTools.arweaveUrl('A'.repeat(43)), `https://arweave.net/${'A'.repeat(43)}`);
  assert.throws(() => metadataTools.arweaveUrl('bad'), /43-character/);
  assert.equal(metadataTools.parseArAsWinston('0.000000000123'), 123n);
  assert.equal(metadataTools.parseArAsWinston('2.5'), 2_500_000_000_000n);
  assert.equal(metadataTools.formatWinstonAsAr(123n), '0.000000000123');
  assert.throws(() => metadataTools.parseArAsWinston('1e-3'), /non-negative decimals/);
  assert.throws(() => metadataTools.parseArAsWinston('0.0000000000001'), /12 fractional digits/);
});

test('uploader defaults to estimate-only, bounds explicit uploads and never sends Solana transactions', () => {
  const script = read('aof_backend/scripts/uploadToolNftMetadataToArweave.mjs');
  assert.match(script, /mode: "estimate"/);
  assert.match(script, /args\.mode === "upload" && args\.maxCostAr === null/);
  assert.match(script, /--max-cost-ar <AR>/);
  assert.match(script, /--seller-fee-bps <bps>/);
  assert.match(script, /args\.mode === "upload" && args\.sellerFeeBps === null/);
  assert.match(script, /APPROVED_MAX_COST_AR = "0\.20"/);
  assert.match(script, /costLimitWinston > APPROVED_MAX_COST_WINSTON/);
  assert.match(script, /APPROVED_SELLER_FEE_BPS = 0/);
  assert.match(script, /args\.sellerFeeBps !== APPROVED_SELLER_FEE_BPS/);
  assert.match(script, /schemaVersion: 2/);
  assert.match(script, /function getManifestSpentWinston\(/);
  assert.match(script, /projectedCumulativeWinston = alreadySpentWinston \+ totalWinston/);
  assert.match(script, /manifest\.inFlightTransaction = \{/);
  assert.match(script, /Arweave POST outcome is unknown/);
  assert.match(script, /imageRewardWinston/);
  assert.match(script, /metadataRewardWinston/);
  assert.match(script, /manifest\.inFlightTransaction/);
  assert.match(script, /READ_RETRY_MAX_ATTEMPTS = 5/);
  assert.match(script, /READ_RETRY_DELAYS_MS = \[500, 1_000, 2_000, 4_000\]/);
  assert.match(script, /async function retryRead\(/);
  assert.match(script, /async function getPriceWithRetry\(/);
  assert.match(script, /async function getTransactionAnchorWithRetry\(/);
  assert.match(script, /mapWithConcurrency\(tasks, 1,/);
  assert.match(script, /Preserve each failure and continue/);
  assert.match(script, /priceError: error/);
  assert.match(script, /failedPriceLookups = estimates\.filter/);
  assert.match(script, /Complete estimate unavailable/);
  assert.match(script, /NOT a complete estimate/);
  assert.match(script, /causeCode = error\?\.cause\?\.code/);
  assert.match(script, /last_tx: lastTx/);
  assert.match(script, /reward: rewardWinston\.toString\(\)/);
  assert.match(script, /transactions\.post\(transaction\)/);
  assert.doesNotMatch(script, /@solana\/web3\.js|sendTransaction\(|sendAndConfirmTransaction\(/);
  assert.match(script, /Arweave mainnet/);
});
