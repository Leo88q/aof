import type { Language } from '../i18n/translations';

const ogLocales: Record<Language, string> = {
  ru: 'ru_RU', en: 'en_US', pt: 'pt_BR', es: 'es_ES',
  vi: 'vi_VN', id: 'id_ID', fil: 'fil_PH',
};

/** Keep browser and social-preview metadata aligned with the active route.
 * It only updates text and locale; it does not assert availability or approval. */
export function setPageMetadata(title: string, description: string, language: Language): void {
  document.title = title;
  const setMeta = (attr: 'name' | 'property', key: string, content: string) => {
    let element = document.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
    if (!element) {
      element = document.createElement('meta');
      element.setAttribute(attr, key);
      document.head.appendChild(element);
    }
    element.setAttribute('content', content);
  };
  setMeta('name', 'description', description);
  setMeta('property', 'og:title', title);
  setMeta('property', 'og:description', description);
  setMeta('property', 'og:locale', ogLocales[language]);
  setMeta('name', 'twitter:title', title);
  setMeta('name', 'twitter:description', description);
}
