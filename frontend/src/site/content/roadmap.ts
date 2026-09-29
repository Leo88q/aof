import { siteRoadmap } from '../../i18n/siteRoadmap';

export interface RoadmapItem { id: string; era: 'done' | 'now' | 'next' | 'later'; title: string; bullets: string[]; }

// Preserve the content catalog export for callers, but keep the Russian copy
// in the same reviewed seven-language source as the visible roadmap page.
export const roadmapEraNames: Record<RoadmapItem['era'], string> = siteRoadmap.ru.eraLabels;
export const roadmapItems: RoadmapItem[] = siteRoadmap.ru.items.map(item => ({
  ...item,
  bullets: [...item.bullets],
}));
