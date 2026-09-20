import { getBiomoleculeSequencerNft, isBiomoleculeSequencer } from "./nftCollection";

export interface RarityMeta {
  color: string;
  label: string;
  glow: string;
}

export const RARITY_META: Record<string, RarityMeta> = {
  common: { color: "#9c8b7a", label: "Common", glow: "0 0 14px rgba(156, 139, 122, 0.18)" },
  uncommon: { color: "#6bbf59", label: "Uncommon", glow: "0 0 18px rgba(107, 191, 89, 0.28)" },
  rare: { color: "#5ab0d6", label: "Rare", glow: "0 0 20px rgba(90, 176, 214, 0.32)" },
  epic: { color: "#e8a33d", label: "Epic", glow: "0 0 22px rgba(232, 163, 61, 0.34)" },
  legendary: { color: "#b8863b", label: "Legendary", glow: "0 0 26px rgba(184, 134, 59, 0.42)" },
};

export const TOOL_ICON: Record<string, string> = {
  axe: "🪓",
  pick: "⛏️",
  spear: "🗡️",
  bow: "🏹",
  biomolecule_sequencer: "🧬",
  neural_analyzer: "🧬",
};

const TOOL_NAMES: Record<string, string> = {
  axe: "Топор",
  pick: "Кирка",
  spear: "Копьё",
  bow: "Лук",
  biomolecule_sequencer: "Biomolecule Sequencer",
  neural_analyzer: "Biomolecule Sequencer",
};

const TOOL_SUBTITLES: Record<string, string> = {
  axe: "Лесной инструмент",
  pick: "Шахтный инструмент",
  spear: "Охотничий инструмент",
  bow: "Инструмент экспедиции",
  biomolecule_sequencer: "Neural Analyzer",
  neural_analyzer: "Neural Analyzer",
};

function normalizeToolType(toolType: unknown): string {
  return String(toolType || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

/** Нормализует ключ редкости из разных форматов. */
export function rarityKey(rarity: unknown): string {
  if (!rarity) return "common";
  if (typeof rarity === "string") return rarity.toLowerCase();
  return Object.keys(rarity as object)[0]?.toLowerCase() || "common";
}

export function getToolName(toolType: unknown): string {
  const key = normalizeToolType(toolType);
  return TOOL_NAMES[key] || "Инструмент";
}

export function getToolSubtitle(toolType: unknown): string {
  const key = normalizeToolType(toolType);
  return TOOL_SUBTITLES[key] || "Инструмент экспедиции";
}

/**
 * Returns a collection artwork only for the newly added Biomolecule
 * Sequencer NFT. Existing game tools keep their icon fallback until their own
 * artwork is registered, so they are never shown with the wrong NFT image.
 */
export function getToolNftCard(toolType: unknown, rarity: string): string | null {
  if (!isBiomoleculeSequencer(toolType)) return null;
  return getBiomoleculeSequencerNft(rarity).image;
}
