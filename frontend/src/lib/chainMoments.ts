/** Numbers the screens show. They mirror aof-core constants, they are not a second economy. */

export const FLASK_ENERGY_GAIN = [5, 5, 8, 10, 20] as const;

export const SEAL_FLUIDS = ["CRYO_FLUID", "VOLT_FLUID", "BIO_FLUID", "NANO_FLUID", "QUANTUM_FLUID"] as const;

export const EXPLORATION_BURN = { data: 75, circuit: 35, silicon: 35, dataset: 50 } as const;

export const TOOL_LINE_KEYS = [
  "plasma_cutter",
  "silicon_extractor",
  "data_harvester",
  "quantum_transmitter",
  "neural_seeder",
] as const;

export type ToolLineKey = (typeof TOOL_LINE_KEYS)[number];

export function toolLineKey(toolType: string): ToolLineKey | null {
  const key = toolType.trim().toLowerCase();
  return (TOOL_LINE_KEYS as readonly string[]).includes(key) ? key as ToolLineKey : null;
}

/** Capsules roll only these three. Seeder and transmitter are craft or fuse. */
export const CAPSULE_TOOL_TYPES = ["plasma_cutter", "silicon_extractor", "data_harvester"] as const;
