import type { Language } from '../i18n/translations';
import { legacyVrfRussian, vrfCopy } from '../i18n/vrfCopy';

/** [F-06] Stable API/program errors. Keep the pattern order aligned with
 * vrfCopy; recognizing a known error does not prove payment settlement. */
const PATTERNS = [
  /VRF_POOL_EXHAUSTED|VrfSlotBusy/,
  /VRF_POOL_EMPTY/,
  /VRF_ORACLE_UNAVAILABLE/,
  /VRF_SETTLEMENT_DEGRADED/,
  /PRICE_ABOVE_MAXIMUM|PriceAboveMaximum/,
  /RevealWindowClosed/,
  /LotterySalesClosed/,
] as const;

/** Let the second stage of the API error pipeline translate these codes rather
 * than consume them in the generic fail-closed-code fallback. */
export function isKnownVrfCode(code: string): boolean {
  return /^VRF_[A-Z_]+$/.test(code) && PATTERNS.some(pattern => pattern.test(code));
}

export function humanizeVrfError(message: string, language: Language = 'ru'): string {
  for (const [index, pattern] of PATTERNS.entries()) {
    if (pattern.test(message) || message === vrfCopy.ru[index] || message === legacyVrfRussian[index]) {
      return vrfCopy[language][index];
    }
  }
  return message;
}
