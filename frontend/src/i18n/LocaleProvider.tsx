import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { functionalStorage } from '../legal/consent';
import { detectLanguage, languageOptions, languages, messages, type Language, type LanguageChoice, type UIKey } from './translations';
import './locale.css';
import { setApiErrorLanguage } from '../lib/apiErrorLanguage';

const STORAGE_KEY = 'aof:language';
const validChoice = (value: string | null): value is LanguageChoice =>
  value === 'auto' || (languages as readonly string[]).includes(value ?? '');

interface LocaleContextValue {
  language: Language;
  choice: LanguageChoice;
  setChoice: (choice: LanguageChoice) => void;
  t: (key: UIKey) => string;
}
const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<LanguageChoice>(() => {
    const stored = functionalStorage.getItem(STORAGE_KEY);
    return validChoice(stored) ? stored : 'auto';
  });
  const [detected, setDetected] = useState<Language>(() =>
    typeof navigator === 'undefined' ? 'ru' : detectLanguage(navigator.languages?.length ? navigator.languages : [navigator.language]));
  const language = choice === 'auto' ? detected : choice;
  useEffect(() => {
    document.documentElement.lang = language;
    setApiErrorLanguage(language);
  }, [language]);
  useEffect(() => {
    const onChange = () => {
      setDetected(detectLanguage(navigator.languages?.length ? navigator.languages : [navigator.language]));
    };
    window.addEventListener('languagechange', onChange);
    return () => window.removeEventListener('languagechange', onChange);
  }, []);
  useEffect(() => {
    const persistAfterConsent = () => functionalStorage.setItem(STORAGE_KEY, choice);
    window.addEventListener('nf:privacy-change', persistAfterConsent);
    return () => window.removeEventListener('nf:privacy-change', persistAfterConsent);
  }, [choice]);
  const setChoice = (next: LanguageChoice) => {
    setChoiceState(next);
    functionalStorage.setItem(STORAGE_KEY, next);
  };
  return <LocaleContext.Provider value={{ language, choice, setChoice, t: key => messages[language][key] }}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const value = useContext(LocaleContext);
  if (!value) throw new Error('useLocale must be used inside LocaleProvider');
  return value;
}

/** Shared instrument previews also render outside the app (e.g. Storybook). */
export function useInstrumentLanguage(): Language {
  return useContext(LocaleContext)?.language ?? 'ru';
}

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { language, choice, setChoice, t } = useLocale();
  const ref = useRef<HTMLDetailsElement>(null);
  const selected = languageOptions.find(option => option.code === language)!;
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) ref.current.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && ref.current?.open) {
        ref.current.open = false;
        ref.current.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape); };
  }, []);
  return (
    <details className={'locale-switcher' + (compact ? ' locale-switcher--compact' : '')} ref={ref}>
      <summary aria-label={`${t('language')}: ${selected.native}${choice === 'auto' ? ` · ${t('auto')}` : ''}`}>
        <svg className="locale-switcher__globe" width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5"/><path d="M2 10h16M10 2c2.3 2.2 3.4 4.9 3.4 8S12.3 15.8 10 18C7.7 15.8 6.6 13.1 6.6 10S7.7 4.2 10 2Z" stroke="currentColor" strokeWidth="1.2"/></svg>
        <span className="locale-switcher__hint">{t('language')}</span>
        <span className="locale-switcher__code">{language.toUpperCase()}</span>
        {!compact && <span className="locale-switcher__name">{selected.native}</span>}
        <span className="locale-switcher__arrow" aria-hidden="true">⌄</span>
      </summary>
      <div className="locale-switcher__menu" role="group" aria-label={t('language')}>
        {languageOptions.map(option => (
          <button type="button" key={option.code} lang={option.code} aria-pressed={choice === option.code}
            onClick={() => { setChoice(option.code); if (ref.current) ref.current.open = false; }}>
            <strong>{option.code.toUpperCase()}</strong><span><b>{option.native}</b><small>{option.english}</small></span>
          </button>
        ))}
        <button type="button" aria-pressed={choice === 'auto'} onClick={() => { setChoice('auto'); if (ref.current) ref.current.open = false; }}>
          <strong>◎</strong><span><b>{t('auto')}</b><small>{selected.native}</small></span>
        </button>
      </div>
    </details>
  );
}
