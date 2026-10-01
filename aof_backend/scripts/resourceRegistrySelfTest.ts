import { strict as assert } from "assert";
import { Keypair } from "@solana/web3.js";
import {
  RESOURCE_MINT_KEYS,
  buildCanonicalResourceMints,
} from "../src/lib/resourceRegistryCore";

function makeAccounts(): {
  config: Record<string, unknown>;
  material: Record<string, unknown>;
} {
  const addresses = Object.fromEntries(
    RESOURCE_MINT_KEYS.map((key) => [key, Keypair.generate().publicKey]),
  ) as Record<string, any>;
  return {
    config: {
      dataMint: addresses.DATA,
      circuitMint: addresses.CIRCUIT,
      siliconMint: addresses.SILICON,
      mindMint: addresses.MIND,
      neuronMint: addresses.NEURON,
      powerMint: addresses.POWER,
    },
    material: {
      neuron: addresses.NEURON,
      synapse: addresses.SYNAPSE,
      signal: addresses.SIGNAL,
      model: addresses.MODEL,
      power: addresses.POWER,
      compute: addresses.COMPUTE,
      dataset: addresses.DATASET,
      blueCore: addresses.BLUE_CORE,
      purpleCore: addresses.PURPLE_CORE,
      redCore: addresses.RED_CORE,
      clearQuartz: addresses.CLEAR_QUARTZ,
      roseQuartz: addresses.ROSE_QUARTZ,
      amberQuartz: addresses.AMBER_QUARTZ,
      quantumBit: addresses.QUANTUM_BIT,
      neuralChip: addresses.NEURAL_CHIP,
      photonBit: addresses.PHOTON_BIT,
      bioChip: addresses.BIO_CHIP,
      cryoFluid: addresses.CRYO_FLUID,
      voltFluid: addresses.VOLT_FLUID,
      bioFluid: addresses.BIO_FLUID,
      nanoFluid: addresses.NANO_FLUID,
      quantumFluid: addresses.QUANTUM_FLUID,
      soulCore: addresses.SOUL_CORE,
    },
  };
}

function main(): void {
  const valid = makeAccounts();
  const result = buildCanonicalResourceMints(valid.config, valid.material);
  assert.equal(result.errors.length, 0);
  assert.ok(result.mints);
  assert.equal(Object.keys(result.mints).length, 27);

  const missing = buildCanonicalResourceMints(
    valid.config,
    { ...valid.material, soulCore: undefined },
  );
  assert.ok(missing.errors.some((error) => error === "SOUL_CORE:missing_or_default"));
  assert.equal(missing.mints, null);

  const duplicate = buildCanonicalResourceMints(
    valid.config,
    { ...valid.material, synapse: (valid.material as any).neuron },
  );
  assert.ok(duplicate.errors.some((error) => error === "SYNAPSE:duplicate_of_NEURON"));

  const mismatchedAlias = buildCanonicalResourceMints(
    { ...valid.config, powerMint: Keypair.generate().publicKey },
    valid.material,
  );
  assert.ok(mismatchedAlias.errors.some((error) => error === "POWER:config_material_mismatch"));

  console.log("resource registry self-test: 27-key completeness, default, duplicate and alias checks passed");
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
