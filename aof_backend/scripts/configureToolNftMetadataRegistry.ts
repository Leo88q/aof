#!/usr/bin/env node
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { SystemProgram } from "@solana/web3.js";

const BACKEND_ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(BACKEND_ROOT, "..");
const DEFAULT_BUNDLE = path.join(REPO_ROOT, "out/tool-nft-cloudflare");
const MANIFEST_NAME = "tool-nft-cloudflare-manifest.json";
const VERIFY_CLI = path.join(__dirname, "verifyToolNftCloudflareDeployment.mjs");
const DEVNET_GENESIS_HASH = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
const EXPECTED_URI_COUNT = 25;
const MAX_URI_BYTES = 80;
const BATCH_SIZE = 8;

function usage() {
  console.log(`
Prepare or configure the frozen 25-entry Devnet tool-NFT URI registry.

Usage:
  npm run nft:cloudflare:tool-metadata:registry [-- --bundle <dir>] [--manifest <file>]
  npm run nft:cloudflare:tool-metadata:registry -- --submit --freeze [--bundle <dir>] [--manifest <file>]

Default mode is a read-only plan. Both modes first GET and verify every public image/JSON URL.
--submit --freeze sends four Solana Devnet transactions; the final transaction irreversibly freezes the URI table.
The signer is read only from the backend's local AUTHORITY configuration; never pass key material as CLI arguments.
`);
}

