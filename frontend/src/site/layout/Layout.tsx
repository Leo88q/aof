import { setPageMetadata } from '../../lib/pageMetadata';
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { pages as seoPages, resourcesBySlug as seoResources } from '../content/game';
import { pages } from '../content/pages';
import { ScrollFlask } from '../ui/Components';
import { LanguageSwitcher, useLocale } from '../../i18n/LocaleProvider';
import { groupKeys, pageNames, messages, type PageId } from '../../i18n/translations';
import { introPages, type IntroId } from '../../i18n/siteIntro';
import { editorialPages, type EditorialId } from '../../i18n/siteEditorial';
import { siteLore } from '../../i18n/siteLore';
import { siteRoadmap } from '../../i18n/siteRoadmap';
import { siteFaq } from '../../i18n/siteFaq';
import { siteJournalCopy } from '../../i18n/siteJournalCopy';
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
import { homeResourceNames, type ResourceId } from '../../i18n/homeDetail';
import { resourceLeads } from '../../i18n/resourceLeads';
import { resourceCatalogCopy } from '../../i18n/resourceCatalogCopy';
import { siteRulesCopy } from '../../i18n/siteRulesCopy';
import { siteChanceCopy } from '../../i18n/siteChanceCopy';
import { recordSiteBadge, recordSiteVisit, refreshSiteJournal, SITE_JOURNAL_KEY } from '../siteJournal';

// Only these routes have complete page bodies and special sections translated.
// A Russian-only article must never inherit a foreign-language document tag.
const localizedRoutes = new Set<string>(['home', 'start', 'world', 'energy', 'manifesto', 'weather', 'lore', 'roadmap', 'faq', 'quests', 'packs', 'lottery', 'seasons', 'trust', 'rules', 'tools', 'mine', 'market', 'economy', 'investors', 'guide', 'strategies', 'trade', 'docs', 'recipes', 'potato', 'farm', 'craft', 'glossary', 'resources']);
function markJournalRoute(pathname: string) {
  const parts = pathname.split('/').filter(Boolean);
  const id = parts[1] || 'home';
  recordSiteVisit(id);
  if (id === 'roadmap') recordSiteBadge('chronicler');
  if (id === 'resources' && parts[2] && seoResources.has(parts[2])) recordSiteBadge('resource');
}
const navGroups = [...new Set(pages.map(p => p.group))].map(title => ({
  title,
  items: pages.filter(p => p.group === title).map(p => ({ path: p.id, label: p.title })),
}));

