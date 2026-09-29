import { apiErrorCopy } from '../i18n/apiErrorCopy';
import type { Language } from '../i18n/translations';
import { walletRuntimeCopy } from '../i18n/walletRuntimeCopy';
import { legacyVrfRussian, vrfCopy } from '../i18n/vrfCopy';
import { humanizeVrfError } from './vrfErrors';

/** A JSON envelope can contain arbitrary server prose. Display only known
 * identifiers; keep unknown errors neutral, without inferring settlement. */
export function txResponseFeedback(raw: unknown, language: Language, fallback: string): string {
  if (typeof raw !== 'string') return fallback;
  const code = raw.trim();
  if (!code || code.length > 512) return fallback;
  // Exact legacy server phrases are known identifiers, not general prose.
  // Map to safe reviewed copy without showing or trusting the old wording.
  const legacyIndex = legacyVrfRussian.indexOf(code);
  const oldCopyIndex = vrfCopy.ru.indexOf(code);
  const index = legacyIndex >= 0 ? legacyIndex : oldCopyIndex;
  if (index >= 0) return vrfCopy[language][index];
  if (code.length > 96) return fallback;
  const messages = apiErrorCopy[language].messages;
  if (Object.prototype.hasOwnProperty.call(messages, code)) {
    return messages[code as keyof typeof messages];
  }
  // VRF codes and program identifiers are explicit inputs, not prose that
  // merely contains an identifier. Never echo legacy server sentences here.
  if (!/^[A-Za-z][A-Za-z0-9_]{2,95}$/.test(code)) return fallback;
  const vrf = humanizeVrfError(code, language);
  return vrf === code ? fallback : vrf;
}

/** Created only by our code for locally generated, localized guard or
 * transaction feedback. Provider and RPC exceptions must never carry this tag. */
export class LocalTxFeedbackError extends Error {}

/** External wallet/RPC exceptions may contain English prose, private logs or
 * unverified status claims. Keep a signature separately for status checks. */
export function txExceptionFeedback(error: unknown, language: Language, fallback: string): string {
  if (error instanceof LocalTxFeedbackError) return error.message;
  const message = error instanceof Error ? error.message : undefined;
  if (typeof message !== 'string') return fallback;
  if (Object.values(walletRuntimeCopy[language]).includes(message)) return message;
  return txResponseFeedback(message, language, fallback);
}

/** Player-facing catch blocks may receive either an API error (with its
 * diagnostic code) or an arbitrary provider/RPC exception. Only translate
 * recognized codes; never render exception prose just because it is a string.
 * `fallback` must describe an unconfirmed outcome, not a definitive failure. */
export function actionErrorFeedback(error: unknown, language: Language, fallback: string): string {
  if (error instanceof LocalTxFeedbackError) return error.message;
  const code = (error as { code?: unknown } | null)?.code;
  if (code === 'API_NETWORK_UNAVAILABLE') return apiErrorCopy[language].networkUnavailable;
  if (typeof code === 'string') return txResponseFeedback(code, language, fallback);
  return txExceptionFeedback(error, language, fallback);
}
