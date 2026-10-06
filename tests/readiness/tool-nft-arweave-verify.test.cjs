'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const root = path.resolve(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const metadataToolsPromise = import('../../aof_backend/scripts/toolNftMetadata.mjs');
const verifierPromise = import('../../aof_backend/scripts/toolNftArweaveVerifier.mjs');
const digest = (value) => createHash('sha256').update(value).digest('hex');
const txId = (prefix, index) => `${prefix}${index.toString(36).padStart(42, '0')}`;

async function releaseFixture() {
  const metadataTools = await metadataToolsPromise;
  const variants = metadataTools.listToolNftVariants();
  const gateway = new Map();
  const manifest = {
    schemaVersion: 2,
    network: 'Arweave mainnet',
    status: 'submitted',
    sellerFeeBasisPoints: 0,
    inFlightTransaction: null,
    entries: {},
  };
  variants.forEach((variant, index) => {
    const imagePath = path.join(root, 'frontend/public/assets/nfts', variant.imageFile);
    const imageBytes = fs.readFileSync(imagePath);
    const imageTxId = txId('I', index);
    const metadataTxId = txId('M', index);
    const imageUri = metadataTools.arweaveUrl(imageTxId);
    const metadataBytes = metadataTools.serializeToolNftMetadata(metadataTools.createToolNftMetadata({
      toolType: variant.toolType,
      rarity: variant.rarity,
      imageUri,
      sellerFeeBasisPoints: 0,
    }));
    manifest.entries[variant.key] = {
      toolType: variant.toolType,
      rarity: variant.rarity,
      imageFile: variant.imageFile,
      imageSha256: digest(imageBytes),
      imageTxId,
      imageUri,
      metadataImageTxId: imageTxId,
      metadataTxId,
      metadataUri: metadataTools.arweaveUrl(metadataTxId),
      metadataSha256: digest(metadataBytes),
      imageRewardWinston: '1000000000',
      metadataRewardWinston: '1000000000',
    };
    gateway.set(imageUri, { bytes: imageBytes, type: 'image/jpeg' });
    gateway.set(manifest.entries[variant.key].metadataUri, { bytes: metadataBytes, type: 'application/json' });
  });
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    const item = gateway.get(url);
    if (!item) return { ok: false, status: 404, headers: { get: () => null } };
    const bytes = Buffer.from(item.bytes);
    return {
      ok: true,
      status: 200,
      headers: { get: (name) => name.toLowerCase() === 'content-type' ? item.type : null },
      arrayBuffer: async () => Uint8Array.from(bytes).buffer,
    };
  };
  return { manifest, gateway, calls, fetchImpl };
}

test('read-only verifier checks exactly 25 image/JSON pairs and byte-for-byte metadata', async () => {
  const { verifyToolNftReleaseManifest } = await verifierPromise;
  const fixture = await releaseFixture();
  const result = await verifyToolNftReleaseManifest({
    manifest: fixture.manifest,
    repoRoot: root,
    fetchImpl: fixture.fetchImpl,
    concurrency: 3,
  });
  assert.deepEqual(result, { variantsVerified: 25, assetsVerified: 50, transactionIdsVerified: 50 });
  assert.equal(fixture.calls.length, 50);
  assert.equal(new Set(fixture.calls).size, 50);
  assert.ok(fixture.calls.every((url) => url.startsWith('https://arweave.net/')));
});

