import { PublicKey } from '@solana/web3.js';
import { positiveU64 } from './amounts';

export type MarketListing = {
  mint: string; seller: string; priceLamports: string; pubkey?: string;
  tool?: { toolType?: string; rarity?: unknown } | null;
};
export type FreeTool = { mint: string; toolType?: string; rarity?: unknown };

function isAddress(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try { return !new PublicKey(value).equals(PublicKey.default); }
  catch { return false; }
}

export function readListingTreasury(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = (raw as Record<string, unknown>).treasury;
  return isAddress(value) ? value : null;
}

/** Reject a partial or malformed response rather than publishing an empty
 * market or showing a 0-SOL quote. Price stays an exact decimal u64 string. */
export function readMarketListings(raw: unknown): MarketListing[] | null {
  if (!Array.isArray(raw)) return null;
  const result: MarketListing[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
    const row = entry as Record<string, unknown>;
    if (!isAddress(row.mint) || !isAddress(row.seller)) return null;
    try { positiveU64(row.priceLamports); } catch { return null; }
    result.push({ mint: row.mint, seller: row.seller, priceLamports: row.priceLamports as string,
      ...(typeof row.pubkey === 'string' ? { pubkey: row.pubkey } : {}) });
  }
  return result;
}

/** A failed or incomplete owner read cannot enable a listing action. */
export function readFreeTools(raw: unknown, owner: string): FreeTool[] | null {
  const rows = Array.isArray(raw) ? raw : (raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, unknown>).tools : null);
  if (!Array.isArray(rows)) return null;
  const tools: FreeTool[] = [];
  for (const entry of rows) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
    const row = entry as Record<string, unknown>;
    if (!isAddress(row.mint) || (row.owner != null && row.owner !== owner)) return null;
    if (!row.staked && !row.isMining && !row.mining) tools.push({
      mint: row.mint,
      ...(typeof row.toolType === 'string' ? { toolType: row.toolType } : {}),
      ...(row.rarity != null ? { rarity: row.rarity } : {}),
    });
  }
  return tools;
}
