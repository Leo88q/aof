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

test('the 50-URL Cloudflare bundle is for 25 tool NFT variants, not the 27 fungible resource kinds', () => {
  const resourceManifest = JSON.parse(fs.readFileSync(path.join(root, 'docs/RESOURCE_MANIFEST.json'), 'utf8'));
  assert.equal(resourceManifest.resources.length, 27);
  const resourceArtworkDir = path.join(root, 'frontend/public/assets/nfts/resources');
  const allResourceArtwork = fs.readdirSync(resourceArtworkDir).filter((name) => name.endsWith('.jpg')).sort();
  const canonicalResourceArtwork = resourceManifest.resources.map((resource) =>
    `${resource.apiName.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}.jpg`,
  ).sort();
  assert.equal(canonicalResourceArtwork.length, 27);
  for (const file of canonicalResourceArtwork) assert.ok(allResourceArtwork.includes(file), `${file} is missing`);
  assert.deepEqual(allResourceArtwork.filter((file) => !canonicalResourceArtwork.includes(file)), ['drop-capsule.jpg']);

  const lib = fs.readFileSync(path.join(root, 'aof-core/src/lib.rs'), 'utf8');
  const mintResourceContext = lib.slice(lib.indexOf('pub struct MintResource<'), lib.indexOf('pub struct MintResourceOnce<'));
  assert.doesNotMatch(mintResourceContext, /TokenMetadata|token_metadata|metadata_uri/i);
});

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
    assert.match(entry.imageUri, /^https:\/\/aof-devnet-nft-metadata\.pages\.dev\/r\/[a-f0-9]{20}\/i\/\d{2}\.jpg$/);
    assert.match(entry.metadataUri, /^https:\/\/aof-devnet-nft-metadata\.pages\.dev\/r\/[a-f0-9]{20}\/m\/\d{2}\.json$/);
    assert.ok(Buffer.byteLength(entry.metadataUri, 'utf8') <= 80, `${variant.key} on-chain metadata URI must fit ToolMetadataRegistry's 80-byte slot`);
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

test('Cloudflare metadata URLs match the on-chain public HTTPS and 80-byte registry contract', async () => {
  const contract = fs.readFileSync(path.join(root, 'aof-core/src/instructions/tool_metadata.rs'), 'utf8');
  const constants = fs.readFileSync(path.join(root, 'aof-core/src/constants.rs'), 'utf8');
  const errors = fs.readFileSync(path.join(root, 'aof-core/src/errors.rs'), 'utf8');
  const idl = JSON.parse(fs.readFileSync(path.join(root, 'aof_backend/src/idl/aof_core.json'), 'utf8'));
  assert.match(constants, /TOOL_METADATA_URI_MAX_LEN: usize = 80/);
  assert.match(contract, /fn is_public_https_metadata_uri/);
  assert.match(contract, /uri\.len\(\) > TOOL_METADATA_URI_MAX_LEN/);
  assert.doesNotMatch(contract, /is_arweave_metadata_uri/);
  assert.doesNotMatch(errors, /valid unique Arweave links/);
  const error = idl.errors.find((entry) => entry.name === 'InvalidToolMetadataUris');
  assert.match(error.msg, /public HTTPS URLs within the byte limit/);
});

test('Cloudflare base URL and general HTTPS metadata helper fail closed on unsafe URLs', async () => {
  const metadataTools = await toolsPromise;
  const { normalizeToolNftPublicBaseUrl } = await cloudflarePromise;
  assert.equal(normalizeToolNftPublicBaseUrl('https://aof-devnet-nft-metadata.pages.dev/'), 'https://aof-devnet-nft-metadata.pages.dev');
  assert.throws(() => normalizeToolNftPublicBaseUrl('http://aof-devnet-nft-metadata.pages.dev'), /HTTPS/);
  assert.throws(() => normalizeToolNftPublicBaseUrl('https://user:pass@example.pages.dev'), /credentials/);
  assert.throws(() => normalizeToolNftPublicBaseUrl('https://example.pages.dev/?token=secret'), /query parameters/);
  assert.throws(() => normalizeToolNftPublicBaseUrl('https://example.pages.dev/metadata'), /without a path/);
  assert.throws(() => normalizeToolNftPublicBaseUrl('https://aof.pages.dev'), /existing production game Pages project/);
  assert.throws(() => normalizeToolNftPublicBaseUrl('https://0b355fc2.aof.pages.dev'), /existing production game Pages project/);
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
  assert.equal(pkg.scripts['nft:cloudflare:tool-metadata:registry'], 'ts-node --project tsconfig.json --transpile-only scripts/configureToolNftMetadataRegistry.ts');

  const registryCli = fs.readFileSync(path.join(root, 'aof_backend/scripts/configureToolNftMetadataRegistry.ts'), 'utf8');
  assert.match(registryCli, /verifyPublicRelease\(args\.bundleDir, args\.manifestPath\)/);
  assert.match(registryCli, /genesisHash !== DEVNET_GENESIS_HASH/);
  assert.match(registryCli, /config\.authority\.equals\(AUTHORITY_PUBKEY\)/);
  assert.match(registryCli, /args\.submit && !args\.freeze/);
  assert.match(registryCli, /setToolMetadataUris\(start, batchUris, 0, freeze\)/);
  assert.match(registryCli, /if \(!args\.submit\)[\s\S]*?Plan only\. No Solana transaction was sent/);
  assert.doesNotMatch(registryCli, /setMiningEnabled|set_registry_status|mintTool/);
});
