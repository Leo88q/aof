import type { SitePage } from './schema';
import { pageNames, messages, type PageId, type UIKey } from '../../i18n/translations';
import { siteJournalCopy } from '../../i18n/siteJournalCopy';
import { siteChanceCopy } from '../../i18n/siteChanceCopy';
import { siteSeasons } from '../../i18n/siteSeasons';
import { siteTrust } from '../../i18n/siteTrust';
import { siteTools } from '../../i18n/siteTools';
import { siteMine } from '../../i18n/siteMine';
import { siteMarket } from '../../i18n/siteMarket';
import { siteEconomy } from '../../i18n/siteEconomy';
import { siteInvestors } from '../../i18n/siteInvestors';
import { siteGuide } from '../../i18n/siteGuide';
import { siteStrategies } from '../../i18n/siteStrategies';
import { siteTrade } from '../../i18n/siteTrade';
import { siteDocs } from '../../i18n/siteDocs';
import { siteRecipes } from '../../i18n/siteRecipes';
import { siteMind } from '../../i18n/siteMind';
import { siteWorkshop } from '../../i18n/siteWorkshop';
import { siteGlossary } from '../../i18n/siteGlossary';
import { siteRulesCopy } from '../../i18n/siteRulesCopy';
import { introPages } from '../../i18n/siteIntro';
import { editorialPages } from '../../i18n/siteEditorial';
import { siteLore } from '../../i18n/siteLore';
import { siteRoadmap } from '../../i18n/siteRoadmap';
import { siteFaq } from '../../i18n/siteFaq';
import { resourceCatalogCopy } from '../../i18n/resourceCatalogCopy';

type Body = { lead: string; paragraphs: readonly string[] };

/** Stable routes and navigation order. The Russian metadata is derived from
 * the same seven-language catalogs as the visible pages, not a second article. */
const bodies = {
  home: { lead: messages.ru.homeLead, paragraphs: [messages.ru.homeIntro, messages.ru.homeNumbers] },
  manifesto: editorialPages.ru.manifesto,
  start: introPages.ru.start,
  world: introPages.ru.world,
  energy: introPages.ru.energy,
  weather: editorialPages.ru.weather,
  farm: siteWorkshop.ru.farm,
  craft: siteWorkshop.ru.craft,
  tools: siteTools.ru,
  mine: siteMine.ru,
  packs: siteChanceCopy.ru.packs,
  lottery: siteChanceCopy.ru.lottery,
  economy: siteEconomy.ru,
  market: siteMarket.ru,
  seasons: siteSeasons.ru,
  trust: siteTrust.ru,
  resources: { lead: resourceCatalogCopy.ru.categories, paragraphs: [resourceCatalogCopy.ru.categories] },
  guide: siteGuide.ru,
  strategies: siteStrategies.ru,
  quests: siteJournalCopy.ru,
  recipes: siteRecipes.ru,
  trade: siteTrade.ru,
  investors: siteInvestors.ru,
  mind: siteMind.ru,
  lore: siteLore.ru,
  glossary: siteGlossary.ru,
  docs: siteDocs.ru,
  faq: siteFaq.ru,
  roadmap: siteRoadmap.ru,
  rules: siteRulesCopy.ru,
} satisfies Record<PageId, Body>;

const routes: readonly (readonly [PageId, UIKey])[] = [
  ['home', 'playGroup'], ['manifesto', 'playGroup'], ['start', 'playGroup'],
  ['world', 'playGroup'], ['energy', 'playGroup'], ['weather', 'playGroup'],
  ['farm', 'craftGroup'], ['craft', 'craftGroup'], ['tools', 'craftGroup'], ['mine', 'craftGroup'],
  ['packs', 'chanceGroup'], ['lottery', 'chanceGroup'],
  ['economy', 'economyGroup'], ['market', 'economyGroup'],
  ['seasons', 'progressGroup'], ['trust', 'progressGroup'],
  ['resources', 'learnGroup'], ['guide', 'playGroup'], ['strategies', 'playGroup'], ['quests', 'playGroup'],
  ['recipes', 'craftGroup'], ['trade', 'economyGroup'], ['investors', 'economyGroup'],
  ['mind', 'economyGroup'], ['lore', 'learnGroup'], ['glossary', 'learnGroup'],
  ['docs', 'learnGroup'], ['faq', 'learnGroup'], ['roadmap', 'learnGroup'], ['rules', 'learnGroup'],
];

export const pages: SitePage[] = routes.map(([id, group]) => ({
  id,
  title: pageNames.ru[id],
  group: messages.ru[group],
  lead: bodies[id].lead,
  paragraphs: [...bodies[id].paragraphs],
}));
