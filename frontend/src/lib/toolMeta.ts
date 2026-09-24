export const RARITY_META: Record<string, { color: string; label: string }> = {
  common: { color: "#9c8b7a", label: "Base" },
  uncommon: { color: "#6bbf59", label: "Enhanced" },
  rare: { color: "#5ab0d6", label: "Quantum" },
  epic: { color: "#e8a33d", label: "Singularity" },
  legendary: { color: "#b8863b", label: "Transcendent" },
};

export const TOOL_ICON: Record<string, string> = {
  // [REBRAND] NeuroForge tool art; legacy pre-rebrand ids alias to the same images
  plasma_cutter: "/assets/nfts/plasma-cutter.png",
  silicon_extractor: "/assets/nfts/silicon-extractor.png",
  data_harvester: "/assets/nfts/data-harvester.png",
  quantum_transmitter: "/assets/nfts/quantum-transmitter.png",
  neural_seeder: "/assets/nfts/neural-seeder.png",
  axe: "/assets/nfts/plasma-cutter.png",
  pick: "/assets/nfts/silicon-extractor.png",
  spear: "/assets/nfts/data-harvester.png",
  bow: "/assets/nfts/quantum-transmitter.png",
  reaper: "/assets/nfts/neural-seeder.png",
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
