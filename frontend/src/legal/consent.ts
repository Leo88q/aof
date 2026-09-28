// No marketing/analytics SDK is enabled by this module. A future integration
// requires a new policy version, separate opt-in, and an actual loading gate.
export const CONSENT_VERSION = '2026-09-28.2';
export const CONSENT_KEY = 'nf:privacy-choice:v1';
export const MAX_AGE = 180 * 24 * 60 * 60 * 1000;
export const OPTIONAL_KEYS = ['aof:site:journal:v1', 'aof_onboarded', 'manor.sound', 'manor.motion'] as const;
export type Consent = {
  version: string; id: string; timestamp: number; expires: number;
  necessary: true; functional: boolean; analytics: false; marketing: false;
};
let memoryChoice: Consent | null = null;
let memoryOnly = false;
export function gpcEnabled(): boolean {
  return typeof navigator !== 'undefined' && (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
}
export function parseConsent(raw: string | null, now = Date.now(), gpc = false): Consent | null {
  try {
    const v = JSON.parse(raw || 'null');
    if (!v || v.version !== CONSENT_VERSION || typeof v.id !== 'string' || !v.id || v.id.length > 100 ||
        !Number.isFinite(v.timestamp) || !Number.isFinite(v.expires) || v.timestamp > now ||
        v.expires !== v.timestamp + MAX_AGE || v.expires <= now || v.necessary !== true ||
        typeof v.functional !== 'boolean' || v.analytics !== false || v.marketing !== false) return null;
    return { ...v, functional: !gpc && v.functional };
  } catch { return null; }
}
export function createChoice(functional: boolean, now: number, gpc: boolean, id: string): Consent {
  return { version: CONSENT_VERSION, id, timestamp: now, expires: now + MAX_AGE,
    necessary: true, functional: functional && !gpc, analytics: false, marketing: false };
}
export function readConsent(): Consent | null {
  if (memoryOnly) return parseConsent(JSON.stringify(memoryChoice), Date.now(), gpcEnabled());
  try { return parseConsent(localStorage.getItem(CONSENT_KEY), Date.now(), gpcEnabled()); }
  catch { return parseConsent(JSON.stringify(memoryChoice), Date.now(), gpcEnabled()); }
}
export function clearOptionalStorage() {
  for (const key of OPTIONAL_KEYS) { try { localStorage.removeItem(key); } catch { /* blocked storage */ } }
}
export function saveConsent(functional: boolean): { choice: Consent; persisted: boolean } {
  const choice = createChoice(functional, Date.now(), gpcEnabled(), crypto.randomUUID());
  memoryChoice = choice;
  let persisted = true;
  try { localStorage.setItem(CONSENT_KEY, JSON.stringify(choice)); } catch { persisted = false; }
  memoryOnly = !persisted;
  if (!choice.functional) clearOptionalStorage();
  window.dispatchEvent(new Event('nf:privacy-change'));
  return { choice, persisted };
}
export function initializePrivacy() {
  if (!readConsent()?.functional) clearOptionalStorage();
}
export const functionalStorage = {
  getItem(key: string): string | null {
    if (!OPTIONAL_KEYS.includes(key as typeof OPTIONAL_KEYS[number]) || !readConsent()?.functional) return null;
    try { return localStorage.getItem(key); } catch { return null; }
  },
  setItem(key: string, value: string) {
    if (!OPTIONAL_KEYS.includes(key as typeof OPTIONAL_KEYS[number]) || !readConsent()?.functional) return;
    try { localStorage.setItem(key, value); } catch { /* no persistence, app remains usable */ }
  },
};
