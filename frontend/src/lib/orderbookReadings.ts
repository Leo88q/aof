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

// ============================================================================
// v2: цена за ЦЕЛЫЙ ресурс. Программа (`quote_total_lamports` в
// aof-core/src/instructions/orderbook.rs) считает
// ceil(price_lamports_per_whole × atoms / 10^9), а комиссию тейкера —
// ceil(total × 40 / 10^4). Те же формулы ниже: расхождение хотя бы на лампор
// означает, что кошелёк подпишет не то, что показано, поэтому обе стороны
// считаются одной и той же целочисленной арифметикой.
// ============================================================================
export const ATOMS_PER_RESOURCE = 1_000_000_000n;

export type ResourceOrderV2 = {
  pubkey: string; maker: string; mint: string; kind: number; isBuy: boolean;
  priceLamportsPerWhole: string; amountRemaining: string; escrowLamports: string;
};
export type OrderbookV2 = { buy: ResourceOrderV2[]; sell: ResourceOrderV2[]; exhausted: ResourceOrderV2[] };

export function quoteTotalLamports(pricePerWhole: string | bigint, amountAtoms: string | bigint): bigint {
  const price = BigInt(pricePerWhole), atoms = BigInt(amountAtoms);
  if (price < 0n || atoms < 0n) throw new Error('negative amount');
  return (price * atoms + ATOMS_PER_RESOURCE - 1n) / ATOMS_PER_RESOURCE;
}

export const takerBufferLamports = (total: bigint): bigint => (total * 40n + 9_999n) / 10_000n;

/** Decimal resources ("1.5") -> atoms. More than 9 decimals is refused, never rounded. */
export function resourceUnitsToAtoms(input: string): string {
  const value = input.trim();
  if (!/^(0|[1-9][0-9]*)(\.[0-9]{1,9})?$/.test(value)) throw new Error('amount');
  const [whole, fraction = ''] = value.split('.');
  const atoms = BigInt(whole) * ATOMS_PER_RESOURCE + BigInt(fraction.padEnd(9, '0') || '0');
  if (atoms <= 0n || atoms > U64) throw new Error('amount');
  return atoms.toString();
}

/** SOL per whole resource ("0.001") -> lamports per whole resource (1_000_000). */
export function solPerWholeToLamports(input: string): string {
  const value = input.trim();
  if (!/^(0|[1-9][0-9]*)(\.[0-9]{1,9})?$/.test(value)) throw new Error('price');
  const [whole, fraction = ''] = value.split('.');
  const lamports = BigInt(whole) * 1_000_000_000n + BigInt(fraction.padEnd(9, '0') || '0');
  if (lamports <= 0n || lamports > U64) throw new Error('price');
  return lamports.toString();
}

export function readOrderbookV2(value: unknown, mint: string, kind: number): OrderbookV2 | null {
  if (!value || typeof value !== 'object' || !pubkey(mint) || !Number.isInteger(kind)) return null;
  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw.buy) || !Array.isArray(raw.sell) || !Array.isArray(raw.exhausted)) return null;
  const seen = new Set<string>();
  const parse = (rows: unknown[], isBuy: boolean | null, exhausted = false): ResourceOrderV2[] | null => {
    const result: ResourceOrderV2[] = [];
    for (const item of rows) {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      if (row.mint !== mint || row.kind !== kind || typeof row.isBuy !== 'boolean' ||
          (isBuy !== null && row.isBuy !== isBuy) || !pubkey(row.pubkey) || !pubkey(row.maker) ||
          !atomic(row.priceLamportsPerWhole) || !atomic(row.amountRemaining, true) ||
          !atomic(row.escrowLamports, true) ||
          (exhausted ? row.amountRemaining !== '0' : row.amountRemaining === '0') ||
          // Покупатель держит эскроу, у продавца его нет: иначе книга покажет
          // платёжеспособную заявку, которая не сведётся, или наоборот.
          (row.isBuy === true && row.escrowLamports === '0') ||
          (row.isBuy === false && row.escrowLamports !== '0')) return null;
      const order = PublicKey.findProgramAddressSync(
        [new TextEncoder().encode('resource_order_v2'), new PublicKey(row.maker).toBuffer(), new PublicKey(mint).toBuffer()],
        new PublicKey(CORE_PROGRAM_ID),
      )[0].toBase58();
      if (row.pubkey !== order || seen.has(order)) return null;
      seen.add(order);
      result.push(row as ResourceOrderV2);
    }
    return result;
  };
  const buy = parse(raw.buy, true);
  const sell = parse(raw.sell, false);
  const exhausted = parse(raw.exhausted, null, true);
  return buy && sell && exhausted ? { buy, sell, exhausted } : null;
}

export const comparePriceV2 = (a: ResourceOrderV2, b: ResourceOrderV2): number =>
  BigInt(a.priceLamportsPerWhole) > BigInt(b.priceLamportsPerWhole) ? 1 :
    BigInt(a.priceLamportsPerWhole) < BigInt(b.priceLamportsPerWhole) ? -1 : 0;

/** Цена v2 — лампорты за ЦЕЛЫЙ ресурс; показываем её как SOL, без округления. */
export const lamportsPerWholeToSol = (priceLamportsPerWhole: string, locale: string): string => {
  const lamports = BigInt(positiveAtomic(priceLamportsPerWhole));
  const whole = lamports / 1_000_000_000n;
  const fraction = (lamports % 1_000_000_000n).toString().padStart(9, '0').replace(/0+$/, '');
  const sol = `${whole}${fraction ? `.${fraction}` : ''}`;
  return Number(sol).toLocaleString(locale, { maximumFractionDigits: 9 });
};
const positiveAtomic = (value: string): string => {
  if (!/^[1-9][0-9]{0,19}$/.test(value) || BigInt(value) > U64) throw new Error('price');
  return value;
};
