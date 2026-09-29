import { RESOURCES } from './visualAssets';
import { homeResourceNames, type ResourceId } from '../i18n/homeDetail';
import type { Language } from '../i18n/translations';

/** Same UPPER_SNAKE keys returned by /query/balances/:owner. The endpoint
 * returns all 27 resources and source:'onchain' only after validating the
 * registry and reading the owner's token accounts. An omitted entry is
 * unknown, never a zero balance. */
export const resourceKey = (id: string) => id.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();
const resourcesByKey = Object.fromEntries(RESOURCES.map(r => [resourceKey(r.id), r.id as ResourceId])) as Record<string, ResourceId>;
export const ALL_BALANCE_KEYS = RESOURCES.map(r => resourceKey(r.id));

export function readEconomyBalances(raw: unknown): Record<string, number> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  if (value.source !== 'onchain' || !ALL_BALANCE_KEYS.every(key =>
    typeof value[key] === 'number' && Number.isFinite(value[key]) && (value[key] as number) >= 0)) return null;
  return Object.fromEntries(ALL_BALANCE_KEYS.map(key => [key, value[key] as number]));
}

export function economyResourceName(language: Language, key: string): string {
  const id = resourcesByKey[key];
  return id ? homeResourceNames[language][id] : key;
}
