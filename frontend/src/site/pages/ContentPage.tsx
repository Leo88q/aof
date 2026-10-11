import { useState } from 'react';
import { ExtraSections, CrossLinks } from './ExtraSections';
import { Link, useParams } from 'react-router-dom';
import { useLocale } from '../../i18n/LocaleProvider';
import { homeFeatures } from '../../i18n/homeFeatures';
import { siteProductTag } from '../../i18n/siteProductTag';
import { commitLabels } from '../../i18n/commitLabels';
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
import { siteRulesCopy } from '../../i18n/siteRulesCopy';
import { siteChanceCopy } from '../../i18n/siteChanceCopy';
import { pageNames, groupKeys, type PageId } from '../../i18n/translations';
import { resourceCatalogCopy } from '../../i18n/resourceCatalogCopy';
import { homeResourceNames, type ResourceId } from '../../i18n/homeDetail';
import { resourceLeads } from '../../i18n/resourceLeads';
import { resourceDetailCopy, resourceRecipes } from '../../i18n/resourceDetailCopy';
import { siteNotFound } from '../../i18n/siteNotFound';
import { pages, resources, resourcesBySlug, mechanicRoutes } from '../content/game';
import type { ResourceCategory } from '../content/schema';
import { sitePanelCopy } from '../../i18n/sitePanelCopy';
import { resourcePlate } from '../../lib/visualAssets';
import { Lamp, Rocker } from '../ui/Controls';
import {
  PageTitle, Section, Button, Counter, ParchmentCard, StatusBadge,
  CommitReveal, PackOpener,
} from '../ui/Components';

