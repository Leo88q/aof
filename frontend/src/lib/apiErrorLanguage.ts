import type { Language } from '../i18n/translations';

// The API client is not a React component. LocaleProvider updates this tiny
// bridge on a language change; no dependency on document.lang or localStorage.
let current: Language = 'ru';
export const getApiErrorLanguage = (): Language => current;
export const setApiErrorLanguage = (language: Language): void => { current = language; };
