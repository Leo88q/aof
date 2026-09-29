import { apiErrorCopy } from '../i18n/apiErrorCopy';
import { getApiErrorLanguage } from './apiErrorLanguage';

/** Translate transport errors only. A received HTTP response must still go
 * through the structured-code parser; wallet-proof exceptions are not caught. */
export async function fetchApi(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (cause) {
    const error = new Error(apiErrorCopy[getApiErrorLanguage()].networkUnavailable) as Error & {
      code?: string; cause?: unknown;
    };
    error.code = 'API_NETWORK_UNAVAILABLE';
    error.cause = cause;
    throw error;
  }
}
