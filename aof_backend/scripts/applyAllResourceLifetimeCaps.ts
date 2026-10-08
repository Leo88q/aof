import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import BN from "bn.js";
import { ComputeBudgetProgram, Transaction } from "@solana/web3.js";
import { AUTHORITY } from "../src/config";
import { connection, program } from "../src/provider";
import { configPda, materialMintsPda, issuanceCapPda, RESOURCE_KIND_ORDER } from "../src/lib/pda";
import { authorityOnly } from "../src/lib/tx";
import { buildCanonicalResourceMints, type ResourceMintKey } from "../src/lib/resourceRegistryCore";

// One finite lifetime ceiling for every ResourceKind. This does not enable
// mining and does not change per-epoch IssuanceCap.capPerEpoch.
const RESOURCE_MINT_KEY_BY_KIND: Record<(typeof RESOURCE_KIND_ORDER)[number], ResourceMintKey> = {
  data: "DATA", circuit: "CIRCUIT", silicon: "SILICON", neuron: "NEURON", synapse: "SYNAPSE",
  signal: "SIGNAL", model: "MODEL", power: "POWER", compute: "COMPUTE", dataset: "DATASET",
  blueCore: "BLUE_CORE", purpleCore: "PURPLE_CORE", redCore: "RED_CORE", clearQuartz: "CLEAR_QUARTZ",
  roseQuartz: "ROSE_QUARTZ", amberQuartz: "AMBER_QUARTZ", quantumBit: "QUANTUM_BIT", neuralChip: "NEURAL_CHIP",
  photonBit: "PHOTON_BIT", bioChip: "BIO_CHIP", cryoFluid: "CRYO_FLUID", voltFluid: "VOLT_FLUID",
  bioFluid: "BIO_FLUID", nanoFluid: "NANO_FLUID", quantumFluid: "QUANTUM_FLUID", soulCore: "SOUL_CORE", mind: "MIND",
};

const GENESIS_DEVNET = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
const REPORT = resolve(process.env.ISSUANCE_BASELINE_FILE || "reports/devnet-issuance-baseline.json");
const UNLIMITED = (1n << 64n) - 1n;
const PACKET_LIMIT = 1232;
const COMPUTE_UNITS = 1_200_000;

if (RESOURCE_KIND_ORDER.length !== 27) {
  throw new Error(`expected 27 resource kinds, found ${RESOURCE_KIND_ORDER.length}`);
}
if (!AUTHORITY) {
  throw new Error("Applying lifetime caps requires AUTHORITY_MODE=hot and AUTHORITY_SECRET_KEY");
}
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

function redact(value: unknown): string {
  return String(value ?? "").replace(/api-key=[^&\s]+/gi, "api-key=REDACTED");
}

async function main() {
  const raw = process.env.LIFETIME_CAP_ATOMS;
  if (!raw || !/^\d+$/.test(raw)) {
    throw new Error("LIFETIME_CAP_ATOMS must be one positive integer in raw SPL atoms for all 27 kinds");
  }
  const cap = BigInt(raw);
  if (cap <= 0n || cap >= UNLIMITED) {
    throw new Error("LIFETIME_CAP_ATOMS must be finite and between 1 and u64::MAX - 1");
  }

  const report = JSON.parse(readFileSync(REPORT, "utf8")) as BaselineReport;
  if (report.network !== "devnet" || report.genesisHash !== GENESIS_DEVNET || !report.complete) {
    throw new Error("a complete devnet historical issuance report is required before finite caps can be applied");
  }
  if (report.programId !== program.programId.toBase58()) {
    throw new Error("baseline report belongs to a different aof_core program id");
  }
  const genesis = await connection.getGenesisHash();
  if (genesis !== GENESIS_DEVNET) throw new Error(`RPC is not devnet (${genesis})`);

  const [config] = configPda();
  const [materialMintsAddress] = materialMintsPda();
  const cfg: any = await (program.account as any).config.fetch(config);
  const materials: any = await (program.account as any).materialMints.fetch(materialMintsAddress);
  if (!cfg.authority.equals(authority.publicKey)) throw new Error("AUTHORITY is not the on-chain Config authority");
  const canonical = buildCanonicalResourceMints(cfg, materials);
  if (!canonical.mints || canonical.errors.length) {
    throw new Error(`canonical mints invalid: ${canonical.errors.join(",")}`);
  }
  if (!Array.isArray(materials.maxSupply) || materials.maxSupply.length !== RESOURCE_KIND_ORDER.length) {
    throw new Error("MaterialMints.maxSupply does not match the 27 ResourceKind entries");
  }

  const instructions = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: COMPUTE_UNITS }),
  ];
  let planned = 0;
  for (const kind of RESOURCE_KIND_ORDER) {
    const row = report.resources[kind];
    if (!row || !row.mintInitialized || !row.initializationSignature || !row.supplyMatches || row.missingTransactions !== 0 || row.unparsedTokenInstructions !== 0) {
      throw new Error(`${kind}: historical scan lacks initialization, transaction completeness, or supply reconciliation`);
    }
    const mint = canonical.mints[RESOURCE_MINT_KEY_BY_KIND[kind]];
    if (!mint || row.mint !== mint.toBase58()) {
      throw new Error(`${kind}: scan report mint differs from the canonical on-chain registry`);
    }
    const index = RESOURCE_KIND_ORDER.indexOf(kind);
    const [capAddress] = issuanceCapPda(kind);
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
      throw new Error(`${kind}: gross mints − burns do not reconcile to the historical SPL supply`);
    }
    const currentSupply = BigInt(mintSupply.value.amount);
    if (lifetimeMinted < scanned || lifetimeMinted < currentSupply) {
      throw new Error(`${kind}: on-chain lifetime baseline ${lifetimeMinted} does not cover scan ${scanned} and live SPL supply ${currentSupply}; apply baseline first`);
    }
    if (cap <= lifetimeMinted) {
      throw new Error(`${kind}: cap ${cap} must exceed current lifetime issuance ${lifetimeMinted}`);
    }
    const old = BigInt(materials.maxSupply[index].toString());
    if (old === cap) {
      console.log(`skip ${kind}: finite lifetime cap already equals ${cap}`);
      continue;
    }
    const ix = await (program.methods as any)
      .setSupplyCap({ [kind]: {} }, new BN(cap.toString()))
      .accounts({ config, authority: authority.publicKey, materialMints: materialMintsAddress })
      .instruction();
    instructions.push(ix);
    planned++;
    console.log(`plan ${kind}: lifetime cap ${old === UNLIMITED ? "unlimited" : old.toString()} -> ${cap}; lifetime minted=${lifetimeMinted}; supply=${currentSupply}`);
  }

  if (planned === 0) {
    console.log("all 27 resource lifetime caps are already configured");
    return;
  }

  const probe = new Transaction().add(...instructions);
  probe.feePayer = authority.publicKey;
  probe.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;
  const bytes = probe.serialize({ requireAllSignatures: false, verifySignatures: false }).length;
  if (bytes > PACKET_LIMIT) {
    throw new Error(`refusing to send: ${planned} cap instructions serialize to ${bytes} bytes, over ${PACKET_LIMIT}`);
  }
  console.log(`sending 1 transaction: ${planned} supply caps, ${bytes} bytes, compute limit ${COMPUTE_UNITS}`);
  const signature = await authorityOnly(instructions);
  console.log(`applied ${planned} finite lifetime caps atomically: ${signature}`);
}

main().catch((error) => {
  const detail = error instanceof Error ? (error.stack || error.message) : error;
  console.error(redact(detail));
  process.exit(1);
});
