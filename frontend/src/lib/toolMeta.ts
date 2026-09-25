export const RARITY_META: Record<string, { color: string; label: string }> = {
  common: { color: "#8890B0", label: "Base" },
  uncommon: { color: "#00E5A0", label: "Enhanced" },
  rare: { color: "#00D4FF", label: "Quantum" },
  epic: { color: "#FFD700", label: "Singularity" },
  legendary: { color: "#9B59FF", label: "Transcendent" },
};

export const TOOL_ICON: Record<string, string> = {
  // [REBRAND] NeuroForge tool art; legacy pre-rebrand ids alias to the same images
  plasma_cutter: "/assets/nfts/plasma-cutter.jpg",
  silicon_extractor: "/assets/nfts/silicon-extractor.jpg",
  data_harvester: "/assets/nfts/data-harvester.jpg",
  quantum_transmitter: "/assets/nfts/quantum-transmitter.jpg",
  neural_seeder: "/assets/nfts/neural-seeder.jpg",
  axe: "/assets/nfts/plasma-cutter.jpg",
  pick: "/assets/nfts/silicon-extractor.jpg",
  spear: "/assets/nfts/data-harvester.jpg",
  bow: "/assets/nfts/quantum-transmitter.jpg",
  reaper: "/assets/nfts/neural-seeder.jpg",
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
