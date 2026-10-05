import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import BN from "bn.js";
import { AUTHORITY } from "../src/config";
import { connection, program } from "../src/provider";
import { configPda, materialMintsPda, issuanceCapPda, RESOURCE_KIND_ORDER } from "../src/lib/pda";
import { authorityOnly } from "../src/lib/tx";
import { buildCanonicalResourceMints, type ResourceMintKey } from "../src/lib/resourceRegistryCore";

const GENESIS_DEVNET = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
const REPORT = resolve(process.env.ISSUANCE_BASELINE_FILE || "reports/devnet-issuance-baseline.json");
const UNLIMITED = (1n << 64n) - 1n;
const CAP_TARGETS = [
  { kind: "circuit", env: "LIFETIME_CAP_CIRCUIT", mint: "CIRCUIT" },
  { kind: "silicon", env: "LIFETIME_CAP_SILICON", mint: "SILICON" },
  { kind: "dataset", env: "LIFETIME_CAP_DATASET", mint: "DATASET" },
  { kind: "neuron", env: "LIFETIME_CAP_NEURON", mint: "NEURON" },
] as const satisfies ReadonlyArray<{
  kind: (typeof RESOURCE_KIND_ORDER)[number];
  env: string;
  mint: ResourceMintKey;
}>;

if (!AUTHORITY) throw new Error("Applying mining lifetime caps requires AUTHORITY_MODE=hot and AUTHORITY_SECRET_KEY");
const authority = AUTHORITY;

type BaselineRow = {
  mint: string;
  totalMintedAtoms: string;
  totalBurnedAtoms: string;
  currentSupplyAtoms: string;
  reconstructedSupplyAtoms: string;
  supplyMatches: boolean;
  mintInitialized: boolean;
  initializationSignature: string | null;
  missingTransactions: number;
  unparsedTokenInstructions: number;
};
type BaselineReport = {
  network: string;
  genesisHash: string;
  programId: string;
  complete: boolean;
  resources: Record<string, BaselineRow>;
};

async function main() {
  const report = JSON.parse(readFileSync(REPORT, "utf8")) as BaselineReport;
  if (report.network !== "devnet" || report.genesisHash !== GENESIS_DEVNET || !report.complete) {
    throw new Error("a complete devnet historical issuance report is required before finite caps can be applied");
  }
  if (report.programId !== program.programId.toBase58()) throw new Error("baseline report belongs to a different aof_core program id");
  const genesis = await connection.getGenesisHash();
  if (genesis !== GENESIS_DEVNET) throw new Error(`RPC is not devnet (${genesis})`);

  const [config] = configPda();
  const [materialMintsAddress] = materialMintsPda();
  const cfg: any = await (program.account as any).config.fetch(config);
  const materials: any = await (program.account as any).materialMints.fetch(materialMintsAddress);
  if (!cfg.authority.equals(authority.publicKey)) throw new Error("AUTHORITY is not the on-chain Config authority");
  const canonical = buildCanonicalResourceMints(cfg, materials);
  if (!canonical.mints || canonical.errors.length) throw new Error(`canonical mints invalid: ${canonical.errors.join(",")}`);
  if (!Array.isArray(materials.maxSupply) || materials.maxSupply.length !== RESOURCE_KIND_ORDER.length) {
    throw new Error("MaterialMints.maxSupply does not match the 27 ResourceKind entries");
  }

  const instructions = [];
  for (const target of CAP_TARGETS) {
    const raw = process.env[target.env];
    const row = report.resources[target.kind];
    if (!row || !row.mintInitialized || !row.initializationSignature || !row.supplyMatches || row.missingTransactions !== 0 || row.unparsedTokenInstructions !== 0) {
      throw new Error(`${target.kind}: historical scan lacks initialization, transaction completeness, or supply reconciliation`);
    }
    const mint = canonical.mints[target.mint];
    if (row.mint !== mint.toBase58()) throw new Error(`${target.kind}: scan report mint differs from the canonical on-chain registry`);

    const index = RESOURCE_KIND_ORDER.indexOf(target.kind);
    const [capAddress] = issuanceCapPda(target.kind);
    const [capInfo, mintSupply] = await Promise.all([
      (program.account as any).issuanceCap.fetch(capAddress),
      connection.getTokenSupply(mint, "finalized"),
    ]);
    const lifetimeMinted = BigInt(capInfo.lifetimeMinted.toString());
    const scanned = BigInt(row.totalMintedAtoms);
    const burned = BigInt(row.totalBurnedAtoms);
    const reconstructed = BigInt(row.reconstructedSupplyAtoms);
    const historicalSupply = BigInt(row.currentSupplyAtoms);
    if (scanned < 0n || burned < 0n || historicalSupply < 0n ||
      reconstructed !== historicalSupply || scanned - burned !== historicalSupply) {
      throw new Error(`${target.kind}: gross mints − burns do not reconcile to the historical SPL supply`);
    }
    const currentSupply = BigInt(mintSupply.value.amount);
    const old = BigInt(materials.maxSupply[index].toString());
    if (lifetimeMinted < scanned || lifetimeMinted < currentSupply) {
      throw new Error(`${target.kind}: on-chain lifetime baseline ${lifetimeMinted} does not cover scan ${scanned} and live SPL supply ${currentSupply}; apply baseline first`);
    }

    if (!raw) {
      if (old === UNLIMITED) throw new Error(`${target.env} is required to set the missing finite lifetime cap`);
      if (old <= lifetimeMinted) throw new Error(`${target.kind}: existing finite cap ${old} has no headroom above lifetime issuance ${lifetimeMinted}`);
      console.log(`skip ${target.kind}: finite lifetime cap already configured (${old})`);
      continue;
    }
    if (!/^\d+$/.test(raw)) throw new Error(`${target.env} must be a positive integer in raw SPL atoms (1 resource unit = 1e9 atoms)`);
    const cap = BigInt(raw);
    if (cap <= 0n || cap >= UNLIMITED) throw new Error(`${target.env} must be finite and between 1 and u64::MAX - 1`);
    if (cap <= lifetimeMinted) {
      throw new Error(`${target.env}=${cap} must exceed current lifetime issuance ${lifetimeMinted} so mining has nonzero headroom`);
    }
    if (old === cap) {
      console.log(`skip ${target.kind}: finite lifetime cap already equals ${cap}`);
      continue;
    }
    const ix = await (program.methods as any)
      .setSupplyCap({ [target.kind]: {} }, new BN(cap.toString()))
      .accounts({ config, authority: authority.publicKey, materialMints: materialMintsAddress })
      .instruction();
    instructions.push(ix);
    console.log(`plan ${target.kind}: lifetime cap ${old === UNLIMITED ? "unlimited" : old.toString()} -> ${cap}; lifetime minted=${lifetimeMinted}; supply=${currentSupply}`);
  }

  if (instructions.length === 0) {
    console.log("all four mining resource lifetime caps are already configured");
    return;
  }
  const signature = await authorityOnly(instructions);
  console.log(`applied ${instructions.length} finite mining lifetime caps atomically: ${signature}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
