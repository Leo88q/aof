import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createToolNftMetadataForHttps,
  listToolNftVariants,
  serializeToolNftMetadata,
} from "./toolNftMetadata.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const TOOL_NFT_CLOUDFLARE_REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
export const DEFAULT_TOOL_NFT_CLOUDFLARE_DIR = path.join(TOOL_NFT_CLOUDFLARE_REPO_ROOT, "out/tool-nft-cloudflare");
export const TOOL_NFT_CLOUDFLARE_MANIFEST_NAME = "tool-nft-cloudflare-manifest.json";
export const APPROVED_TOOL_NFT_SELLER_FEE_BPS = 0;
const SHA256_HEX = /^[a-f0-9]{64}$/;
const RELEASE_ID = /^[a-f0-9]{20}$/;
const EXPECTED_VARIANTS = 25;

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function normalizeToolNftPublicBaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("--base-url must be an absolute public HTTPS URL");
  }
  if (url.protocol !== "https:" || !url.hostname || url.username || url.password || url.search || url.hash) {
    throw new Error("--base-url must use HTTPS and must not contain credentials, query parameters, or a fragment");
  }
  if (url.pathname !== "/") {
    throw new Error("--base-url must be a public site origin without a path");
  }
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}

function absoluteUrl(baseUrl, relativePath) {
  return `${baseUrl}/${relativePath.replace(/^\/+/, "")}`;
}

function metadataTemplateDigest(variant) {
  const bytes = serializeToolNftMetadata(createToolNftMetadataForHttps({
    toolType: variant.toolType,
    rarity: variant.rarity,
    imageUri: `https://nft-release.invalid/assets/nfts/${variant.imageFile}`,
    sellerFeeBasisPoints: APPROVED_TOOL_NFT_SELLER_FEE_BPS,
  }));
  return sha256(bytes);
}

function deriveReleaseId(variants, imageDigests, baseUrl) {
  const releaseMaterial = [baseUrl, ...variants.map((variant) => [
    variant.key,
    imageDigests[variant.key],
    metadataTemplateDigest(variant),
  ].join(":"))].join("\n");
  return sha256(Buffer.from(`tool-nft-cloudflare-v1\n${releaseMaterial}`, "utf8")).slice(0, 20);
}