function parseArgs(argv: string[]) {
  const args = {
    bundleDir: DEFAULT_BUNDLE,
    manifestPath: "",
    submit: false,
    freeze: false,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
      continue;
    }
    if (arg === "--submit" || arg === "--freeze") {
      if (arg === "--submit") args.submit = true;
      else args.freeze = true;
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
  args.manifestPath ||= path.join(args.bundleDir, MANIFEST_NAME);
  if (args.submit && !args.freeze) throw new Error("--submit requires --freeze so the final URI batch freezes this release; earlier batches are separate transactions");
  return args;
}

function verifyPublicRelease(bundleDir: string, manifestPath: string): void {
  const result = spawnSync(process.execPath, [VERIFY_CLI, "--bundle", bundleDir, "--manifest", manifestPath], {
    cwd: BACKEND_ROOT,
    stdio: "inherit",
  });
  if (result.error) throw new Error(`could not start the read-only Cloudflare verifier: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`public asset verification failed (exit ${result.status ?? "unknown"}); no Solana registry transaction was sent`);
}

function orderedMetadataUris(manifest: any): string[] {
  const entries = Object.values(manifest?.entries || {}) as any[];
  if (entries.length !== EXPECTED_URI_COUNT) throw new Error(`release manifest must contain exactly ${EXPECTED_URI_COUNT} entries`);
  const indexed = entries.map((entry) => {
    const match = /^r\/[a-f0-9]{20}\/m\/(\d{2})\.json$/.exec(entry.metadataPath || "");
    if (!match) throw new Error("release manifest metadata paths do not use the canonical compact on-chain URI layout");
    return { index: Number(match[1]), uri: entry.metadataUri };
  }).sort((left, right) => left.index - right.index);
  for (let index = 0; index < EXPECTED_URI_COUNT; index += 1) {
    if (indexed[index].index !== index) throw new Error(`release manifest metadata index ${index} is missing or duplicated`);
    if (typeof indexed[index].uri !== "string" || Buffer.byteLength(indexed[index].uri, "utf8") > MAX_URI_BYTES) {
      throw new Error(`metadata URI ${index} is missing or exceeds the on-chain ${MAX_URI_BYTES}-byte limit`);
    }
  }
  const uris = indexed.map((entry) => entry.uri);
  if (new Set(uris).size !== EXPECTED_URI_COUNT) throw new Error("release manifest metadata URIs are not all distinct");
  return uris;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }

  const manifest = JSON.parse(fs.readFileSync(args.manifestPath, "utf8"));
  const uris = orderedMetadataUris(manifest);
  // Always re-check the actual public deployment immediately before planning or writing.
  verifyPublicRelease(args.bundleDir, args.manifestPath);

  // Require the same finalized Devnet the release is intended for, regardless of
  // any optional EXPECTED_GENESIS_HASH setting in the local backend .env.
  const { AUTHORITY, AUTHORITY_PUBKEY } = require("../src/config");
  const { connection, program } = require("../src/provider");
  const { configPda, toolMetadataRegistryPda } = require("../src/lib/pda");
  const { authorityOnly } = require("../src/lib/tx");

  const genesisHash = await connection.getGenesisHash();
  if (genesisHash !== DEVNET_GENESIS_HASH) throw new Error(`wrong Solana cluster: expected Devnet, received genesis ${genesisHash}`);
  const [configAddress] = configPda();
  const [registryAddress] = toolMetadataRegistryPda();
  const config: any = await (program.account as any).config.fetch(configAddress);
  if (!config.authority.equals(AUTHORITY_PUBKEY)) throw new Error("local AUTHORITY_PUBKEY is not the on-chain Config authority");

  const registryClient: any = (program.account as any).toolMetadataRegistry;
  const existing: any = await registryClient.fetchNullable(registryAddress);
  if (existing?.frozen) {
    const isSameRelease = existing.sellerFeeBasisPoints === 0
      && Array.isArray(existing.metadataUris)
      && existing.metadataUris.length === EXPECTED_URI_COUNT
      && existing.metadataUris.every((uri: string, index: number) => uri === uris[index]);
    if (!isSameRelease) throw new Error("the on-chain tool metadata registry is already frozen with different release URIs; it cannot be changed");
    console.log("The on-chain registry is already frozen and exactly matches this verified Cloudflare release; no transaction needed.");
    return;
  }
  if (existing?.initialized && existing.sellerFeeBasisPoints !== 0) {
    throw new Error(`existing registry has seller_fee_basis_points=${existing.sellerFeeBasisPoints}; this release is approved only at 0 bps`);
  }

  const batches: Array<{ start: number; uris: string[]; freeze: boolean; instruction: any }> = [];
  for (let start = 0; start < uris.length; start += BATCH_SIZE) {
    const batchUris = uris.slice(start, start + BATCH_SIZE);
    const freeze = args.freeze && start + batchUris.length === uris.length;
    const instruction = await (program.methods as any)
      .setToolMetadataUris(start, batchUris, 0, freeze)
      .accounts({
        config: configAddress,
        authority: AUTHORITY_PUBKEY,
        toolMetadataRegistry: registryAddress,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    batches.push({ start, uris: batchUris, freeze, instruction });
  }

  console.log(`Verified release ${manifest.releaseId}; ${uris.length} unique metadata URIs fit the ${MAX_URI_BYTES}-byte on-chain limit.`);
  for (const batch of batches) {
    const end = batch.start + batch.uris.length - 1;
    console.log(`plan: registry indices ${batch.start}–${end}, ${batch.uris.length} URIs, freeze=${batch.freeze}, instruction=${batch.instruction.data.length} bytes`);
  }
  if (!args.submit) {
    console.log("Plan only. No Solana transaction was sent. Use --submit --freeze only after the Devnet bytecode and smoke gates are complete.");
    return;
  }
  if (!AUTHORITY) throw new Error("--submit requires AUTHORITY_MODE=hot and a locally configured authority signer");
  const currentBalance = await connection.getBalance(AUTHORITY.publicKey, "confirmed");
  console.log(`Submitting with local authority ${AUTHORITY.publicKey.toBase58()} (balance ${currentBalance} lamports).`);
  for (const batch of batches) {
    const signature = await authorityOnly([batch.instruction]);
    console.log(`confirmed registry indices ${batch.start}–${batch.start + batch.uris.length - 1}; signature=${signature}`);
  }
  console.log("Metadata URI registry is frozen. Mining flags and other registry statuses were not changed.");
}

main().catch((error) => {
  console.error(`Tool NFT Cloudflare registry configuration stopped: ${error.message}`);
  process.exitCode = 1;
});
