#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_TOOL_NFT_MANIFEST,
  verifyToolNftReleaseManifest,
} from "./toolNftArweaveVerifier.mjs";

function usage() {
  console.log(`
Verify the finalized 5 × 5 tool-NFT Arweave release against the public gateway.

Usage:
  node scripts/verifyToolNftArweaveManifest.mjs [--manifest <file>] [--timeout-ms <ms>]

This read-only step requires a complete local uploader manifest and performs GETs
for all 25 image files and all 25 JSON documents. It reads no wallet, writes no
manifest, and never sends a Solana or Arweave transaction.
`);
}

function parseArgs(argv) {
  const result = { manifest: DEFAULT_TOOL_NFT_MANIFEST, timeoutMs: 30_000, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (arg === "--manifest" || arg === "--timeout-ms") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${arg} requires a value`);
      index += 1;
      if (arg === "--manifest") result.manifest = value;
      else {
        if (!/^\d+$/.test(value)) throw new Error("--timeout-ms must be an integer in milliseconds");
        result.timeoutMs = Number(value);
      }
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  return result;
}

function expandHome(value) {
  if (value === "~") return os.homedir();
  if (value.startsWith(`~${path.sep}`)) return path.join(os.homedir(), value.slice(2));
  return value;
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    usage();
    return;
  }
  const manifestPath = path.resolve(expandHome(args.manifest));
  if (!fs.existsSync(manifestPath)) throw new Error(`Local Arweave manifest not found: ${manifestPath}`);
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (error) {
    throw new Error(`Cannot parse local manifest ${manifestPath}: ${error.message}`);
  }
  console.log(`Read-only gateway verification: ${manifestPath}`);
  console.log("Fetching exactly 25 images and 25 metadata JSON files from https://arweave.net; no transactions will be sent.");
  const result = await verifyToolNftReleaseManifest({ manifest, timeoutMs: args.timeoutMs });
  console.log(`VERIFIED: ${result.variantsVerified} variants, ${result.assetsVerified} gateway assets, ${result.transactionIdsVerified} distinct Arweave transaction IDs.`);
  console.log("All gateway bytes match the local artwork and the canonical metadata builder. No Solana transaction has been sent.");
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Tool NFT Arweave verification stopped: ${error.message}`);
    process.exitCode = 1;
  });
}
