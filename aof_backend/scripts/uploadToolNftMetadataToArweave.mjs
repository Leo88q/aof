#!/usr/bin/env node
import Arweave from "arweave";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  arweaveUrl,
  createToolNftMetadata,
  formatWinstonAsAr,
  listToolNftVariants,
  parseArAsWinston,
  serializeToolNftMetadata,
} from "./toolNftMetadata.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const DEFAULT_MANIFEST = path.join(REPO_ROOT, "out/tool-nft-arweave-manifest.json");
const PLACEHOLDER_TX_ID = "A".repeat(43);

function usage() {
  console.log(`
Prepare English metadata and estimate Arweave-mainnet upload cost for the 25 tool NFTs.

Usage:
  node scripts/uploadToolNftMetadataToArweave.mjs [--estimate]
  node scripts/uploadToolNftMetadataToArweave.mjs --upload --max-cost-ar <AR> --seller-fee-bps <bps> [--jwk <local-file>] [--manifest <file>]

Options:
  --estimate              Estimate pending image + JSON transactions (default; no wallet needed)
  --upload                Explicitly submit pending transactions to Arweave mainnet
  --max-cost-ar <amount>  Maximum total AR-denominated transaction rewards for this run; required with --upload
  --seller-fee-bps <bps>  Explicitly selected seller-fee basis points (0..10000); required with --upload
  --jwk <local-file>      Local Arweave JWK path (or set ARWEAVE_JWK_PATH); never put key contents in chat
  --manifest <file>       Local resumable manifest (default: <repo>/out/tool-nft-arweave-manifest.json)
  --help                  Show this help

The default mode is read-only with respect to Arweave. Solana transactions are never sent by this script.
`);
}

function parseArgs(argv) {
  const args = { mode: "estimate", maxCostAr: null, sellerFeeBps: null, jwkPath: process.env.ARWEAVE_JWK_PATH || null, manifestPath: DEFAULT_MANIFEST };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--estimate") {
      if (args.mode === "upload") throw new Error("Choose only one of --estimate or --upload");
      args.mode = "estimate";
    } else if (arg === "--upload") {
      if (args.mode === "estimate" && argv.includes("--estimate")) throw new Error("Choose only one of --estimate or --upload");
      args.mode = "upload";
    } else if (arg === "--max-cost-ar" || arg === "--seller-fee-bps" || arg === "--jwk" || arg === "--manifest") {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) throw new Error(`${arg} requires a value`);
      i += 1;
      if (arg === "--max-cost-ar") args.maxCostAr = value;
      if (arg === "--seller-fee-bps") args.sellerFeeBps = value;
      if (arg === "--jwk") args.jwkPath = value;
      if (arg === "--manifest") args.manifestPath = value;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  if (args.mode === "upload" && args.maxCostAr === null) {
    throw new Error("--upload requires --max-cost-ar <AR> so spending is explicitly bounded");
  }
  if (args.mode === "estimate" && args.maxCostAr !== null) {
    throw new Error("--max-cost-ar is only valid together with --upload");
  }
  if (args.sellerFeeBps !== null) {
    if (!/^(?:0|[1-9]\d*)$/.test(args.sellerFeeBps) || Number(args.sellerFeeBps) > 10_000) {
      throw new Error("--seller-fee-bps must be an integer from 0 through 10000");
    }
    args.sellerFeeBps = Number(args.sellerFeeBps);
  }
  if (args.mode === "upload" && args.sellerFeeBps === null) {
    throw new Error("--upload requires an explicit --seller-fee-bps because no tool-NFT royalty value is approved in the repository");
  }
  if (args.mode === "upload" && !args.jwkPath) {
    throw new Error("Set ARWEAVE_JWK_PATH or provide --jwk <local-file> for explicit uploads");
  }
  return args;
}

function expandHome(filePath) {
  if (filePath === "~") return os.homedir();
  if (filePath.startsWith(`~${path.sep}`)) return path.join(os.homedir(), filePath.slice(2));
  return filePath;
}

function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}

function newManifest() {
  return {
    schemaVersion: 1,
    network: "Arweave mainnet",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    entries: {},
  };
}

