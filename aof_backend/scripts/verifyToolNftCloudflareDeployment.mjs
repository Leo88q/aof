#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_TOOL_NFT_CLOUDFLARE_DIR,
  TOOL_NFT_CLOUDFLARE_MANIFEST_NAME,
  verifyToolNftCloudflareDeployment,
} from "./toolNftCloudflare.mjs";

function usage() {
  console.log(`
Verify all 25 Cloudflare-hosted tool NFT image/JSON pairs with public HTTPS GET requests.

Usage:
  node scripts/verifyToolNftCloudflareDeployment.mjs [--bundle <directory>] [--manifest <file>]

Options:
  --bundle <directory>  Local prepared bundle (default: <repo>/out/tool-nft-cloudflare)
  --manifest <file>     Release manifest path (default: <bundle>/${TOOL_NFT_CLOUDFLARE_MANIFEST_NAME})
  --help                Show this help

Verification is read-only: no Cloudflare credentials, wallet, AR, or transactions are used.
`);
}

function parseArgs(argv) {
  const args = { bundleDir: DEFAULT_TOOL_NFT_CLOUDFLARE_DIR, manifestPath: null, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
      continue;
    }
    if (arg === "--bundle" || arg === "--manifest") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${arg} requires a value`);
      index += 1;
      if (arg === "--bundle") args.bundleDir = path.resolve(value);
      else args.manifestPath = path.resolve(value);
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }
  args.bundleDir = path.resolve(args.bundleDir);
  args.manifestPath ??= path.join(args.bundleDir, TOOL_NFT_CLOUDFLARE_MANIFEST_NAME);
  return args;
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
  } else {
    const manifest = JSON.parse(fs.readFileSync(args.manifestPath, "utf8"));
    const result = await verifyToolNftCloudflareDeployment({ manifest, outDir: args.bundleDir });
    console.log(`Verified ${result.variantsVerified} variants, ${result.assetsVerified} deployed assets; release ${result.releaseId}.`);
    console.log("All public Cloudflare URLs returned the canonical image and JSON bytes.");
  }
} catch (error) {
  console.error(`Cloudflare tool-NFT verification failed: ${error.message}`);
  process.exitCode = 1;
}
