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
      foodMint: addresses.DATA,
      woodMint: addresses.CIRCUIT,
      stoneMint: addresses.SILICON,
      potatoMint: addresses.MIND,
      seedsMint: addresses.NEURON,
      waterMint: addresses.POWER,
    },
    material: {
      seeds: addresses.NEURON,
      wheat: addresses.SYNAPSE,
      flour: addresses.SIGNAL,
      bread: addresses.MODEL,
      water: addresses.POWER,
      coal: addresses.COMPUTE,
      meat: addresses.DATASET,
      stone_blue: addresses.BLUE_CORE,
      stone_purple: addresses.PURPLE_CORE,
      stone_red: addresses.RED_CORE,
      sand_white: addresses.CLEAR_QUARTZ,
      sand_pink: addresses.ROSE_QUARTZ,
      sand_yellow: addresses.AMBER_QUARTZ,
      gem_blue: addresses.QUANTUM_BIT,
      gem_orange: addresses.NEURAL_CHIP,
      gem_white: addresses.PHOTON_BIT,
      gem_green: addresses.BIO_CHIP,
      flask_blue: addresses.CRYO_FLUID,
      flask_yellow: addresses.VOLT_FLUID,
      flask_green: addresses.BIO_FLUID,
      flask_pink: addresses.NANO_FLUID,
      flask_purple: addresses.QUANTUM_FLUID,
      love_heart: addresses.SOUL_CORE,
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
    { ...valid.material, love_heart: undefined },
  );
  assert.ok(missing.errors.some((error) => error === "SOUL_CORE:missing_or_default"));
  assert.equal(missing.mints, null);

  const duplicate = buildCanonicalResourceMints(
    valid.config,
    { ...valid.material, wheat: (valid.material as any).seeds },
  );
  assert.ok(duplicate.errors.some((error) => error === "SYNAPSE:duplicate_of_NEURON"));

  const mismatchedAlias = buildCanonicalResourceMints(
    { ...valid.config, waterMint: Keypair.generate().publicKey },
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