function saveManifest(filePath, manifest) {
  const absolute = path.resolve(filePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  manifest.updatedAt = new Date().toISOString();
  const temporary = `${absolute}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, absolute);
}

function loadManifest(filePath, variants, sourceByKey, sellerFeeBps) {
  const absolute = path.resolve(filePath);
  let manifest = newManifest();
  if (fs.existsSync(absolute)) {
    try {
      manifest = JSON.parse(fs.readFileSync(absolute, "utf8"));
    } catch (error) {
      throw new Error(`Cannot parse local manifest ${absolute}: ${error.message}`);
    }
    if (manifest.schemaVersion !== 1 || manifest.network !== "Arweave mainnet" || !manifest.entries || typeof manifest.entries !== "object") {
      throw new Error(`Unsupported or malformed Arweave manifest: ${absolute}`);
    }
  }

  const expectedSellerFeeBps = sellerFeeBps ?? null;
  if (manifest.sellerFeeBasisPoints !== undefined && manifest.sellerFeeBasisPoints !== expectedSellerFeeBps) {
    throw new Error("The manifest is bound to a different seller-fee value; use a separate manifest for a different release configuration");
  }
  manifest.sellerFeeBasisPoints = expectedSellerFeeBps;

  const expectedKeys = new Set(variants.map((variant) => variant.key));
  for (const key of Object.keys(manifest.entries)) {
    if (!expectedKeys.has(key)) throw new Error(`Manifest contains an unknown variant ${key}; keep old release manifests separate`);
  }

  for (const variant of variants) {
    const source = sourceByKey.get(variant.key);
    const record = manifest.entries[variant.key] || {};
    if (record.imageFile && record.imageFile !== variant.imageFile) throw new Error(`${variant.key}: artwork path changed; use a new manifest rather than overwrite release history`);
    if (record.imageSha256 && record.imageSha256 !== source.sha256) throw new Error(`${variant.key}: artwork bytes changed; use a new manifest for the new artwork`);
    record.toolType = variant.toolType;
    record.rarity = variant.rarity;
    record.imageFile = variant.imageFile;
    record.imageSha256 = source.sha256;
    record.imageTxId ??= null;
    record.metadataTxId ??= null;
    record.metadataSha256 ??= null;
    record.metadataImageTxId ??= null;
    if (record.imageTxId !== null && !/^[A-Za-z0-9_-]{43}$/.test(record.imageTxId)) {
      throw new Error(`${variant.key}: invalid image transaction ID in manifest`);
    }
    if (record.metadataTxId !== null && !/^[A-Za-z0-9_-]{43}$/.test(record.metadataTxId)) {
      throw new Error(`${variant.key}: invalid metadata transaction ID in manifest`);
    }
    if (record.metadataTxId && (!record.imageTxId || record.metadataImageTxId !== record.imageTxId)) {
      throw new Error(`${variant.key}: metadata manifest entry does not reference its recorded image transaction`);
    }
    if (record.metadataTxId) {
      const expected = serializeToolNftMetadata(createToolNftMetadata({
        toolType: variant.toolType,
        rarity: variant.rarity,
        imageUri: arweaveUrl(record.imageTxId),
        sellerFeeBasisPoints: sellerFeeBps ?? undefined,
      }));
      if (!record.metadataSha256 || record.metadataSha256 !== sha256(expected)) {
        throw new Error(`${variant.key}: metadata JSON no longer matches the recorded content; use a new manifest`);
      }
    }
    record.imageUri = record.imageTxId ? arweaveUrl(record.imageTxId) : null;
    record.metadataUri = record.metadataTxId ? arweaveUrl(record.metadataTxId) : null;
    manifest.entries[variant.key] = record;
  }
  return manifest;
}

function collectSources(variants) {
  const result = new Map();
  for (const variant of variants) {
    const absolutePath = path.join(REPO_ROOT, "frontend/public/assets/nfts", variant.imageFile);
    if (!fs.existsSync(absolutePath)) throw new Error(`Missing artwork for ${variant.key}: ${absolutePath}`);
    const bytes = fs.readFileSync(absolutePath);
    if (bytes.length === 0) throw new Error(`Artwork is empty: ${absolutePath}`);
    result.set(variant.key, { bytes, sha256: sha256(bytes) });
  }
  return result;
}

function pendingTasks(variants, manifest, sourceByKey, sellerFeeBps) {
  const tasks = [];
  for (const variant of variants) {
    const record = manifest.entries[variant.key];
    if (!record.imageTxId) {
      tasks.push({ variant, stage: "image", bytes: sourceByKey.get(variant.key).bytes, mimeType: "image/jpeg" });
    }
    if (!record.metadataTxId) {
      const imageUri = record.imageTxId ? arweaveUrl(record.imageTxId) : arweaveUrl(PLACEHOLDER_TX_ID);
      const bytes = serializeToolNftMetadata(createToolNftMetadata({
        toolType: variant.toolType,
        rarity: variant.rarity,
        imageUri,
        sellerFeeBasisPoints: sellerFeeBps ?? undefined,
      }));
      tasks.push({ variant, stage: "metadata JSON", bytes, mimeType: "application/json" });
    }
  }
  return tasks;
}

async function mapWithConcurrency(items, concurrency, callback) {
  const output = new Array(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      output[index] = await callback(items[index], index);
    }
  });
  await Promise.all(workers);
  return output;
}

function createArweaveClient() {
  return Arweave.init({ host: "arweave.net", port: 443, protocol: "https", timeout: 60_000, logging: false });
}

async function getCostEstimates(arweave, tasks) {
  return mapWithConcurrency(tasks, 4, async (task) => {
    const price = await arweave.transactions.getPrice(task.bytes.length);
    return { ...task, priceWinston: BigInt(price.toString()) };
  });
}

function printEstimate(rows, totalWinston) {
  console.log("\nVariant                         Stage          Bytes       Estimated AR");
  console.log("-".repeat(76));
  for (const row of rows) {
    const label = `${row.variant.toolType} / ${row.variant.displayRarity}`;
    console.log(`${label.padEnd(32)} ${row.stage.padEnd(14)} ${String(row.bytes.length).padStart(8)} ${formatWinstonAsAr(row.priceWinston)}`);
  }
  console.log("-".repeat(76));
  console.log(`Pending transactions: ${rows.length}`);
  console.log(`Estimated transaction rewards: ${formatWinstonAsAr(totalWinston)} AR`);
  console.log("Estimate only: Arweave prices can change before signing; no transaction has been submitted.\n");
}

function loadWallet(filePath) {
  const absolute = path.resolve(expandHome(filePath));
  const stat = fs.statSync(absolute);
  if (!stat.isFile()) throw new Error("ARWEAVE_JWK_PATH must point to a regular local file");
  if (process.platform !== "win32" && (stat.mode & 0o077) !== 0) {
    throw new Error(`Arweave JWK permissions are too broad (${(stat.mode & 0o777).toString(8)}); run chmod 600 ${absolute}`);
  }
  const wallet = JSON.parse(fs.readFileSync(absolute, "utf8"));
  if (!wallet || wallet.kty !== "RSA" || typeof wallet.d !== "string") {
    throw new Error("The local Arweave key file is not a private RSA JWK");
  }
  return wallet;
}

async function postTransaction(arweave, wallet, bytes, mimeType, costLimitWinston, alreadySpentWinston) {
  const transaction = await arweave.createTransaction({ data: bytes }, wallet);
  transaction.addTag("Content-Type", mimeType);
  transaction.addTag("App-Name", "NeuroForge-Tool-NFT-Metadata");
  await arweave.transactions.sign(transaction, wallet);

  const rewardWinston = BigInt(transaction.reward);
  if (alreadySpentWinston + rewardWinston > costLimitWinston) {
    throw new Error(
      `Actual reward ${formatWinstonAsAr(rewardWinston)} AR would exceed the remaining --max-cost-ar allowance; transaction ${transaction.id} was not posted`,
    );
  }
  const response = await arweave.transactions.post(transaction);
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Arweave node returned HTTP ${response.status} for transaction ${transaction.id}; inspect the local manifest before retrying`);
  }
  return { txId: transaction.id, rewardWinston };
}

