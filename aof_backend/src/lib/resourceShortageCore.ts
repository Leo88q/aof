import type { ResourceMintKey } from "./resourceRegistryCore";

/** Costs below are copied from aof-core constants and instruction handlers.
 * A missing read is not a shortage: callers must not turn an RPC failure into
 * "the player does not have the resource". */

export const RESOURCE_UNIT = 1_000_000_000n;
export const ENERGY_CAP = 20;
export const ENERGY_REGEN_SECONDS = 30 * 60;
export const ENERGY_COST_SIGNAL = 2;
export const ENERGY_COST_MODEL = 2;
export const ENERGY_COST_SYNTHESIS = 1;
export const FEE_PER_REROLL_MICROS = 60_000n;

const U64_MAX = (1n << 64n) - 1n;

export const SIGNAL_BATCH = [
  { synapse: 6n, silicon: 1n },
  { synapse: 18n, silicon: 2n },
  { synapse: 40n, silicon: 4n },
] as const;

export const MODEL_BATCH = [
  { signal: 4n, power: 3n, circuit: 5n, compute: 2n },
  { signal: 12n, power: 8n, circuit: 12n, compute: 5n },
  { signal: 28n, power: 18n, circuit: 25n, compute: 10n },
] as const;

/** recipe_id in craft_recipe.rs. Amounts are whole resource units. */
export const RECIPE_INPUTS: ReadonlyArray<ReadonlyArray<readonly [string, bigint]>> = [
  [["BLUE_CORE", 1n]],
  [["RED_CORE", 1n]],
  [["CLEAR_QUARTZ", 1n]],
  [["QUANTUM_BIT", 2n], ["DATA", 5n]],
  [["NEURAL_CHIP", 2n], ["SILICON", 3n]],
  [["CIRCUIT", 5n], ["NEURON", 5n]],
  [["ROSE_QUARTZ", 3n], ["DATA", 5n]],
  [["PURPLE_CORE", 1n], ["BIO_CHIP", 1n]],
  [["DATASET", 5n]],
  [["CIRCUIT", 8n]],
  [["SILICON", 8n]],
  [["NEURON", 8n]],
  [["CIRCUIT", 6n], ["DATASET", 2n]],
  [["NEURON", 4n], ["DATASET", 2n]],
  [["NEURON", 4n], ["CIRCUIT", 4n]],
  [["PHOTON_BIT", 1n]],
  [["DATASET", 4n]],
  [["CIRCUIT", 4n], ["DATASET", 2n]],
];

/** One seal of the conscious laboratory. Whole resource units. */
export const FINALE_INPUTS = [
  ["MODEL", 1n],
  ["CRYO_FLUID", 1n],
  ["VOLT_FLUID", 1n],
  ["BIO_FLUID", 1n],
  ["NANO_FLUID", 1n],
  ["QUANTUM_FLUID", 1n],
  ["AMBER_QUARTZ", 1n],
] as const satisfies readonly (readonly [ResourceMintKey, bigint])[];

export const TRIP_COST = { DATA: 75n, CIRCUIT: 35n, SILICON: 35n, DATASET: 50n } as const;

export const EXPLORATION_UPGRADE_COST = [1000n, 2000n, 3000n, 4000n, 5000n, 6000n, 7000n, 8000n, 9000n, 10000n] as const;

export const REFERRAL_UPGRADE = {
  CIRCUIT: [0n, 1000n, 3000n, 7000n, 12000n, 20000n, 50000n],
  SILICON: [0n, 1000n, 3000n, 7000n, 12000n, 20000n, 50000n],
  DATA: [0n, 500n, 2000n, 4000n, 7000n, 13000n, 25000n],
} as const;

export const ENCHANT_COST = [200n, 500n, 1200n, 2400n, 4000n] as const;

/** Per durability unit, atomic units. Matches Rarity::repair_*_cost_per_unit. */
export const REPAIR_SILICON: Record<string, bigint> = {
  common: 2n * RESOURCE_UNIT,
  uncommon: 2n * RESOURCE_UNIT + RESOURCE_UNIT / 2n,
  rare: 2n * RESOURCE_UNIT + RESOURCE_UNIT / 2n,
  epic: 3n * RESOURCE_UNIT,
  legendary: 3n * RESOURCE_UNIT + RESOURCE_UNIT / 2n,
};
export const REPAIR_CIRCUIT: Record<string, bigint> = {
  common: 3n * RESOURCE_UNIT,
  uncommon: 3n * RESOURCE_UNIT + RESOURCE_UNIT / 2n,
  rare: 4n * RESOURCE_UNIT,
  epic: 4n * RESOURCE_UNIT + RESOURCE_UNIT / 2n,
  legendary: 5n * RESOURCE_UNIT,
};

export type Shortage = { resource: string; have: string; need: string };

export function asUint(value: unknown): bigint | null {
  if (typeof value === "bigint" && value >= 0n && value <= U64_MAX) return value;
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  if (typeof value === "string" && /^\d+$/.test(value)) {
    try {
      const parsed = BigInt(value);
      return parsed <= U64_MAX ? parsed : null;
    } catch {
      return null;
    }
  }
  if (value && typeof value === "object" && "toString" in value) {
    return asUint(String(value));
  }
  return null;
}

export function linearCost(base: bigint, multiplier: bigint, minted: bigint): bigint | null {
  const cost = base + multiplier * minted;
  return cost >= 0n && cost <= U64_MAX ? cost : null;
}

/** Whole resource units plus a trimmed fractional part. No float rounding. */
export function formatRawUnits(raw: bigint): string | null {
  if (raw < 0n) return null;
  const whole = raw / RESOURCE_UNIT;
  const frac = raw % RESOURCE_UNIT;
  if (frac === 0n) return whole.toString();
  const digits = frac.toString().padStart(9, "0").replace(/0+$/, "");
  return `${whole}.${digits}`;
}

/** Gas-tank micros: 1 micro = 0.000001 SOL. */
export function formatMicros(micros: bigint): string | null {
  if (micros < 0n) return null;
  const whole = micros / 1_000_000n;
  const frac = micros % 1_000_000n;
  if (frac === 0n) return whole.toString();
  return `${whole}.${frac.toString().padStart(6, "0").replace(/0+$/, "")}`;
}

export function regeneratedEnergy(current: number, cap: number, lastRegenAt: number, now: number): number | null {
  if (![current, cap, lastRegenAt, now].every(Number.isInteger)) return null;
  if (current < 0 || current > 255 || cap < 0 || cap > 255) return null;
  if (now <= lastRegenAt || current >= cap) return Math.min(current, cap);
  const ticks = Math.floor((now - lastRegenAt) / ENERGY_REGEN_SECONDS);
  return current + Math.min(ticks, cap - current);
}

export function compareTokenBalances(
  haveRaw: Record<string, bigint>,
  needs: ReadonlyArray<{ resource: string; need: bigint }>,
): Shortage[] | null {
  const missing: Shortage[] = [];
  for (const need of needs) {
    if (need.need < 0n) return null;
    if (need.need === 0n) continue;
    const have = haveRaw[need.resource];
    if (have === undefined || have < 0n) return null;
    if (have >= need.need) continue;
    const haveText = formatRawUnits(have);
    const needText = formatRawUnits(need.need);
    if (!haveText || !needText) return null;
    missing.push({ resource: need.resource, have: haveText, need: needText });
  }
  return missing;
}
