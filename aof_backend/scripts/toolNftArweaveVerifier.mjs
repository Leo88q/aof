import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  arweaveUrl,
  createToolNftMetadata,
  listToolNftVariants,
  serializeToolNftMetadata,
} from "./toolNftMetadata.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const TOOL_NFT_REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
export const DEFAULT_TOOL_NFT_MANIFEST = path.join(TOOL_NFT_REPO_ROOT, "out/tool-nft-arweave-manifest.json");
export const DEFAULT_TOOL_NFT_GATEWAY = "https://arweave.net";
const SHA256_HEX = /^[a-f0-9]{64}$/i;
const TX_ID = /^[A-Za-z0-9_-]{43}$/;

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function fail(message) {
  throw new Error(`TOOL_NFT_ARWEAVE_VERIFY:${message}`);
}

export function validateToolNftReleaseManifest(manifest) {
  if (!manifest || manifest.schemaVersion !== 1 || manifest.network !== "Arweave mainnet") {
    fail("manifest must be schemaVersion 1 for Arweave mainnet");
  }
  if (!manifest.entries || typeof manifest.entries !== "object" || Array.isArray(manifest.entries)) {
    fail("manifest entries must be an object");
  }
  const fee = manifest.sellerFeeBasisPoints;
  if (!Number.isInteger(fee) || fee < 0 || fee > 10_000) {
    fail("manifest must contain the explicitly approved sellerFeeBasisPoints (0..10000)");
  }

  const variants = listToolNftVariants();
  const expectedKeys = new Set(variants.map((variant) => variant.key));
  const actualKeys = Object.keys(manifest.entries);
  for (const key of actualKeys) {
    if (!expectedKeys.has(key)) fail(`manifest contains unknown variant ${key}`);
  }
  for (const key of expectedKeys) {
    if (!Object.hasOwn(manifest.entries, key)) fail(`manifest is missing variant ${key}`);
  }
  if (actualKeys.length !== 25 || variants.length !== 25) {
    fail(`expected exactly 25 variants; found ${actualKeys.length} entries`);
  }

  const transactionIds = new Set();
  const validated = variants.map((variant) => {
    const entry = manifest.entries[variant.key];
    if (entry.toolType !== variant.toolType || entry.rarity !== variant.rarity || entry.imageFile !== variant.imageFile) {
      fail(`${variant.key} identity/artwork does not match the canonical 5x5 catalog`);
    }
    if (!TX_ID.test(entry.imageTxId || "") || !TX_ID.test(entry.metadataTxId || "")) {
      fail(`${variant.key} is missing a valid image or JSON transaction ID`);
    }
    if (entry.metadataImageTxId !== entry.imageTxId) {
      fail(`${variant.key} JSON is not bound to its recorded image transaction`);
    }
    if (!SHA256_HEX.test(entry.imageSha256 || "") || !SHA256_HEX.test(entry.metadataSha256 || "")) {
      fail(`${variant.key} is missing a valid SHA-256 content digest`);
    }
    const imageUri = arweaveUrl(entry.imageTxId);
    const metadataUri = arweaveUrl(entry.metadataTxId);
    if (entry.imageUri !== undefined && entry.imageUri !== imageUri) fail(`${variant.key} image URI differs from its transaction ID`);
    if (entry.metadataUri !== undefined && entry.metadataUri !== metadataUri) fail(`${variant.key} JSON URI differs from its transaction ID`);
    if (transactionIds.has(entry.imageTxId) || transactionIds.has(entry.metadataTxId)) {
      fail(`${variant.key} reuses an Arweave transaction ID from another asset`);
    }
    transactionIds.add(entry.imageTxId);
    transactionIds.add(entry.metadataTxId);
    return { variant, entry, imageUri, metadataUri };
  });
  if (transactionIds.size !== 50) fail(`expected 50 distinct Arweave transaction IDs; found ${transactionIds.size}`);
  return validated;
}

async function fetchAsset(fetchImpl, url, expectedMimeType, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { signal: controller.signal, redirect: "follow" });
    if (!response || response.status !== 200 || response.ok !== true) {
      fail(`${url} returned HTTP ${response?.status ?? "no response"}; wait for Arweave confirmation and retry`);
    }
    const contentType = String(response.headers?.get?.("content-type") || "").split(";", 1)[0].trim().toLowerCase();
    if (contentType !== expectedMimeType) {
      fail(`${url} returned Content-Type ${contentType || "(missing)"}, expected ${expectedMimeType}`);
    }
    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    if (error?.message?.startsWith("TOOL_NFT_ARWEAVE_VERIFY:")) throw error;
    if (controller.signal.aborted) fail(`${url} timed out after ${timeoutMs} ms`);
    fail(`${url} could not be fetched: ${error?.message || String(error)}`);
  } finally {
    clearTimeout(timeout);
  }
}

async function mapWithConcurrency(items, concurrency, callback) {
  const output = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      output[index] = await callback(items[index], index);
    }
  });
  await Promise.all(workers);
  return output;
}

export async function verifyToolNftReleaseManifest({
  manifest,
  repoRoot = TOOL_NFT_REPO_ROOT,
  fetchImpl = globalThis.fetch,
  concurrency = 4,
  timeoutMs = 30_000,
} = {}) {
  if (typeof fetchImpl !== "function") fail("fetch API is unavailable; use a supported Node.js version");
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 16) fail("concurrency must be from 1 through 16");
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 120_000) fail("timeoutMs must be from 1000 through 120000");

  const entries = validateToolNftReleaseManifest(manifest);
  await mapWithConcurrency(entries, concurrency, async ({ variant, entry, imageUri, metadataUri }) => {
    const localImagePath = path.join(repoRoot, "frontend/public/assets/nfts", variant.imageFile);
    if (!fs.existsSync(localImagePath)) fail(`${variant.key} local artwork is missing: ${localImagePath}`);
    const localImage = fs.readFileSync(localImagePath);
    if (sha256(localImage) !== entry.imageSha256) fail(`${variant.key} local artwork differs from the uploaded manifest digest`);

    const expectedMetadata = serializeToolNftMetadata(createToolNftMetadata({
      toolType: variant.toolType,
      rarity: variant.rarity,
      imageUri,
      sellerFeeBasisPoints: manifest.sellerFeeBasisPoints,
    }));
    if (sha256(expectedMetadata) !== entry.metadataSha256) fail(`${variant.key} expected JSON differs from the manifest digest`);

    const [imageBytes, metadataBytes] = await Promise.all([
      fetchAsset(fetchImpl, imageUri, "image/jpeg", timeoutMs),
      fetchAsset(fetchImpl, metadataUri, "application/json", timeoutMs),
    ]);
    if (sha256(imageBytes) !== entry.imageSha256) fail(`${variant.key} gateway image bytes do not match the local artwork`);
    if (sha256(metadataBytes) !== entry.metadataSha256) fail(`${variant.key} gateway JSON bytes do not match the release manifest`);
    let parsed;
    try {
      parsed = JSON.parse(metadataBytes.toString("utf8"));
    } catch {
      fail(`${variant.key} gateway JSON is not parseable`);
    }
    if (parsed.image !== imageUri) fail(`${variant.key} gateway JSON points at a different image URI`);
    if (JSON.stringify(parsed) !== JSON.stringify(JSON.parse(expectedMetadata.toString("utf8")))) {
      fail(`${variant.key} gateway JSON fields do not match the canonical metadata builder`);
    }
  });

  return { variantsVerified: entries.length, assetsVerified: entries.length * 2, transactionIdsVerified: entries.length * 2 };
}
