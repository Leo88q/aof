import { TOOL_RESOURCE_MINT, miningRewardMint } from "./toolResourceMint";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { materialMintsPda, configPda } from "./pda";
import { fetchOneForSigner } from "./decode";

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

/** Read the same mint account/field that collect_mining validates on-chain. */
export async function getMintForToolType(toolType: string): Promise<PublicKey | null> {
  const entry = TOOL_RESOURCE_MINT[toolType as keyof typeof TOOL_RESOURCE_MINT];
  if (!entry) return null;
  const [addr] = entry.account === 'config' ? configPda() : materialMintsPda();
  const account = await fetchOneForSigner(entry.account === 'config' ? 'config' : 'materialMints', addr);
  const mint = miningRewardMint(toolType, entry.account === 'config' ? account : null, entry.account === 'materials' ? account : null);
  return mint;
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
