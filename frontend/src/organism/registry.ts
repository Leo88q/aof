/**
 * Organism registry (phase 1, read-only view).
 *
 * Maps the 27 on-chain resources and the 5 tool kinds onto organs of one
 * laboratory body. Groups follow the craft/lab graph in
 * docs/ORGANISM_3D_DESIGN.md; tool→resource follows
 * aof-core/src/instructions/collect_mining.rs::resource_kind_for_tool.
 *
 * Nothing here changes on-chain state or NFT metadata.
 */
import { RESOURCES } from '../lib/visualAssets';

export const ORGAN_IDS = ['base', 'model', 'cores', 'quartz', 'bits', 'fluids', 'special'] as const;
export type OrganId = (typeof ORGAN_IDS)[number];

export const ORGANS: ReadonlyArray<{ id: OrganId; resources: readonly string[] }> = [
  { id: 'base', resources: ['data', 'circuit', 'silicon'] },
  { id: 'model', resources: ['neuron', 'synapse', 'signal', 'model', 'power', 'compute', 'dataset'] },
  { id: 'cores', resources: ['blueCore', 'purpleCore', 'redCore'] },
  { id: 'quartz', resources: ['clearQuartz', 'roseQuartz', 'amberQuartz'] },
  { id: 'bits', resources: ['quantumBit', 'neuralChip', 'photonBit', 'bioChip'] },
  { id: 'fluids', resources: ['cryoFluid', 'voltFluid', 'bioFluid', 'nanoFluid', 'quantumFluid'] },
  { id: 'special', resources: ['mind', 'soulCore'] },
];

/** Five tool kinds, each docked on the body and feeding one resource. */
export const TOOL_DOCKS: ReadonlyArray<{ toolType: string; resource: string }> = [
  { toolType: 'plasma_cutter', resource: 'circuit' },
  { toolType: 'silicon_extractor', resource: 'silicon' },
  { toolType: 'data_harvester', resource: 'dataset' },
  { toolType: 'quantum_transmitter', resource: 'dataset' },
  { toolType: 'neural_seeder', resource: 'neuron' },
];

/** Canonical rarity order (aof-core Rarity enum index 0..4). */
export const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const;
export type Rarity = (typeof RARITY_ORDER)[number];

/** Returns human-readable problems; an empty array means the registry is complete. */
export function registryIssues(): string[] {
  const issues: string[] = [];
  const seen = new Map<string, number>();
  for (const organ of ORGANS) {
    for (const id of organ.resources) seen.set(id, (seen.get(id) ?? 0) + 1);
  }
  const known = new Set(RESOURCES.map((r) => r.id));
  for (const id of known) {
    const count = seen.get(id) ?? 0;
    if (count !== 1) issues.push(`resource ${id} placed ${count} times (expected 1)`);
  }
  for (const id of seen.keys()) {
    if (!known.has(id)) issues.push(`organ lists unknown resource ${id}`);
  }
  if (TOOL_DOCKS.length !== 5) issues.push(`expected 5 tool docks, got ${TOOL_DOCKS.length}`);
  for (const dock of TOOL_DOCKS) {
    if (!seen.has(dock.resource)) issues.push(`dock ${dock.toolType} feeds unknown resource ${dock.resource}`);
  }
  return issues;
}
