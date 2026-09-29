// Compendium entries are off-chain observations, not proof of NFT ownership.
// Require the complete backend grid before displaying either a count or a blank tile.
export const COMPENDIUM_TOOL_IDS = [
  'plasma_cutter', 'silicon_extractor', 'data_harvester', 'quantum_transmitter', 'neural_seeder',
] as const;
export const COMPENDIUM_RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const;

export function readCompendiumGrid(raw: unknown): Set<string> | null {
  if (!raw || typeof raw !== 'object' || !('grid' in raw) || !Array.isArray(raw.grid)) return null;
  if (raw.grid.length !== COMPENDIUM_TOOL_IDS.length) return null;
  const found = new Set<string>();
  const tools = new Set<string>();
  for (const row of raw.grid) {
    if (!row || typeof row !== 'object' || !COMPENDIUM_TOOL_IDS.includes(row.toolType) ||
        tools.has(row.toolType) || !Array.isArray(row.rarities) || row.rarities.length !== COMPENDIUM_RARITIES.length) return null;
    tools.add(row.toolType);
    const rarities = new Set<string>();
    for (const cell of row.rarities) {
      if (!cell || typeof cell !== 'object' || !COMPENDIUM_RARITIES.includes(cell.rarity) ||
          rarities.has(cell.rarity) || typeof cell.seen !== 'boolean') return null;
      rarities.add(cell.rarity);
      if (cell.seen) found.add(`${row.toolType}-${cell.rarity}`);
    }
  }
  return found;
}
