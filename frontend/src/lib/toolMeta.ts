export const RARITY_META: Record<string, { color: string; label: string }> = {
  common: { color: "#9AA7B4", label: "Base" },
  uncommon: { color: "#5FD3A8", label: "Enhanced" },
  rare: { color: "#5FC9DA", label: "Quantum" },
  epic: { color: "#E0708A", label: "Singularity" },
  legendary: { color: "#A99BEC", label: "Transcendent" },
};

export const TOOL_ICON: Record<string, string> = {
  // Current NeuroForge tool art
  plasma_cutter: "/assets/nfts/plasma-cutter.png",
  silicon_extractor: "/assets/nfts/silicon-extractor.png",
  data_harvester: "/assets/nfts/data-harvester.png",
  quantum_transmitter: "/assets/nfts/quantum-transmitter.png",
  neural_seeder: "/assets/nfts/neural-seeder.png",
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
