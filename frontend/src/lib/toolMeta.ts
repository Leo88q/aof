import { nftCardSrc, toNftRarity, type NftRarity } from "./nftCards";

const RARITY_COLOR: Record<string, { color: string; label: string }> = {
  common: { color: "#9c8b7a", label: "Common" },
  uncommon: { color: "#6bbf59", label: "Uncommon" },
  rare: { color: "#5ab0d6", label: "Rare" },
  epic: { color: "#e8a33d", label: "Epic" },
  legendary: { color: "#b8863b", label: "Legendary" },
};

export const RARITY_META: Record<string, { color: string; label: string; glow: string }> =
  Object.fromEntries(
    Object.entries(RARITY_COLOR).map(([key, value]) => [
      key,
      { ...value, glow: `0 0 22px ${value.color}59` },
    ]),
  ) as Record<string, { color: string; label: string; glow: string }>;

export const TOOL_ICON: Record<string, string> = {
  axe: "🪓",
  pick: "⛏️",
  spear: "🗡️",
  bow: "🏹",
};

const TOOL_NAME: Record<string, string> = {
  axe: "Axe",
  pick: "Pickaxe",
  spear: "Spear",
  bow: "Bow",
};

const TOOL_SUBTITLE: Record<string, string> = {
  axe: "Woodcutter unit",
  pick: "Excavation unit",
  spear: "Hunting unit",
  bow: "Ranging unit",
};

/**
 * Переопределение арта для конкретного типа инструмента.
 * Пока на каждую редкость одна карточка («Robotic Harvest Arm»), но если
 * появятся отдельные серии (axe/pick/spear/bow) — достаточно положить файлы
 * в `public/nft/cards/<toolType>/<rarity>.png` и дописать сюда путь.
 */
const TOOL_CARD_OVERRIDE: Record<string, Partial<Record<NftRarity, string>>> = {};

/**
 * Нормализует ключ редкости из разных форматов.
 * Может прийти как строка 'common' или объект { common: {} }.
 */
export function rarityKey(rarity: any): string {
  if (!rarity) return "common";
  if (typeof rarity === "string") return rarity.toLowerCase();
  return Object.keys(rarity)[0]?.toLowerCase() || "common";
}

/** Человеческое имя инструмента по его типу. */
export function getToolName(toolType?: string): string {
  const key = toolType?.toLowerCase?.() ?? "";
  return TOOL_NAME[key] || "Tool";
}

/** Подпись-роль инструмента (вторая строка на карточке). */
export function getToolSubtitle(toolType?: string): string {
  const key = toolType?.toLowerCase?.() ?? "";
  return TOOL_SUBTITLE[key] || "Automated Collector";
}

/**
 * Путь к NFT-карточке инструмента: `<toolType>/<rarity>.png` при наличии
 * переопределения, иначе общая серия «Robotic Harvest Arm» по редкости.
 * Редкость принимается в любом формате (строка, `{ uncommon: {} }`, индекс).
 */
export function getToolNftCard(toolType?: string, rarity?: unknown): string {
  const key = toolType?.toLowerCase?.() ?? "";
  const override = TOOL_CARD_OVERRIDE[key]?.[toNftRarity(rarity)];
  return override || nftCardSrc(rarity);
}
