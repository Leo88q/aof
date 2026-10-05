import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { BorshAccountsCoder } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import idl from "../src/idl/aof_core.json";
import { buildCanonicalResourceMints, resourceMintEntries } from "../src/lib/resourceRegistryCore";

const GENESIS_DEVNET = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
const PROGRAM_ID = new PublicKey(idl.address);
const RPC_URL = process.env.DEVNET_RPC_URL || process.env.RPC_URL || "https://api.devnet.solana.com";
const OUT = resolve(process.env.ISSUANCE_BASELINE_FILE || join(__dirname, "../reports/devnet-issuance-baseline.json"));
const PAGE_SIZE = 1_000;
const CONCURRENCY = Math.max(1, Math.min(12, Number(process.env.HISTORY_CONCURRENCY || 4)));
const MAX_RETRIES = 5;

type MintHistory = {
  mint: string;
  totalMintedAtoms: string;
  totalBurnedAtoms: string;
  currentSupplyAtoms: string;
  reconstructedSupplyAtoms: string;
  supplyMatches: boolean;
  mintInitialized: boolean;
  initializationSignature: string | null;
  signaturesVisited: number;
  successfulTransactions: number;
  mintToInstructions: number;
  burnInstructions: number;
  missingTransactions: number;
  unparsedTokenInstructions: number;
};

function camel(name: string): string {
  return name.replace(/_([a-z0-9])/g, (_match, letter: string) => letter.toUpperCase());
}
function anchorAccount(raw: Record<string, any>): Record<string, any> {
  return Object.fromEntries(Object.entries(raw).map(([key, value]) => [camel(key), value]));
}
function resourceKindFromKey(key: string): string {
  return key.toLowerCase().split("_").map((part, index) =>
    index === 0 ? part : part[0].toUpperCase() + part.slice(1),
  ).join("");
}
function publicKeyString(value: any): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value.toBase58 === "function") return value.toBase58();
  return null;
}
function mintAmount(parsed: any): bigint | null {
  const info = parsed?.info || {};
  const value = info.amount ?? info.tokenAmount?.amount;
  if (typeof value !== "string" && typeof value !== "number") return null;
  if (typeof value === "number" && !Number.isSafeInteger(value)) return null;
  try {
    const amount = BigInt(value);
    return amount >= 0n ? amount : null;
  } catch { return null; }
}
async function retry<T>(label: string, operation: () => Promise<T>): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try { return await operation(); }
    catch (error) {
      last = error;
      if (attempt + 1 < MAX_RETRIES) await new Promise((resolve) => setTimeout(resolve, 400 * (2 ** attempt)));
    }
  }
  throw new Error(`${label} failed after ${MAX_RETRIES} attempts: ${String(last)}`);
}
async function forEachLimit<T>(items: T[], limit: number, action: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      await action(items[index]);
    }
  });
  await Promise.all(workers);
}

