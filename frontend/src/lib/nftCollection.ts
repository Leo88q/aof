export type NftRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export interface NftCollectionItem {
  id: string;
  name: string;
  collection: string;
  rarity: NftRarity;
  rarityLabel: string;
  description: string;
  image: string;
  metadata: string;
  accent: string;
}

const NFT_ROOT = "/assets/nfts";

/**
 * Static collection catalogues for the card artwork shipped with the
 * frontend. Image and metadata paths are public assets so they survive
 * rebuilds and can be served by the same host as the application.
 */
export const BIOMOLECULE_SEQUENCER_NFTS: readonly NftCollectionItem[] = [
  {
    id: "biomolecule-sequencer-common",
    name: "Biomolecule Sequencer",
    collection: "Neural Analyzer",
    rarity: "common",
    rarityLabel: "Common",
    description: "A reliable laboratory sequencer for foundational biomolecule analysis.",
    image: `${NFT_ROOT}/biomolecule-sequencer/common.png`,
    metadata: `${NFT_ROOT}/biomolecule-sequencer/metadata/common.json`,
    accent: "#b8eff7",
  },
  {
    id: "biomolecule-sequencer-uncommon",
    name: "Biomolecule Sequencer",
    collection: "Neural Analyzer",
    rarity: "uncommon",
    rarityLabel: "Uncommon",
    description: "An upgraded green-spectrum analyzer with improved signal stability.",
    image: `${NFT_ROOT}/biomolecule-sequencer/uncommon.png`,
    metadata: `${NFT_ROOT}/biomolecule-sequencer/metadata/uncommon.json`,
    accent: "#69ff72",
  },
  {
    id: "biomolecule-sequencer-rare",
    name: "Biomolecule Sequencer",
    collection: "Neural Analyzer",
    rarity: "rare",
    rarityLabel: "Rare",
    description: "A dual-chamber analyzer built for parallel neural sequence scans.",
    image: `${NFT_ROOT}/biomolecule-sequencer/rare.png`,
    metadata: `${NFT_ROOT}/biomolecule-sequencer/metadata/rare.json`,
    accent: "#38e8ff",
  },
  {
    id: "biomolecule-sequencer-epic",
    name: "Biomolecule Sequencer",
    collection: "Neural Analyzer",
    rarity: "epic",
    rarityLabel: "Epic",
    description: "A charged magenta analyzer that pushes the sequence chamber beyond normal limits.",
    image: `${NFT_ROOT}/biomolecule-sequencer/epic.png`,
    metadata: `${NFT_ROOT}/biomolecule-sequencer/metadata/epic.json`,
    accent: "#ff35c8",
  },
  {
    id: "biomolecule-sequencer-legendary",
    name: "Biomolecule Sequencer",
    collection: "Neural Analyzer",
    rarity: "legendary",
    rarityLabel: "Legendary",
    description: "The gilded apex of the Neural Analyzer series, tuned for perfect signal clarity.",
    image: `${NFT_ROOT}/biomolecule-sequencer/legendary.png`,
    metadata: `${NFT_ROOT}/biomolecule-sequencer/metadata/legendary.json`,
    accent: "#ffd36b",
  },
] as const;

