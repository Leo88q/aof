'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');

const root = path.resolve(__dirname, '../..');
const toolsPromise = import('../../aof_backend/scripts/toolNftMetadata.mjs');
const cloudflarePromise = import('../../aof_backend/scripts/toolNftCloudflare.mjs');
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function preparedFixture(t) {
  const { buildToolNftCloudflareBundle } = await cloudflarePromise;
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tool-nft-cloudflare-'));
  t.after(() => fs.rmSync(outDir, { recursive: true, force: true }));
  const result = buildToolNftCloudflareBundle({
    baseUrl: 'https://aof-devnet-nft-metadata.pages.dev',
    outDir,
    repoRoot: root,
    createdAt: new Date('2026-10-06T00:00:00.000Z'),
  });
  return { ...result, outDir };
}

function mockFetch(outDir, calls = []) {
  return async (url) => {
    calls.push(url);
    const parsed = new URL(url);
    const file = path.join(outDir, ...parsed.pathname.replace(/^\//, '').split('/'));
    if (!fs.existsSync(file)) {
      return { ok: false, status: 404, headers: { get: () => null } };
    }
    const bytes = fs.readFileSync(file);
    const contentType = file.endsWith('.jpg') ? 'image/jpeg' : 'application/json; charset=utf-8';
    return {
      ok: true,
      status: 200,
      headers: { get: (name) => name.toLowerCase() === 'content-type' ? contentType : null },
      arrayBuffer: async () => Uint8Array.from(bytes).buffer,
    };
  };
}

test('Cloudflare bundle contains exactly 25 canonical metadata JSON files and 25 local artworks', async (t) => {
  const { manifest, outDir } = await preparedFixture(t);
  const metadataTools = await toolsPromise;
  const variants = metadataTools.listToolNftVariants();
  assert.equal(manifest.provider, 'Cloudflare Pages');
  assert.equal(manifest.sellerFeeBasisPoints, 0);
  assert.equal(Object.keys(manifest.entries).length, 25);
  assert.match(manifest.releaseId, /^[a-f0-9]{20}$/);
  assert.equal(fs.existsSync(path.join(outDir, 'index.html')), true);
  assert.equal(fs.existsSync(path.join(outDir, '_headers')), true);

  const alternateOutDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tool-nft-cloudflare-alt-'));
  t.after(() => fs.rmSync(alternateOutDir, { recursive: true, force: true }));
  const { buildToolNftCloudflareBundle } = await cloudflarePromise;
  const alternate = buildToolNftCloudflareBundle({
    baseUrl: 'https://alternate-metadata.pages.dev',
    outDir: alternateOutDir,
    repoRoot: root,
    createdAt: new Date('2026-10-06T00:00:00.000Z'),
  });
  assert.notEqual(alternate.manifest.releaseId, manifest.releaseId, 'base URL is committed because it is embedded in every metadata JSON');

  for (const variant of variants) {
    const entry = manifest.entries[variant.key];
    const imagePath = path.join(outDir, ...entry.imagePath.split('/'));
    const metadataPath = path.join(outDir, ...entry.metadataPath.split('/'));
    assert.equal(fs.existsSync(imagePath), true, `${variant.key} image missing`);
    assert.equal(fs.existsSync(metadataPath), true, `${variant.key} metadata missing`);
    assert.equal(digest(fs.readFileSync(imagePath)), entry.imageSha256);
    const metadataBytes = fs.readFileSync(metadataPath);
    assert.equal(digest(metadataBytes), entry.metadataSha256);
    const metadata = JSON.parse(metadataBytes.toString('utf8'));
    assert.equal(metadata.image, entry.imageUri);
    assert.equal(metadata.seller_fee_basis_points, 0);
    assert.equal(Object.hasOwn(metadata, 'symbol'), false);
    assert.equal(metadata.properties.files[0].uri, entry.imageUri);
    assert.match(entry.imageUri, /^https:\/\/aof-devnet-nft-metadata\.pages\.dev\/releases\/[a-f0-9]{20}\//);
    assert.match(entry.metadataUri, /^https:\/\/aof-devnet-nft-metadata\.pages\.dev\/releases\/[a-f0-9]{20}\//);
  }
});

test('Cloudflare verifier checks all 50 URLs read-only and rejects tampering before accepting a release', async (t) => {
  const { manifest, outDir } = await preparedFixture(t);
  const { verifyToolNftCloudflareDeployment, validateToolNftCloudflareManifest } = await cloudflarePromise;
  const calls = [];
  const result = await verifyToolNftCloudflareDeployment({
    manifest,
    outDir,
    repoRoot: root,
    fetchImpl: mockFetch(outDir, calls),
    concurrency: 3,
  });
  assert.deepEqual(result, { variantsVerified: 25, assetsVerified: 50, releaseId: manifest.releaseId });
  assert.equal(calls.length, 50);
  assert.equal(new Set(calls).size, 50);

  const wrongFee = structuredClone(manifest);
  wrongFee.sellerFeeBasisPoints = 250;
  assert.throws(() => validateToolNftCloudflareManifest(wrongFee), /approved sellerFeeBasisPoints value of 0/);

  const changedUrl = structuredClone(manifest);
  changedUrl.entries['plasma_cutter/common'].metadataUri = 'https://elsewhere.invalid/metadata.json';
  assert.throws(() => validateToolNftCloudflareManifest(changedUrl), /public URLs do not match/);

  const missingAssetCalls = [];
  await assert.rejects(verifyToolNftCloudflareDeployment({
    manifest,
    outDir,
    repoRoot: root,
    fetchImpl: async (url, options) => {
      if (url === manifest.entries['plasma_cutter/common'].imageUri) {
        return { ok: false, status: 404, headers: { get: () => null } };
      }
      return mockFetch(outDir, missingAssetCalls)(url, options);
    },
  }), /returned HTTP 404/);
});

test('Cloudflare base URL and general HTTPS metadata helper fail closed on unsafe URLs', async () => {
  const metadataTools = await toolsPromise;
  const { normalizeToolNftPublicBaseUrl } = await cloudflarePromise;
  assert.equal(normalizeToolNftPublicBaseUrl('https://aof-devnet-nft-metadata.pages.dev/'), 'https://aof-devnet-nft-metadata.pages.dev');
  assert.throws(() => normalizeToolNftPublicBaseUrl('http://aof-devnet-nft-metadata.pages.dev'), /HTTPS/);
  assert.throws(() => normalizeToolNftPublicBaseUrl('https://user:pass@example.pages.dev'), /credentials/);
  assert.throws(() => normalizeToolNftPublicBaseUrl('https://example.pages.dev/?token=secret'), /query parameters/);
  assert.throws(() => normalizeToolNftPublicBaseUrl('https://example.pages.dev/metadata'), /without a path/);
  assert.throws(() => metadataTools.createToolNftMetadataForHttps({
    toolType: 'plasma_cutter', rarity: 'common', imageUri: 'http://example.com/image.jpg', sellerFeeBasisPoints: 0,
  }), /HTTPS/);
});

test('Cloudflare bundle tooling is separate from Arweave and exposed as explicit backend commands', () => {
  const cli = fs.readFileSync(path.join(root, 'aof_backend/scripts/prepareToolNftCloudflareBundle.mjs'), 'utf8');
  assert.match(cli, /buildToolNftCloudflareBundle/);
  assert.doesNotMatch(cli, /arweave\.net|transactions\.post\(/);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'aof_backend/package.json'), 'utf8'));
  assert.equal(pkg.scripts['nft:cloudflare:tool-metadata:prepare'], 'node scripts/prepareToolNftCloudflareBundle.mjs');
  assert.equal(pkg.scripts['nft:cloudflare:tool-metadata:verify'], 'node scripts/verifyToolNftCloudflareDeployment.mjs');
});
