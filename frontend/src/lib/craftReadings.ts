/** Canonical craft cost/balance keys from aof_backend/src/routes/tools.ts
 * (/craft-quote) and aof_backend/src/routes/query.ts (/balances/:owner).
 * Do not read deprecated wood/stone/food quote fields: they are absent from
 * the response and would incorrectly display the price as zero. */
export const CRAFT_RESOURCES = [
  { key: 'circuit', chain: 'CIRCUIT' },
  { key: 'silicon', chain: 'SILICON' },
  { key: 'data', chain: 'DATA' },
  { key: 'neuron', chain: 'NEURON' },
  { key: 'power', chain: 'POWER' },
  { key: 'mind', chain: 'MIND' },
] as const;
export type CraftResource = (typeof CRAFT_RESOURCES)[number]['key'];
export type CraftAmounts = Record<CraftResource, number>;
export type CraftMints = Record<CraftResource, string>;

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export function readCraftQuote(raw: unknown): CraftAmounts | null {
  if (!object(raw)) return null;
  const entries = CRAFT_RESOURCES.map(({ key }) => [key, raw[key]] as const);
  if (!entries.every(([, n]) => typeof n === 'number' && Number.isFinite(n) && n >= 0)) return null;
  return Object.fromEntries(entries) as CraftAmounts;
}

export function readCraftBalances(raw: unknown): CraftAmounts | null {
  if (!object(raw) || raw.source !== 'onchain') return null;
  const entries = CRAFT_RESOURCES.map(({ key, chain }) => [key, raw[chain]] as const);
  if (!entries.every(([, n]) => typeof n === 'number' && Number.isFinite(n) && n >= 0)) return null;
  return Object.fromEntries(entries) as CraftAmounts;
}

export function readCraftMints(raw: unknown): CraftMints | null {
  if (!object(raw) || raw.initialized !== true || !object(raw.mints)) return null;
  const entries = CRAFT_RESOURCES.map(({ key, chain }) => [key, (raw.mints as Record<string, unknown>)[chain]] as const);
  if (!entries.every(([, mint]) => typeof mint === 'string' && mint.length >= 32 && mint !== '11111111111111111111111111111111')) return null;
  return Object.fromEntries(entries) as CraftMints;
}
