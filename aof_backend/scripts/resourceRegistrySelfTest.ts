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
      foodMint: addresses.FOOD,
      woodMint: addresses.WOOD,
      stoneMint: addresses.STONE,
      potatoMint: addresses.POTATO,
      seedsMint: addresses.SEEDS,
      waterMint: addresses.WATER,
    },
    material: {
      seeds: addresses.SEEDS,
      wheat: addresses.WHEAT,
      flour: addresses.FLOUR,
      bread: addresses.BREAD,
      water: addresses.WATER,
      coal: addresses.COAL,
      meat: addresses.MEAT,
      stoneBlue: addresses.STONE_BLUE,
      stonePurple: addresses.STONE_PURPLE,
      stoneRed: addresses.STONE_RED,
      sandWhite: addresses.SAND_WHITE,
      sandPink: addresses.SAND_PINK,
      sandYellow: addresses.SAND_YELLOW,
      gemBlue: addresses.GEM_BLUE,
      gemOrange: addresses.GEM_ORANGE,
      gemWhite: addresses.GEM_WHITE,
      gemGreen: addresses.GEM_GREEN,
      flaskBlue: addresses.FLASK_BLUE,
      flaskYellow: addresses.FLASK_YELLOW,
      flaskGreen: addresses.FLASK_GREEN,
      flaskPink: addresses.FLASK_PINK,
      flaskPurple: addresses.FLASK_PURPLE,
      loveHeart: addresses.LOVE_HEART,
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
    { ...valid.material, loveHeart: undefined },
  );
  assert.ok(missing.errors.some((error) => error === "LOVE_HEART:missing_or_default"));
  assert.equal(missing.mints, null);

  const duplicate = buildCanonicalResourceMints(
    valid.config,
    { ...valid.material, wheat: (valid.material as any).seeds },
  );
  assert.ok(duplicate.errors.some((error) => error === "WHEAT:duplicate_of_SEEDS"));

  const mismatchedAlias = buildCanonicalResourceMints(
    { ...valid.config, waterMint: Keypair.generate().publicKey },
    valid.material,
  );
  assert.ok(mismatchedAlias.errors.some((error) => error === "WATER:config_material_mismatch"));

  console.log("resource registry self-test: 27-key completeness, default, duplicate and alias checks passed");
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