export const QUANTUM_TRANSMITTER_NFTS: readonly NftCollectionItem[] = [
  {
    id: "quantum-transmitter-common",
    name: "Quantum Transmitter",
    collection: "Long-Range Data",
    rarity: "common",
    rarityLabel: "Common",
    description: "A dependable satellite transmitter for routine long-range data relay.",
    image: `${NFT_ROOT}/quantum-transmitter/common.png`,
    metadata: `${NFT_ROOT}/quantum-transmitter/metadata/common.json`,
    accent: "#b8eff7",
  },
  {
    id: "quantum-transmitter-uncommon",
    name: "Quantum Transmitter",
    collection: "Long-Range Data",
    rarity: "uncommon",
    rarityLabel: "Uncommon",
    description: "An upgraded green-spectrum dish with a stronger and more stable signal.",
    image: `${NFT_ROOT}/quantum-transmitter/uncommon.png`,
    metadata: `${NFT_ROOT}/quantum-transmitter/metadata/uncommon.json`,
    accent: "#69ff72",
  },
  {
    id: "quantum-transmitter-rare",
    name: "Quantum Transmitter",
    collection: "Long-Range Data",
    rarity: "rare",
    rarityLabel: "Rare",
    description: "A deep-space transmitter tuned for precise relay across distant systems.",
    image: `${NFT_ROOT}/quantum-transmitter/rare.png`,
    metadata: `${NFT_ROOT}/quantum-transmitter/metadata/rare.json`,
    accent: "#38e8ff",
  },
  {
    id: "quantum-transmitter-epic",
    name: "Quantum Transmitter",
    collection: "Long-Range Data",
    rarity: "epic",
    rarityLabel: "Epic",
    description: "A charged magenta transmitter that turns cosmic interference into reach.",
    image: `${NFT_ROOT}/quantum-transmitter/epic.png`,
    metadata: `${NFT_ROOT}/quantum-transmitter/metadata/epic.json`,
    accent: "#ff35c8",
  },
  {
    id: "quantum-transmitter-legendary",
    name: "Quantum Transmitter",
    collection: "Long-Range Data",
    rarity: "legendary",
    rarityLabel: "Legendary",
    description: "The gilded apex of the Long-Range Data series, built for perfect transmission.",
    image: `${NFT_ROOT}/quantum-transmitter/legendary.png`,
    metadata: `${NFT_ROOT}/quantum-transmitter/metadata/legendary.json`,
    accent: "#ffd36b",
  },
] as const;

export const ROBOTIC_HARVEST_ARM_NFTS: readonly NftCollectionItem[] = [
  {
    id: "robotic-harvest-arm-common",
    name: "Robotic Harvest Arm",
    collection: "Automated Collector",
    rarity: "common",
    rarityLabel: "Common",
    description: "A dependable robotic arm for automated collection in the farm laboratory.",
    image: `${NFT_ROOT}/robotic-harvest-arm/common.png`,
    metadata: `${NFT_ROOT}/robotic-harvest-arm/metadata/common.json`,
    accent: "#b8eff7",
  },
  {
    id: "robotic-harvest-arm-uncommon",
    name: "Robotic Harvest Arm",
    collection: "Automated Collector",
    rarity: "uncommon",
    rarityLabel: "Uncommon",
    description: "A greenhouse-ready collector with a precision claw and upgraded green drive.",
    image: `${NFT_ROOT}/robotic-harvest-arm/uncommon.png`,
    metadata: `${NFT_ROOT}/robotic-harvest-arm/metadata/uncommon.json`,
    accent: "#69ff72",
  },
  {
    id: "robotic-harvest-arm-rare",
    name: "Robotic Harvest Arm",
    collection: "Automated Collector",
    rarity: "rare",
    rarityLabel: "Rare",
    description: "RH-7 is a precision hydroponic collector built for repeatable harvest cycles.",
    image: `${NFT_ROOT}/robotic-harvest-arm/rare.png`,
    metadata: `${NFT_ROOT}/robotic-harvest-arm/metadata/rare.json`,
    accent: "#38e8ff",
  },
  {
    id: "robotic-harvest-arm-epic",
    name: "Robotic Harvest Arm",
    collection: "Automated Collector",
    rarity: "epic",
    rarityLabel: "Epic",
    description: "A charged magenta collector that can safely handle energized harvest cores.",
    image: `${NFT_ROOT}/robotic-harvest-arm/epic.png`,
    metadata: `${NFT_ROOT}/robotic-harvest-arm/metadata/epic.json`,
    accent: "#ff35c8",
  },
  {
    id: "robotic-harvest-arm-legendary",
    name: "Robotic Harvest Arm",
    collection: "Automated Collector",
    rarity: "legendary",
    rarityLabel: "Legendary",
    description: "The gilded apex of the Automated Collector series, tuned for perfect yield.",
    image: `${NFT_ROOT}/robotic-harvest-arm/legendary.png`,
    metadata: `${NFT_ROOT}/robotic-harvest-arm/metadata/legendary.json`,
    accent: "#ffd36b",
  },
] as const;

export function getBiomoleculeSequencerNft(rarity: string): NftCollectionItem {
  const normalized = rarity.toLowerCase() as NftRarity;
  return BIOMOLECULE_SEQUENCER_NFTS.find((item) => item.rarity === normalized)
    || BIOMOLECULE_SEQUENCER_NFTS[0];
}

export function isBiomoleculeSequencer(toolType: unknown): boolean {
  const normalized = String(toolType || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  return normalized === "biomolecule_sequencer" || normalized === "neural_analyzer";
}