async function runUpload({ arweave, wallet, variants, sourceByKey, manifest, manifestPath, costLimitWinston, estimatedTotalWinston, pendingCount, sellerFeeBps }) {
  const address = await arweave.wallets.getAddress(wallet);
  console.log(`Arweave uploader: ${address}`);
  console.log(`Estimated pending rewards: ${formatWinstonAsAr(estimatedTotalWinston)} AR; user-set ceiling: ${formatWinstonAsAr(costLimitWinston)} AR`);
  console.log(`Pending transactions: ${pendingCount}. Submitting only after explicit --upload and --max-cost-ar flags. This writes to Arweave mainnet.\n`);

  let spentWinston = 0n;
  let acceptedTransactions = 0;
  for (const variant of variants) {
    const record = manifest.entries[variant.key];
    if (!record.imageTxId) {
      const image = sourceByKey.get(variant.key).bytes;
      const result = await postTransaction(arweave, wallet, image, "image/jpeg", costLimitWinston, spentWinston);
      spentWinston += result.rewardWinston;
      acceptedTransactions += 1;
      record.imageTxId = result.txId;
      record.imageUri = arweaveUrl(result.txId);
      console.log(`${variant.key}: image submitted ${result.txId} (${formatWinstonAsAr(result.rewardWinston)} AR)`);
      saveManifest(manifestPath, manifest);
    }
    if (!record.metadataTxId) {
      const metadataBytes = serializeToolNftMetadata(createToolNftMetadata({
        toolType: variant.toolType,
        rarity: variant.rarity,
        imageUri: arweaveUrl(record.imageTxId),
        sellerFeeBasisPoints: sellerFeeBps ?? undefined,
      }));
      const metadataHash = sha256(metadataBytes);
      const result = await postTransaction(arweave, wallet, metadataBytes, "application/json", costLimitWinston, spentWinston);
      spentWinston += result.rewardWinston;
      acceptedTransactions += 1;
      record.metadataImageTxId = record.imageTxId;
      record.metadataSha256 = metadataHash;
      record.metadataTxId = result.txId;
      record.metadataUri = arweaveUrl(result.txId);
      console.log(`${variant.key}: JSON submitted ${result.txId} (${formatWinstonAsAr(result.rewardWinston)} AR)`);
      saveManifest(manifestPath, manifest);
    }
  }
  manifest.status = "submitted";
  saveManifest(manifestPath, manifest);
  console.log(`\n${acceptedTransactions} pending transactions were accepted by an Arweave node; spent rewards: ${formatWinstonAsAr(spentWinston)} AR.`);
  console.log("Node acceptance is not final confirmation. Wait for Arweave confirmation and verify the gateway URLs before using metadata URIs on Solana.");
  console.log(`Local manifest: ${path.resolve(manifestPath)}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }
  const costLimitWinston = args.mode === "upload" ? parseArAsWinston(args.maxCostAr) : null;

  const variants = listToolNftVariants();
  if (variants.length !== 25) throw new Error(`Expected 25 tool variants, found ${variants.length}`);
  const sourceByKey = collectSources(variants);
  const manifest = loadManifest(args.manifestPath, variants, sourceByKey, args.sellerFeeBps);
  const tasks = pendingTasks(variants, manifest, sourceByKey, args.sellerFeeBps);
  const arweave = createArweaveClient();
  const estimates = await getCostEstimates(arweave, tasks);
  const totalWinston = estimates.reduce((sum, row) => sum + row.priceWinston, 0n);
  printEstimate(estimates, totalWinston);
  if (args.sellerFeeBps === null) {
    console.log("Draft only: seller_fee_basis_points is omitted because no tool-NFT royalty value is approved; this quote does not include that field.\n");
  } else {
    console.log(`Metadata JSON includes the explicitly supplied seller fee: ${args.sellerFeeBps} bps. Confirm that value is approved before any upload.\n`);
  }

  if (args.mode === "estimate") {
    console.log(`Local manifest (read-only in estimate mode): ${path.resolve(args.manifestPath)}\n`);
    return;
  }

  if (totalWinston > costLimitWinston) {
    throw new Error(`Estimated cost ${formatWinstonAsAr(totalWinston)} AR exceeds --max-cost-ar ${args.maxCostAr}; nothing was uploaded`);
  }
  const wallet = loadWallet(expandHome(args.jwkPath));
  await runUpload({
    arweave,
    wallet,
    variants,
    sourceByKey,
    manifest,
    manifestPath: args.manifestPath,
    costLimitWinston,
    estimatedTotalWinston: totalWinston,
    pendingCount: tasks.length,
    sellerFeeBps: args.sellerFeeBps,
  });
}

try {
  await main();
} catch (error) {
  console.error(`Tool NFT Arweave utility stopped: ${error.message}`);
  process.exitCode = 1;
}
