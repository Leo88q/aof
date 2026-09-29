import { PublicKey } from '@solana/web3.js';

// Must match aof-core/src/instructions/collect_mining.rs::resource_kind_for_tool
// and state.rs::mint_for_kind. Only current ToolData ids are accepted.
export const TOOL_RESOURCE_MINT = {
  plasma_cutter: { account: 'config', field: 'woodMint', resource: 'CIRCUIT' },
  silicon_extractor: { account: 'config', field: 'stoneMint', resource: 'SILICON' },
  data_harvester: { account: 'materials', field: 'meat', resource: 'DATASET' },
  quantum_transmitter: { account: 'materials', field: 'meat', resource: 'DATASET' },
  neural_seeder: { account: 'materials', field: 'seeds', resource: 'NEURON' },
} as const;

/** Resolve a current tool's reward mint; invalid/zero/unset registry fails closed.
 * Core normalises ASCII letter case in ToolData, so accept the same spellings.
 */
export function miningRewardMint(toolType: unknown, config: any, materials: any): PublicKey | null {
  if (typeof toolType !== 'string') return null;
  const key = toolType.toLowerCase();
  const entry = TOOL_RESOURCE_MINT[key as keyof typeof TOOL_RESOURCE_MINT];
  if (!entry) return null;
  const account = entry.account === 'config' ? config : materials;
  const raw = account?.[entry.field];
  try {
    if (!raw) return null;
    const mint = raw instanceof PublicKey ? raw : new PublicKey(raw);
    return mint.equals(PublicKey.default) ? null : mint;
  } catch {
    return null;
  }
}
