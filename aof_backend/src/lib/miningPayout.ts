import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { materialMintsPda, configPda } from "./pda";
import { fetchOne } from "./decode";

// Базовая ставка: 10 единиц ресурса в час для common
const BASE_RATE = 10;

// YIELD_BPS по редкости (basis points, 10000 = 100%)
const YIELD_BPS: Record<string, number> = {
  common: 10000,
  uncommon: 11500,
  rare: 13000,
  epic: 15000,
  legendary: 18000,
};

// Маппинг toolType → ключ в MaterialMints PDA
const TOOL_TO_RESOURCE: Record<string, string> = {
  axe: "WOOD",
  pick: "STONE",
  bow: "MEAT",
  reaper: "SEEDS",
};

/**
 * Получить mint ресурса по toolType.
 * Читает адреса из Config PDA (FOOD/WOOD/STONE) и MaterialMints PDA (все остальные).
 */
export async function getMintForToolType(toolType: string): Promise<PublicKey | null> {
  const key = TOOL_TO_RESOURCE[toolType.toLowerCase()];
  if (!key) return null;

  // Базовые ресурсы из Config
  if (key === "FOOD" || key === "WOOD" || key === "STONE") {
    const [cfgAddr] = configPda();
    const cfg: any = await fetchOne("config", cfgAddr);
    const field = key === "FOOD" ? "foodMint" : key === "WOOD" ? "woodMint" : "stoneMint";
    const mint = cfg?.[field];
    return mint ? new PublicKey(mint) : null;
  }

  // Новые ресурсы из MaterialMints
  const [mmAddr] = materialMintsPda();
  const mm: any = await fetchOne("materialMints", mmAddr);
  const fieldMap: Record<string, string> = {
    SEEDS: "seeds",
    WHEAT: "wheat",
    FLOUR: "flour",
    BREAD: "bread",
    WATER: "water",
    COAL: "coal",
    MEAT: "meat",
  };
  const field = fieldMap[key];
  if (!field) return null;
  const mint = mm?.[field];
  return mint ? new PublicKey(mint) : null;
}

/**
 * Рассчитать amount ресурса по формуле: hours × BASE_RATE × YIELD_BPS[rarity] / 10000
 */
export function calculatePayoutAmount(hours: number, rarity: string): BN {
  const yieldBps = YIELD_BPS[rarity.toLowerCase()] || YIELD_BPS.common;
  const amount = Math.floor(hours * BASE_RATE * yieldBps / 10000);
  return new BN(amount);
}

/**
 * Рассчитать coal drop для pick (15% шанс, floor(hours/2) Coal).
 * Возвращает { mint, amount } или null если не повезло.
 */
export async function calculateCoalDrop(
  toolType: string,
  hours: number
): Promise<{ mint: PublicKey; amount: BN } | null> {
  if (toolType.toLowerCase() !== "pick") return null;
  if (Math.random() >= 0.15) return null; // 15% шанс

  const coalAmount = Math.floor(hours / 2);
  if (coalAmount <= 0) return null;

  // Читаем COAL из MaterialMints PDA
  const [mmAddr] = materialMintsPda();
  const mm: any = await fetchOne("materialMints", mmAddr);
  const mint = mm?.coal;
  if (!mint) return null;

  return { mint: new PublicKey(mint), amount: new BN(coalAmount) };
}
