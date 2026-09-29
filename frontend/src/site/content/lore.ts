import { siteLore } from '../../i18n/siteLore';

export interface LoreChapter { id: string; era: string; title: string; paragraphs: string[]; }

// Keep the legacy content export for consumers of the site catalog, but share
// the same Russian source of truth with the seven-language editorial edition.
export const loreChapters: LoreChapter[] = siteLore.ru.chapters.map(chapter => ({
  ...chapter,
  paragraphs: [...chapter.paragraphs],
}));
