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
/** Хранилище выбора: сначала постоянное, потом на вкладку, потом память. */
function backing(): Storage | null {
  try { if (typeof localStorage !== 'undefined' && localStorage) return localStorage; } catch { /* запрещено */ }
  return null;
}
function sessionBacking(): Storage | null {
  try { if (typeof sessionStorage !== 'undefined' && sessionStorage) return sessionStorage; } catch { /* запрещено */ }
  return null;
}
export function readConsent(): Consent | null {
  const now = Date.now();
  const gpc = gpcEnabled();
  if (!memoryOnly) {
    const local = backing();
    if (local) {
      try {
        const stored = parseConsent(local.getItem(CONSENT_KEY), now, gpc);
        if (stored) return stored;
      } catch { /* чтение запрещено — идём дальше */ }
    }
    const session = sessionBacking();
    if (session) {
      try {
        const stored = parseConsent(session.getItem(CONSENT_KEY), now, gpc);
        if (stored) return stored;
      } catch { /* чтение запрещено — идём дальше */ }
    }
  }
  return parseConsent(JSON.stringify(memoryChoice), now, gpc);
}
export function clearOptionalStorage() {
  for (const key of OPTIONAL_KEYS) {
    for (const store of [backing(), sessionBacking()]) {
      if (!store) continue;
      try { store.removeItem(key); } catch { /* blocked storage */ }
    }
  }
}
export function saveConsent(functional: boolean): { choice: Consent; persisted: boolean; mode: StorageMode } {
  const choice = createChoice(functional, Date.now(), gpcEnabled(), crypto.randomUUID());
  memoryChoice = choice;
  const payload = JSON.stringify(choice);
  let persisted = true;
  let mode: StorageMode = 'local';
  try { localStorage.setItem(CONSENT_KEY, payload); }
  catch {
    /* Браузер может запретить постоянное хранилище (приватный режим, песочница
       предпросмотра). Тогда выбор уходит на вкладку, а не теряется совсем. */
    persisted = false;
    mode = 'session';
    const session = sessionBacking();
    if (session) {
      try { session.setItem(CONSENT_KEY, payload); persisted = true; } catch { mode = 'memory'; }
    } else { mode = 'memory'; }
  }
  memoryOnly = mode === 'memory';
  if (!choice.functional) clearOptionalStorage();
  if (typeof window !== 'undefined' && window.dispatchEvent) window.dispatchEvent(new Event('nf:privacy-change'));
  return { choice, persisted, mode };
}
export type StorageMode = 'local' | 'session' | 'memory';
export function initializePrivacy() {
  if (!readConsent()?.functional) clearOptionalStorage();
}
export const functionalStorage = {
  getItem(key: string): string | null {
    if (!OPTIONAL_KEYS.includes(key as typeof OPTIONAL_KEYS[number]) || !readConsent()?.functional) return null;
    const store = backing() || sessionBacking();
    if (!store) return null;
    try { return store.getItem(key); } catch { return null; }
  },
  setItem(key: string, value: string) {
    if (!OPTIONAL_KEYS.includes(key as typeof OPTIONAL_KEYS[number]) || !readConsent()?.functional) return;
    const store = backing() || sessionBacking();
    if (!store) return;
    try { store.setItem(key, value); } catch { /* no persistence, app remains usable */ }
  },
};