test('manifest enforces the 0 bps release setting, cumulative 0.20 AR cap, and no unresolved submission', async () => {
  const { validateToolNftReleaseManifest } = await verifierPromise;
  const fixture = await releaseFixture();
  assert.doesNotThrow(() => validateToolNftReleaseManifest(fixture.manifest));

  const overBudget = structuredClone(fixture.manifest);
  overBudget.entries['plasma_cutter/common'].imageRewardWinston = '151000000001';
  assert.throws(() => validateToolNftReleaseManifest(overBudget), /exceed the approved 0\.20 AR maximum/);

  const wrongFee = structuredClone(fixture.manifest);
  wrongFee.sellerFeeBasisPoints = 1;
  assert.throws(() => validateToolNftReleaseManifest(wrongFee), /approved sellerFeeBasisPoints value of 0/);

  const unresolved = structuredClone(fixture.manifest);
  unresolved.inFlightTransaction = { txId: txId('P', 0), variantKey: 'plasma_cutter/common', stage: 'image' };
  assert.throws(() => validateToolNftReleaseManifest(unresolved), /unresolved in-flight/);

  const missingReceipt = structuredClone(fixture.manifest);
  delete missingReceipt.entries['plasma_cutter/common'].imageRewardWinston;
  assert.throws(() => validateToolNftReleaseManifest(missingReceipt), /missing a valid imageRewardWinston receipt/);
});

test('verifier fails closed before network access if the matrix is incomplete or reuses a transaction ID', async () => {
  const { validateToolNftReleaseManifest, verifyToolNftReleaseManifest } = await verifierPromise;
  const fixture = await releaseFixture();
  const incomplete = structuredClone(fixture.manifest);
  delete incomplete.entries['neural_seeder/legendary'];
  assert.throws(() => validateToolNftReleaseManifest(incomplete), /missing variant neural_seeder\/legendary/);
  await assert.rejects(verifyToolNftReleaseManifest({
    manifest: incomplete,
    repoRoot: root,
    fetchImpl: fixture.fetchImpl,
  }), /missing variant neural_seeder\/legendary/);
  assert.equal(fixture.calls.length, 0);

  const duplicated = structuredClone(fixture.manifest);
  duplicated.entries['neural_seeder/legendary'].metadataTxId = duplicated.entries['plasma_cutter/common'].imageTxId;
  duplicated.entries['neural_seeder/legendary'].metadataUri = `https://arweave.net/${duplicated.entries['plasma_cutter/common'].imageTxId}`;
  assert.throws(() => validateToolNftReleaseManifest(duplicated), /reuses an Arweave transaction ID/);
});

test('verifier rejects a JSON-to-image mismatch, gateway errors, and content tampering', async () => {
  const { verifyToolNftReleaseManifest } = await verifierPromise;
  const mismatchFixture = await releaseFixture();
  mismatchFixture.manifest.entries['plasma_cutter/common'].metadataImageTxId = txId('Z', 0);
  await assert.rejects(verifyToolNftReleaseManifest({
    manifest: mismatchFixture.manifest,
    repoRoot: root,
    fetchImpl: mismatchFixture.fetchImpl,
  }), /JSON is not bound to its recorded image transaction/);
  assert.equal(mismatchFixture.calls.length, 0);

  const tampered = await releaseFixture();
  const firstImage = tampered.manifest.entries['plasma_cutter/common'].imageUri;
  tampered.gateway.set(firstImage, { bytes: Buffer.from('wrong artwork bytes'), type: 'image/jpeg' });
  await assert.rejects(verifyToolNftReleaseManifest({
    manifest: tampered.manifest,
    repoRoot: root,
    fetchImpl: tampered.fetchImpl,
  }), /gateway image bytes do not match/);

  const unavailable = await releaseFixture();
  const firstJson = unavailable.manifest.entries['plasma_cutter/common'].metadataUri;
  unavailable.gateway.delete(firstJson);
  await assert.rejects(verifyToolNftReleaseManifest({
    manifest: unavailable.manifest,
    repoRoot: root,
    fetchImpl: unavailable.fetchImpl,
  }), /returned HTTP 404/);
});

test('local verifier is read-only and is exposed as an explicit package command', () => {
  const cli = read('aof_backend/scripts/verifyToolNftArweaveManifest.mjs');
  assert.match(cli, /verifyToolNftReleaseManifest/);
  assert.match(cli, /no transactions will be sent/);
  assert.doesNotMatch(cli, /@solana\/web3\.js|sendTransaction\(|transactions\.post\(/);
  const pkg = JSON.parse(read('aof_backend/package.json'));
  assert.equal(pkg.scripts['nft:arweave:verify-tool-metadata'], 'node scripts/verifyToolNftArweaveManifest.mjs');
});