async function scanMint(connection: Connection, mint: PublicKey): Promise<MintHistory> {
  const result: MintHistory = {
    mint: mint.toBase58(), totalMintedAtoms: "0", totalBurnedAtoms: "0",
    currentSupplyAtoms: "0", reconstructedSupplyAtoms: "0", supplyMatches: false,
    mintInitialized: false, initializationSignature: null,
    signaturesVisited: 0, successfulTransactions: 0, mintToInstructions: 0,
    burnInstructions: 0, missingTransactions: 0, unparsedTokenInstructions: 0,
  };
  let total = 0n;
  let burned = 0n;
  let before: string | undefined;
  for (;;) {
    const page = await retry(`signature page ${mint.toBase58()}`, () =>
      connection.getSignaturesForAddress(mint, { before, limit: PAGE_SIZE }, "finalized"),
    );
    if (page.length === 0) break;
    result.signaturesVisited += page.length;
    const successful = page.filter((row) => row.err == null);
    result.successfulTransactions += successful.length;
    await forEachLimit(successful, CONCURRENCY, async (row) => {
      const tx = await retry(`transaction ${row.signature}`, () =>
        connection.getParsedTransaction(row.signature, {
          commitment: "finalized",
          maxSupportedTransactionVersion: 0,
        } as any),
      );
      if (!tx) {
        result.missingTransactions++;
        return;
      }
      if (tx.meta?.err) return;
      if (!tx.meta) {
        result.unparsedTokenInstructions++;
        return;
      }
      const instructions: any[] = [
        ...((tx.transaction.message as any).instructions || []),
        ...(tx.meta.innerInstructions || []).flatMap((group: any) => group.instructions || []),
      ];
      for (const ix of instructions) {
        const programId = publicKeyString(ix.programId);
        const parsed = ix.parsed;
        if (programId === TOKEN_PROGRAM_ID.toBase58() && parsed == null) {
          // An unparsed SPL instruction in a transaction returned for this mint
          // may hide a MintTo or Burn. Do not claim a complete baseline in that case.
          result.unparsedTokenInstructions++;
          continue;
        }
        if (programId !== TOKEN_PROGRAM_ID.toBase58() || !parsed) continue;
        const info = parsed.info || {};
        if (info.mint !== mint.toBase58()) continue;
        if (parsed.type === "initializeMint" || parsed.type === "initializeMint2") {
          result.mintInitialized = true;
          result.initializationSignature ??= row.signature;
          continue;
        }
        if (!["mintTo", "mintToChecked", "burn", "burnChecked"].includes(parsed.type)) continue;
        const amount = mintAmount(parsed);
        if (amount == null) {
          result.unparsedTokenInstructions++;
          continue;
        }
        if (parsed.type === "mintTo" || parsed.type === "mintToChecked") {
          total += amount;
          result.mintToInstructions++;
        } else {
          burned += amount;
          result.burnInstructions++;
        }
      }
    });
    before = page[page.length - 1].signature;
    console.log(`${mint.toBase58()}: signatures=${result.signaturesVisited}, mintTo=${result.mintToInstructions}`);
    if (page.length < PAGE_SIZE) break;
  }
  const mintAccount = await retry(`mint account ${mint.toBase58()}`, () => connection.getAccountInfo(mint, "finalized"));
  if (!mintAccount || !mintAccount.owner.equals(TOKEN_PROGRAM_ID)) {
    throw new Error(`${mint.toBase58()} is missing or is not owned by the classic SPL Token program`);
  }
  const supply = await retry(`mint supply ${mint.toBase58()}`, () => connection.getTokenSupply(mint, "finalized"));
  const currentSupply = BigInt(supply.value.amount);
  const reconstructedSupply = total - burned;
  result.totalMintedAtoms = total.toString();
  result.totalBurnedAtoms = burned.toString();
  result.currentSupplyAtoms = currentSupply.toString();
  result.reconstructedSupplyAtoms = reconstructedSupply.toString();
  result.supplyMatches = reconstructedSupply >= 0n && reconstructedSupply === currentSupply;
  return result;
}

async function main() {
  const connection = new Connection(RPC_URL, "confirmed");
  const genesisHash = await retry("genesis hash", () => connection.getGenesisHash());
  if (genesisHash !== GENESIS_DEVNET) throw new Error(`expected devnet genesis ${GENESIS_DEVNET}, got ${genesisHash}`);

  const [configAddress] = PublicKey.findProgramAddressSync([Buffer.from("config")], PROGRAM_ID);
  const [materialsAddress] = PublicKey.findProgramAddressSync([Buffer.from("material_mints")], PROGRAM_ID);
  const infos = await retry("core registry accounts", () =>
    connection.getMultipleAccountsInfo([configAddress, materialsAddress], "confirmed"),
  );
  const [configInfo, materialsInfo] = infos;
  if (!configInfo || !materialsInfo || !configInfo.owner.equals(PROGRAM_ID) || !materialsInfo.owner.equals(PROGRAM_ID)) {
    throw new Error("Config or MaterialMints is missing or not owned by aof_core");
  }
  const coder = new BorshAccountsCoder(idl as any);
  const config = anchorAccount(coder.decode("Config", configInfo.data) as any);
  const materials = anchorAccount(coder.decode("MaterialMints", materialsInfo.data) as any);
  const { mints, errors } = buildCanonicalResourceMints(config, materials);
  if (!mints || errors.length) throw new Error(`canonical resource registry invalid: ${errors.join(",")}`);

  const resources: Record<string, MintHistory> = {};
  for (const [resourceKey, mint] of resourceMintEntries(mints)) {
    const kind = resourceKindFromKey(resourceKey);
    console.log(`scan ${kind} (${mint.toBase58()})`);
    resources[kind] = await scanMint(connection, mint);
  }
  const complete = Object.values(resources).every((entry) =>
    entry.mintInitialized && entry.supplyMatches &&
    entry.missingTransactions === 0 && entry.unparsedTokenInstructions === 0,
  );
  const report = {
    network: "devnet",
    genesisHash,
    programId: PROGRAM_ID.toBase58(),
    scannedAt: new Date().toISOString(),
    complete,
    method: "getSignaturesForAddress + parsed outer/inner SPL MintTo and MintToChecked",
    resources,
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`baseline report: ${OUT}`);
  console.log(`complete=${complete} resources=${Object.keys(resources).length}`);
  if (!complete) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