export function SiteLayout() {
  const location = useLocation();
  const [mobile, setMobile] = useState(false);
  const { language, t } = useLocale();
  // Переход по ссылке с длинной страницы оставлял окно на прежнем месте: новая
  // страница открывалась своей серединой или подвалом. Теперь маршрут меняется —
  // окно возвращается наверх, а фокус уходит в содержимое (для чтения с экрана).
  useEffect(() => {
    if (window.location.hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.getElementById('site-main')?.focus?.({ preventScroll: true });
  }, [location.pathname]);
  useEffect(() => {
    const parts = location.pathname.split('/').filter(Boolean);
    const id = parts[1] || 'home';
    const res = parts[0] === 'site' && parts[1] === 'resources' ? seoResources.get(parts[2]) : undefined;
    const page = seoPages.find((p) => p.id === id);
    const localizedHome = id === 'home';
    const intro = id === 'start' || id === 'world' || id === 'energy' ? introPages[language][id as IntroId] : undefined;
    const editorial = id === 'manifesto' || id === 'weather' ? editorialPages[language][id as EditorialId] : undefined;
    const lore = id === 'lore' ? siteLore[language] : undefined;
    const roadmap = id === 'roadmap' ? siteRoadmap[language] : undefined;
    const faq = id === 'faq' ? siteFaq[language] : undefined;
    const journal = id === 'quests' ? siteJournalCopy[language] : undefined;
    const chance = id === 'packs' || id === 'lottery' ? siteChanceCopy[language][id] : undefined;
    const seasons = id === 'seasons' ? siteSeasons[language] : undefined;
    const trust = id === 'trust' ? siteTrust[language] : undefined;
    const rules = id === 'rules' ? siteRulesCopy[language] : undefined;
    const tools = id === 'tools' ? siteTools[language] : undefined;
    const mine = id === 'mine' ? siteMine[language] : undefined;
    const market = id === 'market' ? siteMarket[language] : undefined;
    const economy = id === 'economy' ? siteEconomy[language] : undefined;
    const investors = id === 'investors' ? siteInvestors[language] : undefined;
    const guide = id === 'guide' ? siteGuide[language] : undefined;
    const strategies = id === 'strategies' ? siteStrategies[language] : undefined;
    const trade = id === 'trade' ? siteTrade[language] : undefined;
    const docs = id === 'docs' ? siteDocs[language] : undefined;
    const recipes = id === 'recipes' ? siteRecipes[language] : undefined;
    const mind = id === 'potato' ? siteMind[language] : undefined;
    const farmGuide = id === 'farm' ? siteWorkshop[language].farm : undefined;
    const craftGuide = id === 'craft' ? siteWorkshop[language].craft : undefined;
    const glossary = id === 'glossary' ? siteGlossary[language] : undefined;
    const localizedCopy = intro ?? editorial ?? lore ?? roadmap ?? faq ?? journal ?? chance ?? seasons ?? trust ?? rules ?? tools ?? mine ?? market ?? economy ?? investors ?? guide ?? strategies ?? trade ?? docs ?? recipes ?? mind ?? farmGuide ?? craftGuide ?? glossary;
    const title = localizedHome ? messages[language].homeTitle + ' · NeuroForge'
      : res ? homeResourceNames[language][res.id as ResourceId] + ' · NeuroForge'
      : localizedCopy || id === 'resources' ? pageNames[language][id as PageId] + ' · NeuroForge'
      : page ? page.title + ' · NeuroForge' : 'NeuroForge';
    const desc = localizedHome ? messages[language].homeLead
      : res ? resourceLeads[language][res.id as ResourceId]
      : localizedCopy ? localizedCopy.lead
      : id === 'resources' ? `${seoResources.size} ${resourceCatalogCopy[language].resources}; ${resourceCatalogCopy[language].categories}`
      : page ? page.lead
      : messages[language].gameDescription;
    setPageMetadata(title, desc, localizedHome || localizedCopy || res || id === 'resources' ? language : 'ru');
  }, [location.pathname, language]);
  // Follow the reader across routes. The journal is optional, local-only and
  // never starts tracking until functional storage consent has been granted.
  useEffect(() => {
    const onBadge = (event: Event) => recordSiteBadge((event as CustomEvent).detail);
    const onPrivacy = () => { refreshSiteJournal(); markJournalRoute(window.location.pathname); };
    const onStorage = (event: StorageEvent) => { if (event.key === SITE_JOURNAL_KEY) refreshSiteJournal(); };
    window.addEventListener('aof:badge', onBadge);
    window.addEventListener('nf:privacy-change', onPrivacy);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('aof:badge', onBadge);
      window.removeEventListener('nf:privacy-change', onPrivacy);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  useEffect(() => { markJournalRoute(location.pathname); }, [location.pathname]);
  useEffect(() => { setMobile(false); }, [location.pathname]);
  const label = (id: string, fallback: string) => pageNames[language][id as PageId] ?? fallback;
  const group = (name: string) => groupKeys[name] ? t(groupKeys[name]) : name;

  return (
    <div className="aof-ui aof-site" lang={language}>
      <a className="site-skip" href="#site-main">{t('skip')}</a>
      <header className="site-header">
        <div className="site-header-inner">
          <Link className="site-logo" to="/site/home">
            {/* Знак — манометр лаборатории: корпус, шкала и стрелка. Прибор читается
                как оборудование и не повторяет нейро-декор из ранних макетов. */}
            <svg width="30" height="30" viewBox="0 0 32 32" role="img" aria-label="NeuroForge">
              <circle cx="16" cy="16" r="12" fill="none" stroke="var(--sb-cyan)" strokeWidth="2" />
              <circle cx="16" cy="16" r="8.5" fill="none" stroke="var(--sb-line)" strokeWidth="1" />
              <path d="M16 4.5v3M16 24.5v3M4.5 16h3M24.5 16h3" stroke="var(--sb-cyan-2)" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M16 16l6.2-4.4" stroke="var(--sb-gold)" strokeWidth="2" strokeLinecap="round" />
              <circle cx="16" cy="16" r="1.8" fill="var(--sb-cyan-2)" />
            </svg>
            <span>NeuroForge<span className="site-logo-sub">Age of Intelligence</span></span>
          </Link>
          <nav className="site-desktop-nav" aria-label={t('nav')}>
            {navGroups.map(g => (
              <details key={g.title}>
                <summary>{group(g.title)}</summary>
                <div className="site-nav-panel">
                  {g.items.map(it => (
                    <NavLink key={it.path} to={'/site/' + it.path}>{label(it.path, it.label)}</NavLink>
                  ))}
                </div>
              </details>
            ))}
          </nav>
          <div className="site-header-tools">
            <Link className="site-play-link" to="/" aria-label={t('launch')}><span className="site-play-link__full">{t('launch')}</span><span className="site-play-link__short">{t('playShort')}</span> <span aria-hidden="true">↗</span></Link>
            <LanguageSwitcher compact />
            <button className="site-small-button site-menu-toggle" type="button" aria-controls="site-mobile-navigation" aria-expanded={mobile} onClick={() => setMobile(!mobile)}>{t('menu')}</button>
          </div>
        </div>
        {mobile && (
          <div className="site-mobile-menu" id="site-mobile-navigation">
            {navGroups.map(g => (
              <section key={g.title}>
                <h2>{group(g.title)}</h2>
                <ul>
                  {g.items.map(it => (
                    <li key={it.path}>
                      <NavLink to={'/site/' + it.path} onClick={() => setMobile(false)}>{label(it.path, it.label)}</NavLink>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </header>
      <main id="site-main" className="site-main" lang={language} tabIndex={-1}>
        {language !== 'ru' && !localizedRoutes.has(location.pathname.split('/')[2]) &&
          seoPages.some(p => p.id === location.pathname.split('/')[2]) &&
          <p className="site-translation-note" lang={language}>{t('translationNotice')}</p>}
        <Outlet context={{ language }} />
      </main>
      <footer className="site-footer">
        <div className="site-footer-intro">
          <h2>{t('footerTitle')}</h2>
          <p>{t('footerLead')}</p>
        </div>
        <div className="site-footer-grid">
          {navGroups.map(g => (
            <nav key={g.title} aria-label={group(g.title)}>
              <h3>{group(g.title)}</h3>
              <ul>{g.items.map(it => <li key={it.path}><Link to={'/site/' + it.path}>{label(it.path, it.label)}</Link></li>)}</ul>
            </nav>
          ))}
        </div>
        <div className="site-footer-bottom">
          <span>NeuroForge · {new Date().getFullYear()}</span>
          <Link to="/site/rules">{t('rules')}</Link>
        </div>
      </footer>
    </div>
  );
}
