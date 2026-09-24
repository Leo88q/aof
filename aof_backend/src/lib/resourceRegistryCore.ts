import { PublicKey } from "@solana/web3.js";

/** All resource mints that the core program can emit or consume. */
export const RESOURCE_MINT_KEYS = ["DATA", "CIRCUIT", "SILICON", "MIND", "NEURON", "SYNAPSE", "SIGNAL", "MODEL", "POWER", "COMPUTE", "DATASET", "BLUE_CORE", "PURPLE_CORE", "RED_CORE", "CLEAR_QUARTZ", "ROSE_QUARTZ", "AMBER_QUARTZ", "QUANTUM_BIT", "NEURAL_CHIP", "PHOTON_BIT", "BIO_CHIP", "CRYO_FLUID", "VOLT_FLUID", "BIO_FLUID", "NANO_FLUID", "QUANTUM_FLUID", "SOUL_CORE"] as const;

export type ResourceMintKey = (typeof RESOURCE_MINT_KEYS)[number];
export type CanonicalResourceMints = Record<ResourceMintKey, PublicKey>;

const CONFIG_FIELDS: Record<ResourceMintKey, string> = {
  DATA: "foodMint",
  CIRCUIT: "woodMint",
  SILICON: "stoneMint",
  MIND: "potatoMint",
  // These two are duplicated in Config for legacy/core instructions and must
  // agree with the canonical MaterialMints entries below.
  NEURON: "seedsMint",
  POWER: "waterMint",
  SYNAPSE: "",
  SIGNAL: "",
  MODEL: "",
  COMPUTE: "",
  DATASET: "",
  BLUE_CORE: "",
  PURPLE_CORE: "",
  RED_CORE: "",
  CLEAR_QUARTZ: "",
  ROSE_QUARTZ: "",
  AMBER_QUARTZ: "",
  QUANTUM_BIT: "",
  NEURAL_CHIP: "",
  PHOTON_BIT: "",
  BIO_CHIP: "",
  CRYO_FLUID: "",
  VOLT_FLUID: "",
  BIO_FLUID: "",
  NANO_FLUID: "",
  QUANTUM_FLUID: "",
  SOUL_CORE: "",
};

const MATERIAL_FIELDS: Record<ResourceMintKey, string> = {
  DATA: "",
  CIRCUIT: "",
  SILICON: "",
  MIND: "",
  NEURON: "seeds",
  SYNAPSE: "wheat",
  SIGNAL: "flour",
  MODEL: "bread",
  POWER: "water",
  COMPUTE: "coal",
  DATASET: "meat",
  BLUE_CORE: "stone_blue",
  PURPLE_CORE: "stone_purple",
  RED_CORE: "stone_red",
  CLEAR_QUARTZ: "sand_white",
  ROSE_QUARTZ: "sand_pink",
  AMBER_QUARTZ: "sand_yellow",
  QUANTUM_BIT: "gem_blue",
  NEURAL_CHIP: "gem_orange",
  PHOTON_BIT: "gem_white",
  BIO_CHIP: "gem_green",
  CRYO_FLUID: "flask_blue",
  VOLT_FLUID: "flask_yellow",
  BIO_FLUID: "flask_green",
  NANO_FLUID: "flask_pink",
  QUANTUM_FLUID: "flask_purple",
  SOUL_CORE: "love_heart",
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
    ["NEURON", "seedsMint", "seeds"],
    ["POWER", "waterMint", "water"],
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
