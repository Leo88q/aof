import { PublicKey } from '@solana/web3.js';
import { CORE_PROGRAM_ID } from './transactionIntent';

export type ResourceOrder = {
  pubkey: string; maker: string; mint: string; kind: number; isBuy: boolean;
  priceLamportsPerUnit: string; amountRemaining: string;
};
export type Orderbook = { buy: ResourceOrder[]; sell: ResourceOrder[]; exhausted: ResourceOrder[] };
const U64 = (1n << 64n) - 1n;
const atomic = (value: unknown, allowZero = false): value is string =>
  typeof value === 'string' && /^(0|[1-9]\d{0,19})$/.test(value) &&
  (allowZero || value !== '0') && BigInt(value) <= U64;
const pubkey = (value: unknown): value is string => {
  try { return typeof value === 'string' && new PublicKey(value).toBase58() === value; }
  catch { return false; }
};

/** A validated chain read, not an empty book manufactured from a failed response. Include exhausted orders so makers can reclaim rent/escrow. */
export function readOrderbook(value: unknown, mint: string, kind: number): Orderbook | null {
  if (!value || typeof value !== 'object' || !pubkey(mint) || !Number.isInteger(kind)) return null;
  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw.buy) || !Array.isArray(raw.sell) || !Array.isArray(raw.exhausted)) return null;
  const seen = new Set<string>();
  const parse = (rows: unknown[], isBuy: boolean | null, exhausted = false): ResourceOrder[] | null => {
    const result: ResourceOrder[] = [];
    for (const item of rows) {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      if (row.mint !== mint || row.kind !== kind || typeof row.isBuy !== 'boolean' ||
          (isBuy !== null && row.isBuy !== isBuy) || !pubkey(row.pubkey) || !pubkey(row.maker) ||
          !atomic(row.priceLamportsPerUnit) || !atomic(row.amountRemaining, true) ||
          (exhausted ? row.amountRemaining !== '0' : row.amountRemaining === '0')) return null;
      const order = PublicKey.findProgramAddressSync(
        [new TextEncoder().encode('resource_order'), new PublicKey(row.maker).toBuffer(), new PublicKey(mint).toBuffer()],
        new PublicKey(CORE_PROGRAM_ID),
      )[0].toBase58();
      if (row.pubkey !== order || seen.has(order)) return null;
      seen.add(order);
      result.push(row as ResourceOrder);
    }
    return result;
  };
  const buy = parse(raw.buy, true);
  const sell = parse(raw.sell, false);
  const exhausted = parse(raw.exhausted, null, true);
  return buy && sell && exhausted ? { buy, sell, exhausted } : null;
}

/** The contract multiplies priceLamportsPerUnit by *atomic* token quantity, so one full (10^9-atomic) resource costs this many SOL. */
export const priceSolPerResource = (priceLamportsPerUnit: string, locale: string): string =>
  BigInt(priceLamportsPerUnit).toLocaleString(locale);

export function formatResourceUnits(value: string | bigint): string {
  const atoms = BigInt(value);
  const fraction = (atoms % 1_000_000_000n).toString().padStart(9, '0').replace(/0+$/, '');
  return `${atoms / 1_000_000_000n}${fraction ? `.${fraction}` : ''}`;
}

export const comparePrice = (a: ResourceOrder, b: ResourceOrder): number =>
  BigInt(a.priceLamportsPerUnit) > BigInt(b.priceLamportsPerUnit) ? 1 :
    BigInt(a.priceLamportsPerUnit) < BigInt(b.priceLamportsPerUnit) ? -1 : 0;
