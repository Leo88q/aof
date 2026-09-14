import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { materialMintsPda, configPda } from "./pda";
import { fetchOne } from "./decode";

// Resource mints use 9 decimals; all amounts passed to SPL instructions are
// atomic units (10 display units per hour for common).
export const RESOURCE_UNIT = 1_000_000_000;
const BASE_RATE = 10 * RESOURCE_UNIT;

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
 * Coal drops are not part of the current canonical collect_mining
 * instruction. Keep this legacy helper fail-closed instead of inventing a
 * second, off-chain RNG/economic path that could diverge from the program.
 */
export async function calculateCoalDrop(
  _toolType: string,
  _hours: number
): Promise<{ mint: PublicKey; amount: BN } | null> {
  return null;
}