function htmlEscape(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function renderIndex(entries) {
  const rows = entries.map(({ variant, entry }) =>
    `<li><a href="/${entry.metadataPath}">${htmlEscape(variant.toolName)} — ${htmlEscape(variant.displayRarity)} metadata</a> · <a href="/${entry.imagePath}">image</a></li>`,
  ).join("\n");
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NeuroForge Devnet Tool NFTs</title></head>
<body><main><h1>NeuroForge Devnet Tool NFT metadata</h1><p>Static release files for the Solana Devnet pilot. Seller fee: 0 bps.</p><ol>
${rows}
</ol></main></body>
</html>
`;
}

export function buildToolNftCloudflareBundle({
  baseUrl,
  outDir = DEFAULT_TOOL_NFT_CLOUDFLARE_DIR,
  repoRoot = TOOL_NFT_CLOUDFLARE_REPO_ROOT,
  createdAt = new Date(),
} = {}) {
  const normalizedBaseUrl = normalizeToolNftPublicBaseUrl(baseUrl);
  const absoluteOutDir = path.resolve(outDir);
  const variants = listToolNftVariants();
  if (variants.length !== EXPECTED_VARIANTS) {
    throw new Error(`Expected ${EXPECTED_VARIANTS} tool NFT variants, found ${variants.length}`);
  }

  const sourceByKey = new Map();
  const imageDigests = {};
  for (const variant of variants) {
    const imagePath = path.join(repoRoot, "frontend/public/assets/nfts", variant.imageFile);
    if (!fs.existsSync(imagePath)) throw new Error(`${variant.key}: missing local artwork ${imagePath}`);
    const bytes = fs.readFileSync(imagePath);
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9) {
      throw new Error(`${variant.key}: artwork is not a complete JPEG file`);
    }
    sourceByKey.set(variant.key, bytes);
    imageDigests[variant.key] = sha256(bytes);
  }

  // Versioned paths make each content release independently addressable. The ID
  // commits to the public base URL, all artwork digests, and canonical metadata fields.
  const releaseId = deriveReleaseId(variants, imageDigests, normalizedBaseUrl);
  const manifestEntries = {};
  const renderedEntries = [];

  for (const variant of variants) {
    const imagePath = `releases/${releaseId}/assets/nfts/${variant.imageFile}`;
    const metadataPath = `releases/${releaseId}/metadata/${variant.toolType}/${variant.rarity}.json`;
    const imageUri = absoluteUrl(normalizedBaseUrl, imagePath);
    const metadataUri = absoluteUrl(normalizedBaseUrl, metadataPath);
    const imageBytes = sourceByKey.get(variant.key);
    const metadataBytes = serializeToolNftMetadata(createToolNftMetadataForHttps({
      toolType: variant.toolType,
      rarity: variant.rarity,
      imageUri,
      sellerFeeBasisPoints: APPROVED_TOOL_NFT_SELLER_FEE_BPS,
    }));

    const localImagePath = path.join(absoluteOutDir, ...imagePath.split("/"));
    const localMetadataPath = path.join(absoluteOutDir, ...metadataPath.split("/"));
    fs.mkdirSync(path.dirname(localImagePath), { recursive: true });
    fs.mkdirSync(path.dirname(localMetadataPath), { recursive: true });
    fs.writeFileSync(localImagePath, imageBytes);
    fs.writeFileSync(localMetadataPath, metadataBytes);

    const entry = {
      toolType: variant.toolType,
      rarity: variant.rarity,
      imageFile: variant.imageFile,
      imagePath,
      imageUri,
      imageSha256: imageDigests[variant.key],
      metadataPath,
      metadataUri,
      metadataSha256: sha256(metadataBytes),
    };
    manifestEntries[variant.key] = entry;
    renderedEntries.push({ variant, entry });
  }

  const manifest = {
    schemaVersion: 1,
    provider: "Cloudflare Pages",
    purpose: "Solana Devnet tool NFT metadata and artwork",
    baseUrl: normalizedBaseUrl,
    releaseId,
    sellerFeeBasisPoints: APPROVED_TOOL_NFT_SELLER_FEE_BPS,
    createdAt: createdAt.toISOString(),
    entries: manifestEntries,
  };
  fs.mkdirSync(absoluteOutDir, { recursive: true });
  fs.writeFileSync(
    path.join(absoluteOutDir, TOOL_NFT_CLOUDFLARE_MANIFEST_NAME),
    `${JSON.stringify(manifest, null, 2)}\n`,
    { mode: 0o644 },
  );
  fs.writeFileSync(path.join(absoluteOutDir, "_headers"),
    `/releases/${releaseId}/*\n  Cache-Control: public, max-age=31536000, immutable\n`,
    { mode: 0o644 },
  );
  fs.writeFileSync(path.join(absoluteOutDir, "index.html"), renderIndex(renderedEntries), { mode: 0o644 });
  return { outDir: absoluteOutDir, manifest, manifestPath: path.join(absoluteOutDir, TOOL_NFT_CLOUDFLARE_MANIFEST_NAME) };
}

function fail(message) {
  throw new Error(`TOOL_NFT_CLOUDFLARE_VERIFY:${message}`);
}

export function validateToolNftCloudflareManifest(manifest) {
  if (!manifest || manifest.schemaVersion !== 1 || manifest.provider !== "Cloudflare Pages") {
    fail("manifest must be schemaVersion 1 for Cloudflare Pages");
  }
  if (manifest.sellerFeeBasisPoints !== APPROVED_TOOL_NFT_SELLER_FEE_BPS) {
    fail("manifest must use the approved sellerFeeBasisPoints value of 0");
  }
  let baseUrl;
  try {
    baseUrl = normalizeToolNftPublicBaseUrl(manifest.baseUrl);
  } catch (error) {
    fail(error.message);
  }
  if (baseUrl !== manifest.baseUrl) fail("manifest baseUrl is not canonical");
  if (!RELEASE_ID.test(manifest.releaseId || "")) fail("manifest releaseId is invalid");
  if (!manifest.entries || typeof manifest.entries !== "object" || Array.isArray(manifest.entries)) {
    fail("manifest entries must be an object");
  }

  const variants = listToolNftVariants();
  if (variants.length !== EXPECTED_VARIANTS || Object.keys(manifest.entries).length !== EXPECTED_VARIANTS) {
    fail(`expected exactly ${EXPECTED_VARIANTS} variants`);
  }
  const imageDigests = {};
  for (const variant of variants) {
    const entry = manifest.entries[variant.key];
    if (!entry || entry.toolType !== variant.toolType || entry.rarity !== variant.rarity || entry.imageFile !== variant.imageFile) {
      fail(`${variant.key} identity/artwork does not match the canonical catalog`);
    }
    if (!SHA256_HEX.test(entry.imageSha256 || "") || !SHA256_HEX.test(entry.metadataSha256 || "")) {
      fail(`${variant.key} is missing a valid SHA-256 digest`);
    }
    const expectedImagePath = `releases/${manifest.releaseId}/assets/nfts/${variant.imageFile}`;
    const expectedMetadataPath = `releases/${manifest.releaseId}/metadata/${variant.toolType}/${variant.rarity}.json`;
    if (entry.imagePath !== expectedImagePath || entry.metadataPath !== expectedMetadataPath) {
      fail(`${variant.key} release paths do not match the canonical versioned layout`);
    }
    if (entry.imageUri !== absoluteUrl(baseUrl, expectedImagePath) || entry.metadataUri !== absoluteUrl(baseUrl, expectedMetadataPath)) {
      fail(`${variant.key} public URLs do not match the manifest base URL`);
    }
    imageDigests[variant.key] = entry.imageSha256;
  }
  if (deriveReleaseId(variants, imageDigests, baseUrl) !== manifest.releaseId) {
    fail("releaseId does not match the canonical image digests and metadata schema");
  }
  return variants.map((variant) => ({ variant, entry: manifest.entries[variant.key] }));
}

async function fetchAsset(fetchImpl, url, expectedMimeType, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { signal: controller.signal, redirect: "follow" });
    if (!response || response.status !== 200 || response.ok !== true) {
      fail(`${url} returned HTTP ${response?.status ?? "no response"}`);
    }
    const contentType = String(response.headers?.get?.("content-type") || "").split(";", 1)[0].trim().toLowerCase();
    if (contentType !== expectedMimeType) fail(`${url} returned Content-Type ${contentType || "(missing)"}, expected ${expectedMimeType}`);
    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    if (error?.message?.startsWith("TOOL_NFT_CLOUDFLARE_VERIFY:")) throw error;
    if (controller.signal.aborted) fail(`${url} timed out after ${timeoutMs} ms`);
    fail(`${url} could not be fetched: ${error?.message || String(error)}`);
  } finally {
    clearTimeout(timeout);
  }
}

async function mapWithConcurrency(items, concurrency, callback) {
  const output = new Array(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      output[index] = await callback(items[index], index);
    }
  });
  await Promise.all(workers);
  return output;
}

export async function verifyToolNftCloudflareDeployment({
  manifest,
  outDir = DEFAULT_TOOL_NFT_CLOUDFLARE_DIR,
  repoRoot = TOOL_NFT_CLOUDFLARE_REPO_ROOT,
  fetchImpl = globalThis.fetch,
  concurrency = 4,
  timeoutMs = 30_000,
} = {}) {
  if (typeof fetchImpl !== "function") fail("fetch API is unavailable; use a supported Node.js version");
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 16) fail("concurrency must be from 1 through 16");
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 120_000) fail("timeoutMs must be from 1000 through 120000");
  const entries = validateToolNftCloudflareManifest(manifest);

  await mapWithConcurrency(entries, concurrency, async ({ variant, entry }) => {
    const sourcePath = path.join(repoRoot, "frontend/public/assets/nfts", variant.imageFile);
    if (!fs.existsSync(sourcePath)) fail(`${variant.key} local artwork is missing: ${sourcePath}`);
    const sourceBytes = fs.readFileSync(sourcePath);
    if (sha256(sourceBytes) !== entry.imageSha256) fail(`${variant.key} source artwork digest differs from manifest`);

    const outputImagePath = path.join(outDir, ...entry.imagePath.split("/"));
    const outputMetadataPath = path.join(outDir, ...entry.metadataPath.split("/"));
    if (!fs.existsSync(outputImagePath) || !fs.existsSync(outputMetadataPath)) fail(`${variant.key} generated bundle files are missing`);
    const outputImageBytes = fs.readFileSync(outputImagePath);
    const outputMetadataBytes = fs.readFileSync(outputMetadataPath);
    if (sha256(outputImageBytes) !== entry.imageSha256) fail(`${variant.key} generated image bytes differ from manifest`);

    const expectedMetadataBytes = serializeToolNftMetadata(createToolNftMetadataForHttps({
      toolType: variant.toolType,
      rarity: variant.rarity,
      imageUri: entry.imageUri,
      sellerFeeBasisPoints: manifest.sellerFeeBasisPoints,
    }));
    if (sha256(expectedMetadataBytes) !== entry.metadataSha256 || sha256(outputMetadataBytes) !== entry.metadataSha256) {
      fail(`${variant.key} generated metadata does not match canonical release metadata`);
    }

    const [imageBytes, metadataBytes] = await Promise.all([
      fetchAsset(fetchImpl, entry.imageUri, "image/jpeg", timeoutMs),
      fetchAsset(fetchImpl, entry.metadataUri, "application/json", timeoutMs),
    ]);
    if (sha256(imageBytes) !== entry.imageSha256) fail(`${variant.key} deployed image bytes differ from local artwork`);
    if (sha256(metadataBytes) !== entry.metadataSha256) fail(`${variant.key} deployed metadata bytes differ from the release manifest`);
    let parsedMetadata;
    try {
      parsedMetadata = JSON.parse(metadataBytes.toString("utf8"));
    } catch {
      fail(`${variant.key} deployed metadata is not valid JSON`);
    }
    if (JSON.stringify(parsedMetadata) !== JSON.stringify(JSON.parse(expectedMetadataBytes.toString("utf8")))) {
      fail(`${variant.key} deployed metadata fields differ from the canonical release`);
    }
  });

  return { variantsVerified: entries.length, assetsVerified: entries.length * 2, releaseId: manifest.releaseId };
}
