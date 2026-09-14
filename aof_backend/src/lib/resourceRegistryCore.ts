import { PublicKey } from "@solana/web3.js";

/** All resource mints that the core program can emit or consume. */
export const RESOURCE_MINT_KEYS = [
  "FOOD",
  "WOOD",
  "STONE",
  "POTATO",
  "SEEDS",
  "WHEAT",
  "FLOUR",
  "BREAD",
  "WATER",
  "COAL",
  "MEAT",
  "STONE_BLUE",
  "STONE_PURPLE",
  "STONE_RED",
  "SAND_WHITE",
  "SAND_PINK",
  "SAND_YELLOW",
  "GEM_BLUE",
  "GEM_ORANGE",
  "GEM_WHITE",
  "GEM_GREEN",
  "FLASK_BLUE",
  "FLASK_YELLOW",
  "FLASK_GREEN",
  "FLASK_PINK",
  "FLASK_PURPLE",
  "LOVE_HEART",
] as const;

export type ResourceMintKey = (typeof RESOURCE_MINT_KEYS)[number];
export type CanonicalResourceMints = Record<ResourceMintKey, PublicKey>;

const CONFIG_FIELDS: Record<ResourceMintKey, string> = {
  FOOD: "foodMint",
  WOOD: "woodMint",
  STONE: "stoneMint",
  POTATO: "potatoMint",
  // These two are duplicated in Config for legacy/core instructions and must
  // agree with the canonical MaterialMints entries below.
  SEEDS: "seedsMint",
  WATER: "waterMint",
  WHEAT: "",
  FLOUR: "",
  BREAD: "",
  COAL: "",
  MEAT: "",
  STONE_BLUE: "",
  STONE_PURPLE: "",
  STONE_RED: "",
  SAND_WHITE: "",
  SAND_PINK: "",
  SAND_YELLOW: "",
  GEM_BLUE: "",
  GEM_ORANGE: "",
  GEM_WHITE: "",
  GEM_GREEN: "",
  FLASK_BLUE: "",
  FLASK_YELLOW: "",
  FLASK_GREEN: "",
  FLASK_PINK: "",
  FLASK_PURPLE: "",
  LOVE_HEART: "",
};

const MATERIAL_FIELDS: Record<ResourceMintKey, string> = {
  FOOD: "",
  WOOD: "",
  STONE: "",
  POTATO: "",
  SEEDS: "seeds",
  WHEAT: "wheat",
  FLOUR: "flour",
  BREAD: "bread",
  WATER: "water",
  COAL: "coal",
  MEAT: "meat",
  STONE_BLUE: "stoneBlue",
  STONE_PURPLE: "stonePurple",
  STONE_RED: "stoneRed",
  SAND_WHITE: "sandWhite",
  SAND_PINK: "sandPink",
  SAND_YELLOW: "sandYellow",
  GEM_BLUE: "gemBlue",
  GEM_ORANGE: "gemOrange",
  GEM_WHITE: "gemWhite",
  GEM_GREEN: "gemGreen",
  FLASK_BLUE: "flaskBlue",
  FLASK_YELLOW: "flaskYellow",
  FLASK_GREEN: "flaskGreen",
  FLASK_PINK: "flaskPink",
  FLASK_PURPLE: "flaskPurple",
  LOVE_HEART: "loveHeart",
};

function asPublicKey(value: unknown): PublicKey | null {
  try {
    const key = value instanceof PublicKey ? value : new PublicKey(value as string);
    return key.equals(PublicKey.default) ? null : key;
  } catch {
    return null;
  }
}

/**
 * Validate the account shape before any RPC mint/account lookup. This keeps a
 * partial or attacker-shaped registry from becoming a successful HTTP 200.
 */
export function buildCanonicalResourceMints(
  config: Record<string, unknown> | null | undefined,
  materialMints: Record<string, unknown> | null | undefined,
): { mints: CanonicalResourceMints | null; errors: string[] } {
  const errors: string[] = [];
  const values = new Map<ResourceMintKey, PublicKey>();

  for (const key of RESOURCE_MINT_KEYS) {
    const configField = CONFIG_FIELDS[key];
    const materialField = MATERIAL_FIELDS[key];
    const raw = configField
      ? config?.[configField]
      : materialField
        ? materialMints?.[materialField]
        : undefined;
    const parsed = asPublicKey(raw);
    if (!parsed) {
      errors.push(`${key}:missing_or_default`);
    } else {
      values.set(key, parsed);
    }
  }

  // Config.seeds_mint and Config.water_mint are still consumed by legacy/core
  // instructions. They must not silently diverge from MaterialMints.
  for (const [key, configField, materialField] of [
    ["SEEDS", "seedsMint", "seeds"],
    ["WATER", "waterMint", "water"],
  ] as const) {
    const configKey = asPublicKey(config?.[configField]);
    const materialKey = asPublicKey(materialMints?.[materialField]);
    if (!configKey || !materialKey || !configKey.equals(materialKey)) {
      errors.push(`${key}:config_material_mismatch`);
    }
  }

  const seen = new Map<string, ResourceMintKey>();
  for (const key of RESOURCE_MINT_KEYS) {
    const value = values.get(key);
    if (!value) continue;
    const address = value.toBase58();
    const previous = seen.get(address);
    if (previous) {
      errors.push(`${key}:duplicate_of_${previous}`);
    } else {
      seen.set(address, key);
    }
  }

  if (errors.length > 0) return { mints: null, errors: [...new Set(errors)] };
  const mints = Object.fromEntries(
    RESOURCE_MINT_KEYS.map((key) => [key, values.get(key)!]),
  ) as CanonicalResourceMints;
  return { mints, errors: [] };
}

export function resourceMintEntries(mints: CanonicalResourceMints): [ResourceMintKey, PublicKey][] {
  return RESOURCE_MINT_KEYS.map((key) => [key, mints[key]]);
}