export function ContentPage({ id }: { id: string }) {
  const page = pages.find(p => p.id === id);
  if (!page) return <NotFound />;
  const hero = id === 'home';
  const { language, t } = useLocale();
  // Три экрана стенда: галетник выбирает освещённый, остальные уходят в тень.
  const [screen, setScreen] = useState(0);
  const galleryScreens = [
    { src: '/assets/backgrounds/lab.jpg', caption: t('laboratory') },
    { src: '/assets/backgrounds/forge.jpg', caption: t('workshop') },
    { src: '/assets/backgrounds/market.jpg', caption: t('market') },
  ];
  const localized = language !== 'ru';
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
  const mind = id === 'mind' ? siteMind[language] : undefined;
  const farmGuide = id === 'farm' ? siteWorkshop[language].farm : undefined;
  const craftGuide = id === 'craft' ? siteWorkshop[language].craft : undefined;
  const glossary = id === 'glossary' ? siteGlossary[language] : undefined;
  const workshopGroups = farmGuide ? [farmGuide.cultivation, farmGuide.processing] : craftGuide ? [craftGuide.steps] : [];
  const workshopNote = farmGuide?.note ?? craftGuide?.note;
  const pageCopy = intro ?? editorial ?? lore ?? roadmap ?? faq ?? journal ?? chance ?? seasons ?? trust ?? rules ?? tools ?? mine ?? market ?? economy ?? investors ?? guide ?? strategies ?? trade ?? docs ?? recipes ?? mind ?? farmGuide ?? craftGuide ?? glossary;
  const steps = id === 'weather' ? editorialPages[language].weather.steps : intro?.steps;
  const pageTitle = hero ? t('homeTitle') : pageCopy ? pageNames[language][id as PageId] : page.title;
  const pageLead = hero ? t('homeLead') : pageCopy ? pageCopy.lead : page.lead;
  return (
    <>
      <PageTitle eyebrow={hero ? 'NeuroForge — Age of Intelligence' : pageCopy && groupKeys[page.group] ? t(groupKeys[page.group]) : page.group}
        title={pageTitle}
        lead={pageLead}>
        {/* Сетка дорожек и частицы удалены вместе с легаси-слоем:
            фон героя — мягкая засветка прибора, см. site-title::before */}
      </PageTitle>
      {(hero || id === 'start') && (
        <div className="site-hero-actions">
          <Button to="/">{t('launch')}</Button>
          {hero && <Button to="/site/start" variant="ghost">{t('heroGuide')}</Button>}
        </div>
      )}
      {localized && hero && <p className="site-translation-note" lang={language}>{t('translationNotice')}</p>}
      <Section>
        <div className="site-card site-paper" lang={hero || pageCopy ? language : 'ru'}>
          {hero ? <><p>{t('homeIntro')}</p><p>{t('homeNumbers')}</p></> : (pageCopy?.paragraphs ?? page.paragraphs).map(p => <p key={p}>{p}</p>)}
        </div>
      </Section>

      {hero && (
        <>
          <Section title={t('galleryTitle')}>
            <div className="site-scene-bank">
              <Rocker
                legend={sitePanelCopy[language].galleryLegend}
                options={galleryScreens.map(item => item.caption)}
                value={screen}
                onChange={setScreen}
                id="site-gallery-screen"
              />
              <div className="site-scene-gallery">
                {galleryScreens.map((item, index) => (
                  <figure key={item.src} className="site-screen" data-on={index === screen}>
                    <img src={item.src} alt="" loading="lazy" />
                    <figcaption>
                      <Lamp state={index === screen ? 'live' : 'off'} />
                      {item.caption}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          </Section>
          <Section title={t('gameTitle')}>
            <div className="nf-product">
              <div className="nf-product__visual">
                <span className="site-frame"><img src="/assets/brand/game-poster.png" alt="NeuroForge — Age of Intelligence" className="nf-product__poster" /></span>
              </div>
              <div className="nf-product__info">
                <span className="nf-product__tag">{siteProductTag[language]}</span>
                <h3>NeuroForge — Age of Intelligence</h3>
                <p>{t('gameDescription')}</p>
                <ul className="nf-product__features">
                  {homeFeatures[language].map(feature => <li key={feature}><span className="nf-product__dot" />{feature}</li>)}
                </ul>
                <div className="nf-product__cta">
                  <Button to="/">{t('launch')}</Button>
                  <Button to="/site/resources" variant="ghost">{t('resourceLink')}</Button>
                </div>
              </div>
            </div>
          </Section>

          <Section title={t('fourNumbers')}>
            <div className="site-grid site-grid--four">
              <Counter value={20} label={t('energy')} />
              <Counter value={20} label={t('durability')} />
              <Counter value={5} label={t('rarities')} />
              <Counter value={5} label={t('trust')} />
            </div>
          </Section>
          <Section title={commitLabels[language].section}><CommitReveal /></Section>
        </>
      )}

      {id === 'fair' && <Section title={commitLabels[language].section}><CommitReveal /></Section>}
      {id === 'packs' && <Section title={chance!.demoTitle}><PackOpener /></Section>}
      {id === 'lottery' && (
        <>

          <Section title={commitLabels[language].section}><CommitReveal /></Section>
        </>
      )}
      {chance && (
        <Section title={chance.guideTitle}>
          <ol className="site-steps">
            {chance.steps.map((step, index) => (
              <li key={index} className="site-paper [overflow-wrap:anywhere]">
                <span className="site-step-number">{String(index + 1).padStart(2, '0')}</span>
                <p>{step}</p>
              </li>
            ))}
          </ol>
          <p className="site-guide-warn">{chance.note}</p>
        </Section>
      )}

      <div lang={hero || pageCopy ? language : 'ru'}><ExtraSections id={id} /></div>
      {workshopGroups.map(group => (
        <Section key={group.heading} title={group.heading}>
          <ol className="site-steps site-workshop-steps">
            {group.steps.map((step, index) => (
              <li key={step.id} className="site-paper" lang={language}>
                <span className="site-step-number">{String(index + 1).padStart(2, '0')}</span>
                <div><h3>{step.title}</h3><p>{step.text}</p></div>
              </li>
            ))}
          </ol>
        </Section>
      ))}
      {workshopNote && <p className="site-guide-warn site-workshop-note" lang={language}>{workshopNote}</p>}
      {steps && (
        <Section title={steps.heading}>
          <ol className="site-steps">
            {steps.items.map((step, i) => (
              <li key={step.title} className="site-paper" lang={language}>
                <span className="site-step-number">{String(i + 1).padStart(2, '0')}</span>
                <div><h3>{step.title}</h3><p>{step.text}</p></div>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {!hero && <CrossLinks id={id} />}
      {!hero && (
        <Section>
          <div className="site-actions">
            <Button to="/">{t('launch')}</Button>
            <Button to="/site/resources" variant="ghost">{t('resourcesLabel')}</Button>
          </div>
        </Section>
      )}
    </>
  );
}

/** Порядок отделов каталога: от сырья к особым ресурсам. */
const CATALOG_ORDER: ResourceCategory[] = ['base', 'chain', 'material', 'rare', 'consumable', 'token', 'collab', 'social'];

export function ResourcesCatalog() {
  const { language, t } = useLocale();
  const copy = resourceCatalogCopy[language];
  const resourceName = (id: string, fallback: string) => homeResourceNames[language][id as ResourceId] ?? fallback;
  const resourceLead = (id: string, fallback: string) => resourceLeads[language][id as ResourceId] ?? fallback;
  // A search belongs to its language. Switching locale must not leave an
  // old-language query showing a misleading empty catalog for one render.
  const [search, setSearch] = useState({ language, query: '' });
  const query = search.language === language ? search.query : '';
  const [category, setCategory] = useState<'all' | ResourceCategory>('all');
  // В фильтре только те отделы, где что-то лежит: пустой раздел в списке
  // выглядел как поломка поиска.
  const usedCategories = CATALOG_ORDER.filter(key => resources.some(r => r.category === key));
  const list = resources.filter(r =>
    (category === 'all' || r.category === category) &&
    (resourceName(r.id, r.name) + ' ' + resourceLead(r.id, r.lead)).toLocaleLowerCase(language).includes(query.trim().toLocaleLowerCase(language))
  );
  const groups = usedCategories
    .map(key => ({ key, items: list.filter(r => r.category === key) }))
    .filter(group => group.items.length > 0);
  return (
    <div lang={language}>
      <PageTitle eyebrow={t('resourceLink')} title={`${resources.length} ${copy.resources}`} lead={`${usedCategories.length} ${copy.categories}`} />
      <Section>
        {/* Поиск и отдел стоят одной строкой: сначала сужаем ряд, потом читаем. */}
        <div className="site-filters">
          <label>{copy.search}<input type="search" value={query} onChange={e => setSearch({ language, query: e.target.value })} /></label>
          <label>{copy.category}
            <select value={category} onChange={e => setCategory(e.target.value as 'all' | ResourceCategory)}>
              <option value="all">{copy.all}</option>
              {usedCategories.map((k) => <option key={k} value={k}>{copy.labels[k]}</option>)}
            </select>
          </label>
        </div>
        <p role="status">{copy.showing(list.length, resources.length)}</p>
        <p className="site-reading site-catalog-note">{copy.groupNote}</p>

        {groups.map((group) => (
          <section key={group.key} className="site-catalog-group" aria-labelledby={'catalog-' + group.key}>
            {/* Отдел — та же лицевая панель: лампа, название ряда, счётчик. */}
            <h2 className="site-catalog-group__title" id={'catalog-' + group.key}>
              <Lamp state="live" />
              {copy.labels[group.key]}
              <span className="site-catalog-group__count">{group.items.length} / {resources.filter(r => r.category === group.key).length}</span>
            </h2>
            <p className="site-catalog-group__note">{copy.notes[group.key]}</p>
            <div className="site-grid">
              {group.items.map(r => {
                const recipes = resourceRecipes(r.id as ResourceId, language);
                return (
                  <Link className="site-card site-paper site-resource" key={r.id} to={'/site/resources/' + r.slug}>
                    {resourcePlate(r.id) && (
                      <span className="nf-plate site-resource__art" style={{ width: '100%', marginBottom: 12 }}>
                        <img src={resourcePlate(r.id)} alt="" />
                      </span>
                    )}
                    <StatusBadge status={r.status} />
                    <h3>{resourceName(r.id, r.name)}</h3>
                    <p lang={language}>{resourceLead(r.id, r.lead)}</p>
                    <ul className="site-resource__roles">
                      <li>{copy.labels[r.category]}</li>
                      {recipes.produces.length > 0 && <li>{copy.recipeMakes(recipes.produces.length)}</li>}
                      {recipes.uses.length > 0 && <li>{copy.recipeUses(recipes.uses.length)}</li>}
                      {recipes.sealRole === 'input' && <li>{copy.sealSpends}</li>}
                      {recipes.sealRole === 'output' && <li>{copy.sealMints}</li>}
                    </ul>
                    <span className="site-resource__chain">
                      {copy.linkedLabel}: {r.relatedResources.map(id => resourceName(id, id)).join(' · ')}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
        {groups.length === 0 && <p className="site-guide-warn">{copy.found}: 0</p>}
      </Section>
    </div>
  );
}

export function ResourceDetail() {
  const { language } = useLocale();
  const { slug } = useParams();
  const resource = slug ? resourcesBySlug.get(slug) : undefined;
  if (!resource) return <NotFound />;
  const copy = resourceDetailCopy[language];
  const recipes = resourceRecipes(resource.id as ResourceId, language);
  const shown = {
    produces: recipes.sealRole === 'output' ? [...recipes.produces, ...recipes.seal] : recipes.produces,
    uses: recipes.sealRole === 'input' ? [...recipes.uses, ...recipes.seal] : recipes.uses,
  };
  return (
    <div lang={language} className="site-resource-detail">
      <PageTitle eyebrow={resourceCatalogCopy[language].labels[resource.category]}
        title={homeResourceNames[language][resource.id as ResourceId] ?? resource.name}
        lead={resourceLeads[language][resource.id as ResourceId] ?? resource.lead} />
      {resourcePlate(resource.id) && (
        <Section>
          <span className="nf-plate" style={{ width: 'min(100%, 360px)' }}>
            <img src={resourcePlate(resource.id)} alt={homeResourceNames[language][resource.id as ResourceId] ?? resource.name} />
          </span>
        </Section>
      )}
      <Section>
        <StatusBadge status={resource.status} />
        <p className="site-guide-warn">{copy.caution}</p>
        <p>{copy.otherSources}</p>
      </Section>
      <Section>
        <div className="site-grid">
          {(['produces', 'uses'] as const).map(kind => (
            <ParchmentCard key={kind}>
              <h2>{copy[kind]}</h2>
              {shown[kind].length ? <ul>{shown[kind].map(line =>
                <li key={line}><Link to="/site/recipes">{line}</Link></li>)}</ul> : <p>{copy.noRecipe}</p>}
            </ParchmentCard>
          ))}
        </div>
      </Section>
      <Section title={copy.related}>
        <div className="site-actions">
          {resource.relatedMechanics.map(mid => {
            const pageId = mechanicRoutes[mid] ?? mid;
            const target = pages.find(p => p.id === pageId);
            return target ? (
              <Link className="site-chip" key={mid} to={'/site/' + pageId}>{pageNames[language][pageId as PageId]}</Link>
            ) : null;
          })}
        </div>
      </Section>
      <Section><div className="site-actions"><Button to="/site/resources">{copy.catalog}</Button></div></Section>
    </div>
  );
}

export function NotFound() {
  const { language } = useLocale();
  const copy = siteNotFound[language];
  return (
    <div lang={language}>
      <PageTitle eyebrow="404" title={copy.title} lead={copy.lead} />
      <Section>
        <div className="site-actions">
          <Button to="/site/home">{copy.home}</Button>
          <Button to="/site/resources" variant="ghost">{copy.catalog}</Button>
        </div>
      </Section>
    </div>
  );
}
