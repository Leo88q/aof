export const RARITY_META: Record<string, { color: string; label: string }> = {
  common: { color: "#9c8b7a", label: "Common" },
  uncommon: { color: "#6bbf59", label: "Uncommon" },
  rare: { color: "#5ab0d6", label: "Rare" },
  epic: { color: "#e8a33d", label: "Epic" },
  legendary: { color: "#b8863b", label: "Legendary" },
};

export const TOOL_ICON: Record<string, string> = {
  axe: "🪓",
  pick: "⛏️",
  spear: "🗡️",
  bow: "🏹",
};

/**
 * Нормализует ключ редкости из разных форматов.
 * Может прийти как строка 'common' или объект { common: {} }.
 */
export function rarityKey(rarity: any): string {
  if (!rarity) return "common";
  if (typeof rarity === "string") return rarity.toLowerCase();
  return Object.keys(rarity)[0]?.toLowerCase() || "common";
}
