/** Same caps as aof-core/src/constants.rs MAX_HOURS_*. */
export const MAX_MINING_HOURS_BY_RARITY = {
  common: 8,
  uncommon: 12,
  rare: 14,
  epic: 20,
  legendary: 20,
} as const;

export function rarityHourCap(value: unknown): number | null {
  const raw = typeof value === "string"
    ? value
    : value && typeof value === "object" && !Array.isArray(value)
      ? Object.keys(value)[0]
      : "";
  const name = String(raw || "").toLowerCase();
  return name in MAX_MINING_HOURS_BY_RARITY
    ? MAX_MINING_HOURS_BY_RARITY[name as keyof typeof MAX_MINING_HOURS_BY_RARITY]
    : null;
}
