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

const NFT_ROOT = "/assets/nfts/biomolecule-sequencer";

/**
 * Static collection catalogue for the Biomolecule Sequencer cards.
 * The image and metadata paths are public assets so they survive rebuilds and
 * can be served by the same host as the frontend.
 */
export const BIOMOLECULE_SEQUENCER_NFTS: readonly NftCollectionItem[] = [
  {
    id: "biomolecule-sequencer-common",
    name: "Biomolecule Sequencer",
    collection: "Neural Analyzer",
    rarity: "common",
    rarityLabel: "Common",
    description: "A reliable laboratory sequencer for foundational biomolecule analysis.",
    image: `${NFT_ROOT}/common.png`,
    metadata: `${NFT_ROOT}/metadata/common.json`,
    accent: "#b8eff7",
  },
  {
    id: "biomolecule-sequencer-uncommon",
    name: "Biomolecule Sequencer",
    collection: "Neural Analyzer",
    rarity: "uncommon",
    rarityLabel: "Uncommon",
    description: "An upgraded green-spectrum analyzer with improved signal stability.",
    image: `${NFT_ROOT}/uncommon.png`,
    metadata: `${NFT_ROOT}/metadata/uncommon.json`,
    accent: "#69ff72",
  },
  {
    id: "biomolecule-sequencer-rare",
    name: "Biomolecule Sequencer",
    collection: "Neural Analyzer",
    rarity: "rare",
    rarityLabel: "Rare",
    description: "A dual-chamber analyzer built for parallel neural sequence scans.",
    image: `${NFT_ROOT}/rare.png`,
    metadata: `${NFT_ROOT}/metadata/rare.json`,
    accent: "#38e8ff",
  },
  {
    id: "biomolecule-sequencer-epic",
    name: "Biomolecule Sequencer",
    collection: "Neural Analyzer",
    rarity: "epic",
    rarityLabel: "Epic",
    description: "A charged magenta analyzer that pushes the sequence chamber beyond normal limits.",
    image: `${NFT_ROOT}/epic.png`,
    metadata: `${NFT_ROOT}/metadata/epic.json`,
    accent: "#ff35c8",
  },
  {
    id: "biomolecule-sequencer-legendary",
    name: "Biomolecule Sequencer",
    collection: "Neural Analyzer",
    rarity: "legendary",
    rarityLabel: "Legendary",
    description: "The gilded apex of the Neural Analyzer series, tuned for perfect signal clarity.",
    image: `${NFT_ROOT}/legendary.png`,
    metadata: `${NFT_ROOT}/metadata/legendary.json`,
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
