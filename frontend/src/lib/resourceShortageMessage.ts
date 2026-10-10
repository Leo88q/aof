import { resourceShortageCopy } from '../i18n/resourceShortageCopy';
import type { Language } from '../i18n/translations';
import { ALL_BALANCE_KEYS, economyResourceName } from './economyBalances';

const AMOUNT = /^(?:0|[1-9]\d*)(?:\.\d{1,9})?$/;
const RESOURCE = /^[A-Z][A-Z0-9_]{0,31}$/;
const ALLOWED = new Set<string>([...ALL_BALANCE_KEYS, 'ENERGY', 'GAS']);

export type ResourceShortage = { resource: string; have: string; need: string };

export function formatAmount(value: number): string | null {
  if (!Number.isFinite(value) || value < 0) return null;
  const text = value.toFixed(9).replace(/\.?0+$/, '');
  return AMOUNT.test(text) ? text : null;
}

/** Drop anything that is not a known resource and a measured amount. An empty
 * list is still a shortage, but it must not invent a resource name. */
export function sanitizeShortages(raw: unknown): ResourceShortage[] {
  if (!Array.isArray(raw)) return [];
  const items: ResourceShortage[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const resource = String((entry as { resource?: unknown }).resource ?? '');
    const have = String((entry as { have?: unknown }).have ?? '');
    const need = String((entry as { need?: unknown }).need ?? '');
    if (!RESOURCE.test(resource) || !ALLOWED.has(resource) || !AMOUNT.test(have) || !AMOUNT.test(need)) continue;
    items.push({ resource, have, need });
  }
  return items;
}

export function formatResourceShortage(language: Language, raw: unknown): string {
  const copy = resourceShortageCopy[language];
  const items = sanitizeShortages(raw);
  if (items.length === 0) return copy.unnamed;
  const text = items.map(item => {
    const name = item.resource === 'ENERGY' ? copy.energy
      : item.resource === 'GAS' ? copy.gas
      : economyResourceName(language, item.resource);
    return `${name}: ${copy.have} ${item.have}, ${copy.need} ${item.need}`;
  }).join('; ');
  return copy.line(text);
}

/** Null means the balances were not fully read. That is not a shortage. */
export function shortagesFromBalances(
  balances: Record<string, number> | null,
  needs: ReadonlyArray<{ resource: string; need: number }>,
  energy: { current: number; need: number } | null = null,
): ResourceShortage[] | null {
  if (!balances) return null;
  const missing: ResourceShortage[] = [];
  for (const need of needs) {
    const have = balances[need.resource];
    if (typeof have !== 'number' || !Number.isFinite(have) || !Number.isFinite(need.need) || need.need < 0) return null;
    if (have >= need.need) continue;
    const haveText = formatAmount(have);
    const needText = formatAmount(need.need);
    if (!haveText || !needText) return null;
    missing.push({ resource: need.resource, have: haveText, need: needText });
  }
  if (energy && Number.isFinite(energy.current) && Number.isFinite(energy.need) && energy.current < energy.need) {
    const haveText = formatAmount(energy.current);
    const needText = formatAmount(energy.need);
    if (!haveText || !needText) return null;
    missing.push({ resource: 'ENERGY', have: haveText, need: needText });
  }
  return missing;
}
