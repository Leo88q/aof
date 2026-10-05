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
const APPROVED_MAX_COST_AR = "0.20";
const APPROVED_MAX_COST_WINSTON = parseArAsWinston(APPROVED_MAX_COST_AR);
const APPROVED_SELLER_FEE_BPS = 0;

function usage() {
  console.log(`
Prepare English metadata and estimate Arweave-mainnet upload cost for the 25 tool NFTs.

Usage:
  node scripts/uploadToolNftMetadataToArweave.mjs [--estimate]
  node scripts/uploadToolNftMetadataToArweave.mjs --upload --max-cost-ar <AR> --seller-fee-bps <bps> [--jwk <local-file>] [--manifest <file>]

Options:
  --estimate              Estimate pending image + JSON transactions (default; no wallet needed)
  --upload                Explicitly submit pending transactions to Arweave mainnet
  --max-cost-ar <amount>  Cumulative release ceiling; required with --upload and hard-capped at 0.20 AR
  --seller-fee-bps <bps>  Seller-fee basis points; required with --upload (this release permits only 0)
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
    schemaVersion: 2,
    network: "Arweave mainnet",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    inFlightTransaction: null,
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
    if (manifest.network !== "Arweave mainnet" || !manifest.entries || typeof manifest.entries !== "object" || Array.isArray(manifest.entries)) {
      throw new Error(`Unsupported or malformed Arweave manifest: ${absolute}`);
    }
    if (manifest.schemaVersion === 1) {
      const containsPreviousUploads = Object.values(manifest.entries).some((entry) => entry?.imageTxId || entry?.metadataTxId);
      if (containsPreviousUploads) {
        throw new Error("Legacy manifest contains uploaded transaction IDs but no reward receipts; reconcile prior Arweave spend before resuming under the cumulative cap");
      }
      manifest.schemaVersion = 2;
    } else if (manifest.schemaVersion !== 2) {
      throw new Error(`Unsupported or malformed Arweave manifest: ${absolute}`);
    }
    manifest.inFlightTransaction ??= null;
    if (manifest.inFlightTransaction) {
      const pending = manifest.inFlightTransaction;
      throw new Error(
        `Manifest has an unresolved in-flight Arweave transaction ${pending.txId} (${pending.variantKey} ${pending.stage}); reconcile its network status before any estimate or upload`,
      );
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
    const record = manifest.entries[variant.key] === undefined ? {} : manifest.entries[variant.key];
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      throw new Error(`${variant.key}: malformed manifest entry`);
    }
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
    record.imageRewardWinston ??= null;
    record.metadataRewardWinston ??= null;
    if (record.imageTxId !== null && !/^[A-Za-z0-9_-]{43}$/.test(record.imageTxId)) {
      throw new Error(`${variant.key}: invalid image transaction ID in manifest`);
    }
    if (record.metadataTxId !== null && !/^[A-Za-z0-9_-]{43}$/.test(record.metadataTxId)) {
      throw new Error(`${variant.key}: invalid metadata transaction ID in manifest`);
    }
    for (const [txIdField, rewardField] of [
      ["imageTxId", "imageRewardWinston"],
      ["metadataTxId", "metadataRewardWinston"],
    ]) {
      const hasTransaction = record[txIdField] !== null;
      const reward = record[rewardField];
      if (hasTransaction && (typeof reward !== "string" || !/^\d+$/.test(reward))) {
        throw new Error(`${variant.key}: ${rewardField} must record the accepted transaction reward in Winston`);
      }
      if (!hasTransaction && reward !== null) {
        throw new Error(`${variant.key}: ${rewardField} exists without its transaction ID`);
      }
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

function getManifestSpentWinston(manifest) {
  let total = 0n;
  for (const record of Object.values(manifest.entries)) {
    if (record.imageRewardWinston !== null) total += BigInt(record.imageRewardWinston);
    if (record.metadataRewardWinston !== null) total += BigInt(record.metadataRewardWinston);
  }
  return total;
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

const READ_RETRY_MAX_ATTEMPTS = 5;
const READ_RETRY_DELAYS_MS = [500, 1_000, 2_000, 4_000];
const RETRYABLE_NETWORK_CODES = new Set([
  "ECONNRESET", "ETIMEDOUT", "EAI_AGAIN", "ECONNREFUSED", "ENETUNREACH",
  "EHOSTUNREACH", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_SOCKET",
]);

function priceLookupErrorSummary(error) {
  const message = error instanceof Error ? error.message : String(error);
  const causeCode = error?.cause?.code;
  return causeCode ? `${message} (cause ${causeCode})` : message;
}

function isRetryableReadError(error) {
  if (RETRYABLE_NETWORK_CODES.has(error?.cause?.code ?? error?.code)) return true;
  if (error?.name === "TypeError" && /fetch failed/i.test(error.message ?? "")) return true;
  return /(?:status|http)\s*(?:code\s*)?(?:429|502|503|504)\b/i.test(error?.message ?? "");
}

async function retryRead(label, request) {
  let lastError;
  for (let attempt = 1; attempt <= READ_RETRY_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await request();
    } catch (error) {
      lastError = error;
      if (attempt === READ_RETRY_MAX_ATTEMPTS || !isRetryableReadError(error)) break;
      const delayMs = READ_RETRY_DELAYS_MS[attempt - 1];
      console.warn(
        `${label} failed (attempt ${attempt}/${READ_RETRY_MAX_ATTEMPTS}): ` +
        `${priceLookupErrorSummary(error)}; retrying in ${delayMs} ms.`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error(
    `${label} failed after at most ${READ_RETRY_MAX_ATTEMPTS} attempts: ${priceLookupErrorSummary(lastError)}`,
    { cause: lastError },
  );
}

async function getPriceWithRetry(arweave, task) {
  const label = `Price lookup for ${task.variant.key} ${task.stage} (${task.bytes.length} bytes)`;
  const price = await retryRead(label, () => arweave.transactions.getPrice(task.bytes.length));
  const priceText = price.toString();
  if (!/^\d+$/.test(priceText)) throw new Error(`${label}: Arweave returned a non-integer transaction price`);
  return BigInt(priceText);
}

async function getTransactionAnchorWithRetry(arweave, task) {
  return retryRead(
    `Anchor lookup for ${task.variant.key} ${task.stage}`,
    () => arweave.transactions.getTransactionAnchor(),
  );
}

async function getCostEstimates(arweave, tasks) {
  // Keep requests sequential: the gateway is reachable for isolated lookups,
  // while bursts of parallel price queries can fail with an opaque `fetch failed`.
  // Preserve each failure and continue so the full pending matrix is reported.
  return mapWithConcurrency(tasks, 1, async (task) => {
    try {
      return {
        ...task,
        priceWinston: await getPriceWithRetry(arweave, task),
      };
    } catch (error) {
      return { ...task, priceError: error };
    }
  });
}

function printEstimate(rows, totalWinston) {
  console.log("\nVariant                         Stage          Bytes       Estimated AR");
  console.log("-".repeat(76));
  for (const row of rows) {
    const label = `${row.variant.toolType} / ${row.variant.displayRarity}`;
    const price = row.priceError
      ? `UNAVAILABLE: ${priceLookupErrorSummary(row.priceError)}`
      : formatWinstonAsAr(row.priceWinston);
    console.log(`${label.padEnd(32)} ${row.stage.padEnd(14)} ${String(row.bytes.length).padStart(8)} ${price}`);
  }
  console.log("-".repeat(76));
  const failedCount = rows.filter((row) => row.priceError).length;
  const successCount = rows.length - failedCount;
  console.log(`Pending transactions: ${rows.length}`);
  console.log(`Price lookups: ${successCount} succeeded, ${failedCount} failed`);
  if (failedCount === 0) {
    console.log(`Estimated transaction rewards: ${formatWinstonAsAr(totalWinston)} AR`);
  } else {
    console.log(`Partial sum for ${successCount} priced transactions: ${formatWinstonAsAr(totalWinston)} AR; this is NOT a complete estimate.`);
  }
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

async function postTransaction(arweave, wallet, task, mimeType, costLimitWinston, alreadySpentWinston, manifest, manifestPath) {
  // Use retry-wrapped, fresh read calls explicitly: createTransaction otherwise
  // performs its own un-retried GETs for reward and tx anchor.
  const rewardWinston = await getPriceWithRetry(arweave, task);
  const lastTx = await getTransactionAnchorWithRetry(arweave, task);
  const transaction = await arweave.createTransaction({
    data: task.bytes,
    reward: rewardWinston.toString(),
    last_tx: lastTx,
  }, wallet);
  transaction.addTag("Content-Type", mimeType);
  transaction.addTag("App-Name", "NeuroForge-Tool-NFT-Metadata");
  await arweave.transactions.sign(transaction, wallet);

  const signedRewardWinston = BigInt(transaction.reward);
  if (signedRewardWinston !== rewardWinston) {
    throw new Error(`Transaction reward changed after signing for ${task.variant.key} ${task.stage}; nothing was posted`);
  }
  if (alreadySpentWinston + signedRewardWinston > costLimitWinston) {
    throw new Error(
      `Actual cumulative reward ${formatWinstonAsAr(alreadySpentWinston + signedRewardWinston)} AR would exceed the --max-cost-ar ceiling; transaction ${transaction.id} was not posted`,
    );
  }
  if (manifest.inFlightTransaction) {
    throw new Error(`Manifest already has unresolved transaction ${manifest.inFlightTransaction.txId}; refusing to submit another transaction`);
  }

  // Persist a transaction ID and cost reservation before POST. If the process or
  // network fails ambiguously, the next run will stop rather than duplicate spend.
  manifest.status = "uploading";
  manifest.inFlightTransaction = {
    variantKey: task.variant.key,
    stage: task.stage,
    txId: transaction.id,
    rewardWinston: signedRewardWinston.toString(),
    preparedAt: new Date().toISOString(),
  };
  saveManifest(manifestPath, manifest);

  let response;
  try {
    response = await arweave.transactions.post(transaction);
  } catch (error) {
    throw new Error(
      `Arweave POST outcome is unknown for ${transaction.id}; the transaction reservation is saved in ${path.resolve(manifestPath)}. Reconcile this ID before retrying: ${priceLookupErrorSummary(error)}`,
      { cause: error },
    );
  }
  if (!response || !Number.isInteger(response.status) || response.status < 200 || response.status >= 300) {
    throw new Error(
      `Arweave node returned HTTP ${response?.status ?? "no status"} for ${transaction.id}; its saved manifest reservation must be reconciled before another upload`,
    );
  }

  const record = manifest.entries[task.variant.key];
  if (task.stage === "image") {
    record.imageTxId = transaction.id;
    record.imageUri = arweaveUrl(transaction.id);
    record.imageRewardWinston = signedRewardWinston.toString();
  } else if (task.stage === "metadata JSON") {
    if (!record.imageTxId) throw new Error(`${task.variant.key}: refusing metadata upload without a recorded image transaction`);
    record.metadataImageTxId = record.imageTxId;
    record.metadataSha256 = sha256(task.bytes);
    record.metadataTxId = transaction.id;
    record.metadataUri = arweaveUrl(transaction.id);
    record.metadataRewardWinston = signedRewardWinston.toString();
  } else {
    throw new Error(`Unsupported upload stage: ${task.stage}`);
  }
  manifest.inFlightTransaction = null;
  saveManifest(manifestPath, manifest);
  return { txId: transaction.id, rewardWinston: signedRewardWinston };
}

async function runUpload({ arweave, wallet, variants, sourceByKey, manifest, manifestPath, costLimitWinston, alreadySpentWinston, estimatedTotalWinston, pendingCount, sellerFeeBps }) {
  const address = await arweave.wallets.getAddress(wallet);
  console.log(`Arweave uploader: ${address}`);
  console.log(`Previously recorded rewards: ${formatWinstonAsAr(alreadySpentWinston)} AR`);
  console.log(`Estimated pending rewards: ${formatWinstonAsAr(estimatedTotalWinston)} AR; cumulative release ceiling: ${formatWinstonAsAr(costLimitWinston)} AR`);
  console.log(`Pending transactions: ${pendingCount}. Submitting only after explicit --upload and --max-cost-ar flags. This writes to Arweave mainnet.\n`);

  let spentWinston = alreadySpentWinston;
  let acceptedTransactions = 0;
  for (const variant of variants) {
    const record = manifest.entries[variant.key];
    if (!record.imageTxId) {
      const image = sourceByKey.get(variant.key).bytes;
      const result = await postTransaction(
        arweave,
        wallet,
        { variant, stage: "image", bytes: image },
        "image/jpeg",
        costLimitWinston,
        spentWinston,
        manifest,
        manifestPath,
      );
      spentWinston += result.rewardWinston;
      acceptedTransactions += 1;
      console.log(`${variant.key}: image submitted ${result.txId} (${formatWinstonAsAr(result.rewardWinston)} AR)`);
    }
    if (!record.metadataTxId) {
      const metadataBytes = serializeToolNftMetadata(createToolNftMetadata({
        toolType: variant.toolType,
        rarity: variant.rarity,
        imageUri: arweaveUrl(record.imageTxId),
        sellerFeeBasisPoints: sellerFeeBps ?? undefined,
      }));
      const result = await postTransaction(
        arweave,
        wallet,
        { variant, stage: "metadata JSON", bytes: metadataBytes },
        "application/json",
        costLimitWinston,
        spentWinston,
        manifest,
        manifestPath,
      );
      spentWinston += result.rewardWinston;
      acceptedTransactions += 1;
      console.log(`${variant.key}: JSON submitted ${result.txId} (${formatWinstonAsAr(result.rewardWinston)} AR)`);
    }
  }
  manifest.status = "submitted";
  saveManifest(manifestPath, manifest);
  console.log(`\n${acceptedTransactions} pending transactions were accepted by an Arweave node; total cumulative release rewards: ${formatWinstonAsAr(spentWinston)} AR.`);
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
  if (args.mode === "upload" && costLimitWinston > APPROVED_MAX_COST_WINSTON) {
    throw new Error(`--max-cost-ar cannot exceed the approved hard ceiling of ${APPROVED_MAX_COST_AR} AR`);
  }
  if (args.mode === "upload" && args.sellerFeeBps !== APPROVED_SELLER_FEE_BPS) {
    throw new Error(`Only the approved ${APPROVED_SELLER_FEE_BPS} bps seller fee is enabled for this release`);
  }

  const variants = listToolNftVariants();
  if (variants.length !== 25) throw new Error(`Expected 25 tool variants, found ${variants.length}`);
  const sourceByKey = collectSources(variants);
  const manifest = loadManifest(args.manifestPath, variants, sourceByKey, args.sellerFeeBps);
  const alreadySpentWinston = getManifestSpentWinston(manifest);
  if (args.mode === "upload" && alreadySpentWinston > costLimitWinston) {
    throw new Error(`Recorded cumulative rewards ${formatWinstonAsAr(alreadySpentWinston)} AR already exceed --max-cost-ar ${args.maxCostAr}`);
  }
  const tasks = pendingTasks(variants, manifest, sourceByKey, args.sellerFeeBps);
  const arweave = createArweaveClient();
  const estimates = await getCostEstimates(arweave, tasks);
  const failedPriceLookups = estimates.filter((row) => row.priceError);
  const totalWinston = estimates
    .filter((row) => !row.priceError)
    .reduce((sum, row) => sum + row.priceWinston, 0n);
  printEstimate(estimates, totalWinston);
  if (args.sellerFeeBps === null) {
    console.log("Draft only: seller_fee_basis_points is omitted because no --seller-fee-bps was supplied; this quote does not include that field.\n");
  } else {
    console.log(`Metadata JSON includes the explicitly supplied seller fee: ${args.sellerFeeBps} bps.\n`);
  }

  if (failedPriceLookups.length > 0) {
    throw new Error(
      `Complete estimate unavailable: ${failedPriceLookups.length} of ${tasks.length} pending price lookups failed after retries; no upload was attempted`,
    );
  }

  const projectedCumulativeWinston = alreadySpentWinston + totalWinston;
  console.log(`Previously recorded release rewards: ${formatWinstonAsAr(alreadySpentWinston)} AR`);
  console.log(`Projected cumulative release rewards: ${formatWinstonAsAr(projectedCumulativeWinston)} AR\n`);
  if (args.mode === "estimate") {
    console.log(`Local manifest (read-only in estimate mode): ${path.resolve(args.manifestPath)}\n`);
    return;
  }

  if (projectedCumulativeWinston > costLimitWinston) {
    throw new Error(
      `Projected cumulative cost ${formatWinstonAsAr(projectedCumulativeWinston)} AR exceeds --max-cost-ar ${args.maxCostAr}; nothing was uploaded`,
    );
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
    alreadySpentWinston,
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
