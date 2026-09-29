import { editorialPages } from '../../i18n/siteEditorial';

export interface ManifestoPrinciple { title: string; text: string; }

// Preserve the catalog export for callers, but share the reviewed seven-language
// source with the visible page so a stale manifesto cannot diverge silently.
export const manifestoPrinciples: ManifestoPrinciple[] = editorialPages.ru.manifesto.principles.map(({ title, text }) => ({ title, text }));
export const manifestoClosing = editorialPages.ru.manifesto.closing;
