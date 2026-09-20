/**
 * NFT-карточки предметов «Robotic Harvest Arm / Automated Collector».
 *
 * Ассеты лежат в `frontend/public/nft/cards/` (PNG-32, прозрачный фон) —
 * сгенерированы скриптом `scripts/nft-cards/make_cards.py`, см. README рядом
 * с файлами. `rarityId` совпадает с `Rarity::index()` из `aof-core/src/state.rs`
 * (Common = 0 … Legendary = 4), поэтому карточку можно выбирать напрямую по
 * значению из блокчейна.
 */

export type NftRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export interface NftCardAsset {
  rarity: NftRarity;
  /** Индекс редкости on-chain: Common = 0 … Legendary = 4. */
  rarityId: number;
  label: string;
  /** Акцентный цвет карточки — для рамок, свечения и подписей в UI. */
  accent: string;
  /** Полноразмерный PNG с прозрачным фоном. */
  png: string;
  /** 512 px lossless WebP для гридов инвентаря и превью. */
  webp: string;
}

/** Общий холст всех карточек — держите это соотношение сторон, чтобы сетка не «прыгала». */
export const NFT_CARD_CANVAS = { width: 759, height: 1332 } as const;

/** Соотношение сторон карточки (≈ 0.57) для `aspect-ratio` в CSS. */
export const NFT_CARD_RATIO = NFT_CARD_CANVAS.width / NFT_CARD_CANVAS.height;

const BASE = "/nft/cards";

export const NFT_CARDS: Record<NftRarity, NftCardAsset> = {
  common: {
    rarity: "common", rarityId: 0, label: "Common", accent: "#9FE8F5",
    png: `${BASE}/common.png`, webp: `${BASE}/webp/common@512.webp`,
  },
  uncommon: {
    rarity: "uncommon", rarityId: 1, label: "Uncommon", accent: "#3DFF7A",
    png: `${BASE}/uncommon.png`, webp: `${BASE}/webp/uncommon@512.webp`,
  },
  rare: {
    rarity: "rare", rarityId: 2, label: "Rare", accent: "#3FA9FF",
    png: `${BASE}/rare.png`, webp: `${BASE}/webp/rare@512.webp`,
  },
  epic: {
    rarity: "epic", rarityId: 3, label: "Epic", accent: "#FF3DD1",
    png: `${BASE}/epic.png`, webp: `${BASE}/webp/epic@512.webp`,
  },
  legendary: {
    rarity: "legendary", rarityId: 4, label: "Legendary", accent: "#FFC030",
    png: `${BASE}/legendary.png`, webp: `${BASE}/webp/legendary@512.webp`,
  },
};

/** Порядок вывода в коллекциях/паках — от Common к Legendary. */
export const NFT_RARITY_ORDER: readonly NftRarity[] = [
  "common", "uncommon", "rare", "epic", "legendary",
];

/** Нормализует редкость из любого формата: строка, `{ uncommon: {} }` или индекс on-chain. */
export function toNftRarity(rarity: unknown): NftRarity {
  if (typeof rarity === "number") {
    return NFT_RARITY_ORDER[Math.max(0, Math.min(NFT_RARITY_ORDER.length - 1, rarity))];
  }
  if (typeof rarity === "string") {
    const key = rarity.trim().toLowerCase() as NftRarity;
    if (key in NFT_CARDS) return key;
  }
  if (rarity && typeof rarity === "object") {
    const key = Object.keys(rarity as Record<string, unknown>)[0]?.toLowerCase() as NftRarity;
    if (key && key in NFT_CARDS) return key;
  }
  return "common";
}

/** Описание карточки по редкости (в любом формате). */
export function nftCard(rarity: unknown): NftCardAsset {
  return NFT_CARDS[toNftRarity(rarity)];
}

/** URL картинки карточки: полный PNG либо лёгкий WebP для грида. */
export function nftCardSrc(rarity: unknown, opts: { thumb?: boolean } = {}): string {
  const card = nftCard(rarity);
  return opts.thumb ? card.webp : card.png;
}

let preloaded = false;

/** Прогревает кэш браузера всеми карточками (полный размер). Вызывается один раз. */
export function preloadNftCards(): void {
  if (preloaded || typeof window === "undefined") return;
  preloaded = true;
  for (const card of Object.values(NFT_CARDS)) {
    const img = new Image();
    img.decoding = "async";
    img.src = card.png;
  }
}
