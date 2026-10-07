#!/usr/bin/env node
import path from "node:path";
import {
  buildToolNftCloudflareBundle,
  DEFAULT_TOOL_NFT_CLOUDFLARE_DIR,
} from "./toolNftCloudflare.mjs";

const DEFAULT_OUT_DIR = DEFAULT_TOOL_NFT_CLOUDFLARE_DIR;

function usage() {
  console.log(`
Prepare static Cloudflare Pages files for the 25 Devnet tool NFTs.

Usage:
  node scripts/prepareToolNftCloudflareBundle.mjs --base-url https://<project>.pages.dev [--out <directory>]

Options:
  --base-url <https-url>  Public Cloudflare Pages project/custom-domain origin (required)
  --out <directory>      Output bundle directory (default: <repo>/out/tool-nft-cloudflare)
  --help                 Show this help

This command is local-only: it writes JPEGs, canonical JSON metadata, and a release manifest.
It does not contact Cloudflare, read a wallet, spend AR, or submit Solana transactions.
`);
}

function parseArgs(argv) {
  const args = { baseUrl: null, outDir: DEFAULT_OUT_DIR, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
      continue;
    }
    if (arg === "--base-url" || arg === "--out") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${arg} requires a value`);
      index += 1;
      if (arg === "--base-url") args.baseUrl = value;
      else args.outDir = path.resolve(value);
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }
  if (!args.help && !args.baseUrl) throw new Error("--base-url is required so metadata points to the intended public Pages host");
  return args;
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
  } else {
    const { outDir, manifest } = buildToolNftCloudflareBundle({ baseUrl: args.baseUrl, outDir: args.outDir });
    console.log(`Prepared ${Object.keys(manifest.entries).length} metadata JSON files and 25 artwork files.`);
    console.log(`Cloudflare base URL: ${manifest.baseUrl}`);
    console.log(`Content release ID: ${manifest.releaseId}`);
    console.log(`Local bundle: ${outDir}`);
    console.log("No upload or transaction was performed.");
  }
} catch (error) {
  console.error(`Cloudflare tool-NFT bundle preparation stopped: ${error.message}`);
  process.exitCode = 1;
}
