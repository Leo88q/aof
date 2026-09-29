import { functionalStorage, readConsent } from '../legal/consent';
import { pages } from './content/pages';

/** Site-only reading marks, never quest progress or a claimable game reward. */
export const SITE_JOURNAL_KEY = 'aof:site:journal:v1';
export const siteBadgeIds = ['reader', 'resource', 'commit', 'pack', 'drum', 'chronicler'] as const;
export type SiteBadgeId = typeof siteBadgeIds[number];
export type SiteJournal = { visits: string[]; badges: SiteBadgeId[] };
const pageIds = new Set(pages.map(page => page.id));
const validBadge = (id: unknown): id is SiteBadgeId => siteBadgeIds.includes(id as SiteBadgeId);
const empty = (): SiteJournal => ({ visits: [], badges: [] });
let session: SiteJournal | null = null;

/** Never let corrupt/forged browser storage create impossible counts or render arbitrary text. */
export function parseSiteJournal(raw: string | null): SiteJournal {
  try {
    const value: unknown = JSON.parse(raw || 'null');
    if (!value || typeof value !== 'object') return empty();
    const record = value as Record<string, unknown>;
    const visits = Array.isArray(record.visits)
      ? [...new Set(record.visits.filter((id): id is string => typeof id === 'string' && pageIds.has(id)))].slice(0, pageIds.size)
      : [];
    const recorded = record.badges;
    const badges = Array.isArray(recorded)
      ? siteBadgeIds.filter(id => recorded.includes(id) && (id !== 'reader' || visits.length >= 5))
      : [];
    return { visits, badges };
  } catch { return empty(); }
}

/** No tracking and no persisted marks before optional functional consent. */
export function readSiteJournal(): SiteJournal | null {
  if (!readConsent()?.functional) { session = null; return null; }
  return session ?? (session = parseSiteJournal(functionalStorage.getItem(SITE_JOURNAL_KEY)));
}

function save(next: SiteJournal) {
  session = next;
  functionalStorage.setItem(SITE_JOURNAL_KEY, JSON.stringify(next));
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('aof:journal-change'));
}

export function recordSiteVisit(id: string) {
  const previous = readSiteJournal();
  if (!previous || !pageIds.has(id) || previous.visits.includes(id)) return;
  const visits = [...previous.visits, id];
  const badges = visits.length >= 5 && !previous.badges.includes('reader')
    ? [...previous.badges, 'reader' as const] : previous.badges;
  save({ visits, badges });
}

export function recordSiteBadge(id: unknown) {
  const previous = readSiteJournal();
  if (!previous || !validBadge(id) || id === 'reader' || previous.badges.includes(id)) return;
  save({ ...previous, badges: [...previous.badges, id] });
}

export function resetSiteJournal() {
  if (readSiteJournal()) save(empty());
}

/** Called when consent changes or another tab updates local storage. */
export function refreshSiteJournal() {
  session = null;
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('aof:journal-change'));
}
