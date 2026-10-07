import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import BN from "bn.js";
import { AUTHORITY } from "../src/config";
import { connection, program } from "../src/provider";
import { issuanceCapPda, configPda, materialMintsPda, RESOURCE_KIND_ORDER } from "../src/lib/pda";
import { authorityOnly } from "../src/lib/tx";
import { buildCanonicalResourceMints, type ResourceMintKey } from "../src/lib/resourceRegistryCore";

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
const U128_MAX = (1n << 128n) - 1n;

if (!AUTHORITY) {
  throw new Error("Applying issuance baselines requires AUTHORITY_MODE=hot and AUTHORITY_SECRET_KEY");
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

async function main() {
  const report = JSON.parse(readFileSync(REPORT, "utf8")) as BaselineReport;
  if (report.network !== "devnet" || report.genesisHash !== GENESIS_DEVNET || !report.complete) {
    throw new Error("baseline report is not a complete devnet scan");
  }
  if (report.programId !== program.programId.toBase58()) throw new Error("baseline report belongs to a different core program id");
  const genesis = await connection.getGenesisHash();
  if (genesis !== GENESIS_DEVNET) throw new Error(`RPC is not devnet (${genesis})`);

  const [config] = configPda();
  const [materialMints] = materialMintsPda();
  const cfg: any = await (program.account as any).config.fetch(config);
  const materials: any = await (program.account as any).materialMints.fetch(materialMints);
  if (!cfg.authority.equals(authority.publicKey)) {
    throw new Error("configured account authority differs from the supplied admin signer; submit the baseline instructions with that authority/multisig");
  }
  const canonical = buildCanonicalResourceMints(cfg, materials);
  if (!canonical.mints || canonical.errors.length) throw new Error(`canonical mints invalid: ${canonical.errors.join(",")}`);

  let changed = 0;
  for (const kind of RESOURCE_KIND_ORDER) {
    const row = report.resources[kind];
    if (!row || !row.mintInitialized || !row.initializationSignature || !row.supplyMatches || row.missingTransactions !== 0 || row.unparsedTokenInstructions !== 0) {
      throw new Error(`${kind}: historical scan is incomplete or does not reconcile gross mints, burns, and live SPL supply`);
    }
    const mint = canonical.mints[RESOURCE_MINT_KEY_BY_KIND[kind]];
    if (!mint || mint.toBase58() !== row.mint) throw new Error(`${kind}: report mint does not match canonical on-chain registry`);

    const [capAddress] = issuanceCapPda(kind);
    const capAccount: any = await (program.account as any).issuanceCap.fetch(capAddress);
    const current = BigInt(capAccount.lifetimeMinted.toString());
    const scanned = BigInt(row.totalMintedAtoms);
    const burned = BigInt(row.totalBurnedAtoms);
    const reconstructed = BigInt(row.reconstructedSupplyAtoms);
    const historicalSupply = BigInt(row.currentSupplyAtoms);
    if (scanned < 0n || burned < 0n || historicalSupply < 0n ||
      reconstructed !== historicalSupply || scanned - burned !== historicalSupply) {
      throw new Error(`${kind}: gross mints − burns do not reconcile to the historical SPL supply`);
    }
    const baseline = current > scanned ? current : scanned;
    if (baseline < 0n || baseline > U128_MAX) throw new Error(`${kind}: baseline does not fit u128`);
    if (baseline === current) {
      console.log(`skip ${kind}: lifetime counter already covers scan (${current})`);
      continue;
    }
    const ix = await (program.methods as any)
      .setIssuanceLifetimeBaseline({ [kind]: {} }, new BN(baseline.toString()))
      .accounts({ config, authority: authority.publicKey, materialMints, issuanceCap: capAddress, mint })
      .instruction();
    const signature = await authorityOnly([ix]);
    console.log(`set ${kind}: ${current} -> ${baseline} (${signature})`);
    changed++;
  }
  console.log(`baselines raised=${changed}; live lifetime counters were never lowered`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
