/** Same caps as aof-core/src/constants.rs MAX_HOURS_*. */
export const MAX_MINING_HOURS_BY_RARITY = {
  common: 8,
  uncommon: 12,
  rare: 14,
  epic: 20,
  legendary: 20,
} as const;

export type MiningRarity = keyof typeof MAX_MINING_HOURS_BY_RARITY;

export function miningRarityName(value: unknown): MiningRarity | null {
  const raw = typeof value === "string"
    ? value
    : value && typeof value === "object" && !Array.isArray(value)
      ? Object.keys(value)[0]
      : "";
  const name = raw.toLowerCase();
  return name in MAX_MINING_HOURS_BY_RARITY ? name as MiningRarity : null;
}

export function rarityHourCap(value: unknown): number | null {
  const name = miningRarityName(value);
  return name ? MAX_MINING_HOURS_BY_RARITY[name] : null;
}

/** Hours the picker may send: rarity cap and remaining durability, never an invented higher limit. */
export function maxSelectableMiningHours(rarity: unknown, durability: number | null): number {
  const cap = rarityHourCap(rarity);
  const wear = durability === null ? null : Math.floor(durability);
  if (cap === null || wear === null || wear < 1) return 1;
  return Math.max(1, Math.min(cap, wear));
}
