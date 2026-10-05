import { PublicKey } from "@solana/web3.js";

/** All resource mints that the core program can emit or consume. */
export const RESOURCE_MINT_KEYS = ["DATA", "CIRCUIT", "SILICON", "MIND", "NEURON", "SYNAPSE", "SIGNAL", "MODEL", "POWER", "COMPUTE", "DATASET", "BLUE_CORE", "PURPLE_CORE", "RED_CORE", "CLEAR_QUARTZ", "ROSE_QUARTZ", "AMBER_QUARTZ", "QUANTUM_BIT", "NEURAL_CHIP", "PHOTON_BIT", "BIO_CHIP", "CRYO_FLUID", "VOLT_FLUID", "BIO_FLUID", "NANO_FLUID", "QUANTUM_FLUID", "SOUL_CORE"] as const;

export type ResourceMintKey = (typeof RESOURCE_MINT_KEYS)[number];
export type CanonicalResourceMints = Record<ResourceMintKey, PublicKey>;

const CONFIG_FIELDS: Record<ResourceMintKey, string> = {
  DATA: "dataMint",
  CIRCUIT: "circuitMint",
  SILICON: "siliconMint",
  // Historical core ABI field name: this is the IN-GAME MIND resource mint.
  // The separately configured external MIND SPL mint is not stored in core Config.
  MIND: "mindMint",
  // These two are duplicated in Config for legacy/core instructions and must
  // agree with the canonical MaterialMints entries below.
  NEURON: "neuronMint",
  POWER: "powerMint",
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
  NEURON: "neuron",
  SYNAPSE: "synapse",
  SIGNAL: "signal",
  MODEL: "model",
  POWER: "power",
  COMPUTE: "compute",
  DATASET: "dataset",
  BLUE_CORE: "blueCore",
  PURPLE_CORE: "purpleCore",
  RED_CORE: "redCore",
  CLEAR_QUARTZ: "clearQuartz",
  ROSE_QUARTZ: "roseQuartz",
  AMBER_QUARTZ: "amberQuartz",
  QUANTUM_BIT: "quantumBit",
  NEURAL_CHIP: "neuralChip",
  PHOTON_BIT: "photonBit",
  BIO_CHIP: "bioChip",
  CRYO_FLUID: "cryoFluid",
  VOLT_FLUID: "voltFluid",
  BIO_FLUID: "bioFluid",
  NANO_FLUID: "nanoFluid",
  QUANTUM_FLUID: "quantumFluid",
  SOUL_CORE: "soulCore",
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

  // Config.neuron_mint/power_mint and MaterialMints.neuron/power are consumed by
  // core instructions; they must not silently diverge.
  for (const [key, configField, materialField] of [
    ["NEURON", "neuronMint", "neuron"],
    ["POWER", "powerMint", "power"],
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

/**
 * Canonical `MaterialMints` field name for a resource key, or null when the
 * resource lives in `Config` (DATA/CIRCUIT/SILICON/MIND) or has no field yet.
 * Exported so a route that needs one fluid does not re-type the field name.
 */
export function materialMintField(key: ResourceMintKey): string | null {
  const field = MATERIAL_FIELDS[key];
  return field ? field : null;
}

export function resourceMintEntries(mints: CanonicalResourceMints): [ResourceMintKey, PublicKey][] {
  return RESOURCE_MINT_KEYS.map((key) => [key, mints[key]]);
}
