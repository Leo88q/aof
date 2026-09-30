import { readSiteJournal, resetSiteJournal, siteBadgeIds } from '../siteJournal';
import { siteJournalCopy } from '../../i18n/siteJournalCopy';
import { siteSeasons } from '../../i18n/siteSeasons';
import { siteTrust } from '../../i18n/siteTrust';
import { siteTools } from '../../i18n/siteTools';
import { siteMine } from '../../i18n/siteMine';
import { siteMarket, marketVenueIds, type MarketVenueId } from '../../i18n/siteMarket';
import { siteEconomy, economyCycleIds } from '../../i18n/siteEconomy';
import { siteInvestors } from '../../i18n/siteInvestors';
import { siteGuide } from '../../i18n/siteGuide';
import { siteStrategies } from '../../i18n/siteStrategies';
import { siteTrade } from '../../i18n/siteTrade';
import { siteDocs, instructionGroups } from '../../i18n/siteDocs';
import { siteRecipes } from '../../i18n/siteRecipes';
import { siteMind } from '../../i18n/siteMind';
import { siteGlossary } from '../../i18n/siteGlossary';
import { recipeWorkshopCopy } from '../../i18n/recipeWorkshopCopy';
import { WORKSHOP_RECIPES } from '../../lib/workshopRecipes';
import { tradeNavigationCopy } from '../../i18n/tradeNavigationCopy';
import { toolName, toolsCopy } from '../../i18n/toolsCopy';
import {
  toolsCatalogCopy, toolProfiles, TOOL_RESOURCE, TOOL_FROM_PACK, TOOL_SHIFT_HOURS, TOOL_YIELD_MULTIPLIER,
  type ToolTypeId,
} from '../../i18n/siteToolsCatalog';
import { siteRulesCopy } from '../../i18n/siteRulesCopy';
import { useLocale } from '../../i18n/LocaleProvider';
import { homeDetail, homeResourceNames, type ResourceId } from '../../i18n/homeDetail';
import { furtherLabels } from '../../i18n/siteIntro';
import { editorialPages } from '../../i18n/siteEditorial';
import { siteLore } from '../../i18n/siteLore';
import { siteRoadmap } from '../../i18n/siteRoadmap';
import { siteFaq, type FaqTopic } from '../../i18n/siteFaq';
import { pageNames, type Language, type PageId } from '../../i18n/translations';
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Accordion, Button, Section } from '../ui/Components';
import {
  resourcesById, resources,
} from '../content/game';
import {
  resourceIcon, resourcePlate, resourceVisual, toolPlate, TOOL_NFTS, TOOL_RARITIES, UI_ICONS,
} from '../../lib/visualAssets';

/**
 * Подпись площадки в списке. Рынок событий включён, поэтому его название берётся
 * из живого ключа `hotOpen` («рынок открыт»), а не из отдельного текста
 * «недоступно»: такой текст существовал, пока механика была закрыта в коде.
 */
function venueLabel(names: (typeof tradeNavigationCopy)[Language]['market'], venue: MarketVenueId): string {
  return venue === 'hotMarket' ? names.hotOpen : names[venue];
}

const marketVenueIcons: Record<MarketVenueId, string> = {
  listing: UI_ICONS.marketListing, orderbook: UI_ICONS.marketOrderbook,
  auction: UI_ICONS.marketAuction, offer: UI_ICONS.marketOffer,
  rental: UI_ICONS.marketRental, hotMarket: UI_ICONS.marketHot,
};

/** Картинка ресурса/предмета в квадратной плашке (`.nf-plate`, object-fit: contain). */
function SitePlate({ src, alt = '', size, className = '' }: { src?: string; alt?: string; size?: number | string; className?: string }) {
  if (!src) return null;
  const isIcon = src.startsWith('/assets/icons/');
  const style = size === undefined ? undefined : { width: size, height: typeof size === 'number' ? size : undefined };
  return (
    <span className={'nf-plate site-plate' + (isIcon ? ' nf-plate--icon site-plate--icon' : '') + (className ? ' ' + className : '')} style={style}>
      <img src={src} alt={alt} loading="lazy" decoding="async" draggable={false} />
    </span>
  );
}

// The eight entries below share their amounts with the in-game workshop.
// These names are catalog labels, not substitutes for verified wallet balances.
const recipeResourceIds: Record<string, ResourceId> = {
  BLUE_CORE: 'blueCore', RED_CORE: 'redCore', CLEAR_QUARTZ: 'clearQuartz',
  QUANTUM_BIT: 'quantumBit', NEURAL_CHIP: 'neuralChip', PHOTON_BIT: 'photonBit',
  DATA: 'data', SILICON: 'silicon', CIRCUIT: 'circuit', NEURON: 'neuron',
  ROSE_QUARTZ: 'roseQuartz', PURPLE_CORE: 'purpleCore', BIO_CHIP: 'bioChip',
  CRYO_FLUID: 'cryoFluid', VOLT_FLUID: 'voltFluid', BIO_FLUID: 'bioFluid',
  NANO_FLUID: 'nanoFluid', QUANTUM_FLUID: 'quantumFluid',
};

const PARTICLES: Record<string, number> = { drought: 0, sun: 0, rain: 32, festival: 0 };

function WeatherDemo() {
  const { language } = useLocale();
  const text = editorialPages[language].weather;
  const [state, setState] = useState<keyof typeof text.states>('sun');
  const names = text.states;
  return (
    <div>
      <fieldset className="site-options">
        <legend>{text.demoLegend}</legend>
        {Object.entries(names).map(([sid, name]) => (
          <label key={sid}>
            <input type="radio" name="site-weather" checked={state === sid} onChange={() => setState(sid as keyof typeof names)} />
            {name}
          </label>
        ))}
      </fieldset>
      <div className="site-weather" aria-hidden="true">
        <svg viewBox="0 0 700 230" className="site-weather-scene">
          <path d="M0 175Q180 80 360 170T700 130V230H0Z" fill="var(--sb-green)" />
          <path d="M220 120h150v90H220z" fill="var(--sb-body)" />
          <path d="M200 125l95-90 95 90z" fill="var(--sb-red)" />
          <path d="M280 145h32v65h-32z" fill="var(--sb-body-2)" />
          <path d="M335 145h22v26h-22z" fill="var(--sb-gold)" />
        </svg>
        {Object.keys(names).map((sid) => (
          <div key={sid} className={'site-weather-layer site-weather--' + sid} style={{ opacity: state === sid ? 1 : 0 }}>
            {/* Частицы рисуются для каждого состояния с осадками: раньше они были
                только у «скачка», и переключение на грозу или снег давало пустую сцену. */}
            {PARTICLES[sid] > 0 &&
              Array.from({ length: PARTICLES[sid] }, (_, i) => (
                <i key={i} style={{ left: ((i * 37) % 100) + '%', top: (-(i * 17) % 100) + '%', animationDelay: -(i * 0.19) + 's', animationDuration: 1 + (i % 2) * 0.3 + 's' }} />
              ))}
          </div>
        ))}
      </div>
      <p role="status">{text.statePrefix}{names[state]}{text.stateSuffix}</p>
    </div>
  );
}

function SeasonWheelDemo() {
  const { language } = useLocale();
  const copy = siteSeasons[language];
  const [phase, setPhase] = useState(0);
  return (
    <div className="site-season min-w-0 [overflow-wrap:anywhere]">
      <p>{copy.wheelHint}</p>
      <button type="button" className="site-season-button" onClick={() => setPhase((s) => (s + 1) % copy.phases.length)}
        aria-label={`${copy.wheelLabel}: ${copy.phases[phase]}. ${copy.wheelAction}`}>
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r="43" fill="var(--sb-body)" stroke="var(--sb-cyan)" strokeWidth="5" />
          {[0, 1, 2, 3].map((i) => (
            <path key={i} d="M50 12v25" transform={'rotate(' + i * 90 + ' 50 50)'} stroke="var(--sb-text)" strokeWidth="2" />
          ))}
          <g style={{ transform: 'rotate(' + phase * 90 + 'deg)', transformOrigin: '50px 50px' }}>
            <path d="M50 18l-8 30h16z" fill="var(--sb-gold)" />
          </g>
        </svg>
      </button>
      <p role="status">{copy.wheelStatus(copy.phases[phase])}</p>
    </div>
  );
}

function ChainDiagram() {
  const { language } = useLocale();
  const text = homeDetail[language];
  const resourceName = homeResourceNames[language];
  const steps = [
    { id: 'neuron' },
    { id: 'synapse' },
    { id: 'signal' },
    { id: 'model' },
  ];
  return (
    <figure className="site-diagram site-paper">
      <ol className="site-chain" aria-label={['neuron', 'synapse', 'signal', 'model'].map(id => resourceName[id as ResourceId]).join(', ')}>
        {steps.map((st, i) => (
          <li key={st.id} className="site-chain__step">
            <Link to={'/site/resources/' + (resourcesById.get(st.id)?.slug ?? st.id)} className="site-chain__node">
              <SitePlate src={resourceIcon(st.id)} alt="" size={72} />
              <span>{resourceName[st.id as ResourceId]}</span>
            </Link>
            {i < steps.length - 1 && <span className="site-chain__arrow" aria-hidden="true">→</span>}
          </li>
        ))}
      </ol>
      <figcaption>{text.chainCaption}</figcaption>
    </figure>
  );
}

function JournalBoard() {
  const { language } = useLocale();
  const copy = siteJournalCopy[language];
  const [journal, setJournal] = useState(readSiteJournal);
  useEffect(() => {
    const refresh = () => setJournal(readSiteJournal());
    window.addEventListener('aof:journal-change', refresh);
    refresh(); // Read again in case the first route visit preceded this subscription.
    return () => window.removeEventListener('aof:journal-change', refresh);
  }, []);
  const reset = () => { resetSiteJournal(); setJournal(readSiteJournal()); };
  return (
    <div className="site-card site-paper min-w-0 [overflow-wrap:anywhere]">
      <h3>{copy.marks} · {journal ? `${journal.badges.length}/${siteBadgeIds.length}` : '— / —'}</h3>
      {!journal ? <p role="status">{copy.consent}</p> : <>
        <p>{copy.visits(journal.visits.length)} {copy.note}</p>
        <ul className="site-badge-list">
          {siteBadgeIds.map(id => (
            <li key={id} data-earned={journal.badges.includes(id)}>
              <span aria-hidden="true">{journal.badges.includes(id) ? '✓' : '○'}</span>
              <div><strong>{copy.badges[id].name}</strong><p>{copy.badges[id].description}</p></div>
            </li>
          ))}
        </ul>
        <button type="button" className="site-small-button" onClick={reset}>{copy.reset}</button>
      </>}
    </div>
  );
}

/** Галерея 25 исполнений: галетник выбирает редкость, «все» показывает ряд целиком. */
function ToolGallery({ language, intro, notice, filterLabel, allLabel, showing }: {
  language: Language;
  intro: string;
  notice: string;
  filterLabel: string;
  allLabel: string;
  showing: (shown: number, total: number) => string;
}) {
  const rarityLabels = toolsCopy[language].collectionPage.rarities;
  const [rarity, setRarity] = useState<'all' | (typeof TOOL_RARITIES)[number]>('all');
  const types = TOOL_NFTS.map((tool) => tool.id as ToolTypeId);
  const visible = rarity === 'all' ? TOOL_RARITIES : [rarity];
  return (
    <>
      <p className="site-reading">{intro}</p>
      <div className="site-filters">
        <label>
          {filterLabel}
          <select value={rarity} onChange={(event) => setRarity(event.target.value as typeof rarity)}>
            <option value="all">{allLabel}</option>
            {TOOL_RARITIES.map((key, index) => <option key={key} value={key}>{rarityLabels[index]}</option>)}
          </select>
        </label>
      </div>
      <p role="status">{showing(visible.length * types.length, TOOL_RARITIES.length * types.length)}</p>
      <div className="site-tool-matrix">
        {types.map((type) => (
          <article key={type} className="site-card site-paper site-nft">
            <h3>{toolName(language, type)}</h3>
            <ul className="site-nft__rarities" data-compact={rarity === 'all'}>
              {visible.map((key) => {
                const index = TOOL_RARITIES.indexOf(key);
                return (
                  <li key={key}>
                    <SitePlate src={toolPlate(type, key)} alt="" size="100%" />
                    <small>{rarityLabels[index]}</small>
                  </li>
                );
              })}
            </ul>
          </article>
        ))}
      </div>
      <p className="site-guide-warn">{notice}</p>
    </>
  );
}

export function ExtraSections({ id }: { id: string }) {
  const { language } = useLocale();
  const home = homeDetail[language];
  const resourceName = (id: string, fallback: string) => homeResourceNames[language][id as ResourceId] ?? fallback;
  const [faqQuery, setFaqQuery] = useState('');
  const [faqTag, setFaqTag] = useState<FaqTopic | 'all'>('all');
  const [glossQuery, setGlossQuery] = useState('');
  const faq = siteFaq[language];
  // A search entered in one language should not hide all questions after switching languages.
  useEffect(() => { setFaqQuery(''); setFaqTag('all'); setGlossQuery(''); }, [language]);
  const normalizedQuery = faqQuery.trim().toLocaleLowerCase(language);
  const faqFiltered = faq.items.filter(f =>
    (faqTag === 'all' || f.topic === faqTag) &&
    (f.q + ' ' + f.a).toLocaleLowerCase(language).includes(normalizedQuery));
  const gloss = siteGlossary[language];
  const normalizedGloss = glossQuery.trim().toLocaleLowerCase(language);
  const glossFiltered = gloss.entries.filter((g, index) =>
    (g.term + ' ' + g.definition + ' ' + siteGlossary.ru.entries[index].term + ' ' + siteGlossary.en.entries[index].term)
      .toLocaleLowerCase(language).includes(normalizedGloss));

  if (id === 'recipes') {
    const copy = siteRecipes[language];
    const workshop = recipeWorkshopCopy[language];
    const names = homeResourceNames[language];
    return (
      <Section title={copy.heading}>
        {(['gems', 'flasks'] as const).map((category) => (
          <div key={category} className="site-recipe-group">
            <h3>{workshop[category]}</h3>
            <div className="site-grid site-recipe-grid">
              {WORKSHOP_RECIPES.filter(recipe => recipe.category === category).map((recipe) => (
                <article key={recipe.id} className="site-card site-paper site-recipe">
                  <span className="site-badge">{copy.sourceLabel}</span>
                  <h4>{names[recipeResourceIds[recipe.output.key]]}</h4>
                  <p className="site-recipe-meta">{copy.inputLabel}</p>
                  <ul className="site-recipe-io">
                    {recipe.inputs.map(({ key, amount }) => {
                      const id = recipeResourceIds[key];
                      return <li key={key} className="site-recipe-in">
                        <SitePlate src={resourceIcon(id)} size={40} className="site-io-icon" />
                        <span>{names[id]} ×{amount}</span>
                      </li>;
                    })}
                  </ul>
                  <p className="site-recipe-arrow" aria-hidden="true">↓</p>
                  <p className="site-recipe-meta">{copy.outputLabel}</p>
                  <ul className="site-recipe-io">
                    <li className="site-recipe-out">
                      <SitePlate src={resourceIcon(recipeResourceIds[recipe.output.key])} size={40} className="site-io-icon" />
                      <span>{names[recipeResourceIds[recipe.output.key]]} ×{recipe.output.amount}</span>
                    </li>
                  </ul>
                </article>
              ))}
            </div>
          </div>
        ))}
        <p className="site-guide-warn">{copy.note}</p>
      </Section>
    );
  }

  if (id === 'potato') {
    const copy = siteMind[language];
    return (
      <>
        <Section title={copy.originHeading}>
          <div className="site-media-row site-mind-origin">
            <SitePlate src={resourcePlate('mind')} alt="MIND" size="min(100%, 220px)" className="site-media-row__art" />
            <div>{copy.origin.map((paragraph, index) => <p className="site-reading" key={index}>{paragraph}</p>)}</div>
          </div>
        </Section>
        <Section title={copy.checksHeading}>
          <div className="site-grid site-mind-grid">
            {copy.checks.map((check) => (
              <article key={check.id} className="site-card site-paper">
                <h3>{check.title}</h3>
                <p>{check.body}</p>
              </article>
            ))}
          </div>
        </Section>
        <Section title={copy.voicesHeading}>
          <p className="site-guide-warn">{copy.voicesNotice}</p>
          <div className="site-stories site-mind-stories">
            {copy.voices.map((voice) => (
              <blockquote key={voice.id} className="site-story">
                <p>{voice.quote}</p>
                <footer><strong>{voice.character}</strong><span>{voice.context}</span></footer>
              </blockquote>
            ))}
          </div>
        </Section>
        <Section title={copy.safetyHeading}>
          <div className="site-grid site-mind-grid">
            {copy.safety.map((item) => (
              <article key={item.id} className="site-card site-paper">
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
          <p className="site-guide-warn">{copy.note}</p>
        </Section>
      </>
    );
  }

  if (id === 'guide') {
    const copy = siteGuide[language];
    return (
      <Section title={copy.heading}>
        <ol className="site-guide">
          {copy.steps.map((shift, index) => (
            <li key={shift.id} className="site-paper site-guide-step">
              <span className="site-step-number">{String(index + 1).padStart(2, '0')}</span>
              <div>
                <h3>{shift.title}</h3>
                <p>{shift.action}</p>
                <p className="site-guide-warn">{shift.caution}</p>
                <blockquote className="site-narrative">{shift.image}</blockquote>
              </div>
            </li>
          ))}
        </ol>
        <p className="site-guide-warn">{copy.note}</p>
      </Section>
    );
  }

  if (id === 'strategies') {
    const copy = siteStrategies[language];
    return (
      <>
        <Section title={copy.heading}>
          <div className="site-grid site-strategy-grid">
            {copy.paths.map((path) => (
              <article key={path.id} className="site-card site-paper">
                <h3>{path.title}</h3>
                <p className="site-guide-meta">{path.style}</p>
                <p>{path.description}</p>
                <ul>{path.tips.map((tip, index) => <li key={index}>{tip}</li>)}</ul>
              </article>
            ))}
          </div>
        </Section>
        <Section title={copy.voicesHeading}>
          <p className="site-guide-warn">{copy.voicesNotice}</p>
          <div className="site-stories site-strategy-stories">
            {copy.stories.map((story) => (
              <blockquote key={story.id} className="site-story">
                <p>{story.quote}</p>
                <footer><strong>{story.character}</strong><span>{story.context}</span></footer>
              </blockquote>
            ))}
          </div>
        </Section>
      </>
    );
  }

  if (id === 'trade') {
    const copy = siteTrade[language];
    const venues = siteMarket[language];
    const names = tradeNavigationCopy[language].market;
    return (
      <>
        <Section title={copy.heading}>
          <div className="site-grid site-trade-grid">
            {marketVenueIds.map((venue) => (
              <article key={venue} className="site-card site-paper">
                <SitePlate src={marketVenueIcons[venue]} alt="" size={44} />
                <h3>{venueLabel(names, venue)}</h3>
                <p>{venues.venues[venue]}</p>
              </article>
            ))}
          </div>
        </Section>
        <Section title={copy.checksHeading}>
          <ol className="site-guide-warn site-guide-warn--numbered">
            {copy.checks.map((check, index) => <li key={index}>{check}</li>)}
          </ol>
          <p className="site-guide-warn">{copy.note}</p>
        </Section>
      </>
    );
  }

  if (id === 'investors') {
    const copy = siteInvestors[language];
    const economy = siteEconomy[language];
    return (
      <>
        <Section title={copy.cyclesHeading}>
          <div className="site-grid">
            {economyCycleIds.map((id) => {
              const cycle = economy.cycles[id];
              return (
                <article key={id} className="site-card site-paper">
                  <h3>{cycle.title}</h3>
                  <ol>{cycle.steps.map((step, index) => <li key={index}>{step}</li>)}</ol>
                </article>
              );
            })}
          </div>
        </Section>
        <Section title={copy.flowsHeading}>
          <div className="site-grid">
            <article className="site-card site-paper">
              <h3>{economy.incoming}</h3>
              <ul>{economy.incomingItems.map((item, index) => <li key={index}>{item}</li>)}</ul>
            </article>
            <article className="site-card site-paper">
              <h3>{economy.outgoing}</h3>
              <ul>{economy.outgoingItems.map((item, index) => <li key={index}>{item}</li>)}</ul>
            </article>
          </div>
        </Section>
        <Section title={copy.questionsHeading}>
          <ol className="site-guide-warn site-guide-warn--numbered">
            {copy.questions.map((question, index) => <li key={index}>{question}</li>)}
          </ol>
          <p className="site-guide-warn">{copy.note}</p>
        </Section>
      </>
    );
  }

  if (id === 'manifesto') {
    const copy = editorialPages[language].manifesto;
    return (
      <Section title={copy.heading}>
        <div className="site-grid">
          {copy.principles.map((p) => (
            <article key={p.title} className="site-card site-paper">
              <h3>{p.title}</h3>
              <p>{p.text}</p>
            </article>
          ))}
        </div>
        <blockquote className="site-narrative">{copy.closing}</blockquote>
      </Section>
    );
  }

  if (id === 'rules') {
    const copy = siteRulesCopy[language];
    return (
      <Section title={copy.heading}>
        <Accordion>
          {copy.items.map((rule) => (
            <details key={rule.id}>
              <summary>{rule.title}</summary>
              <div>{rule.paragraphs.map((p, index) => <p key={index}>{p}</p>)}</div>
            </details>
          ))}
        </Accordion>
        <p className="site-guide-warn">{copy.note}</p>
      </Section>
    );
  }

  if (id === 'lore') {
    const copy = siteLore[language];
    return (
      <Section title={copy.heading}>
        <div className="site-timeline" lang={language}>
          {copy.chapters.map((ch) => (
            <article key={ch.id} className="site-paper [overflow-wrap:anywhere]">
              <p className="site-eyebrow">{ch.era}</p>
              <h3>{ch.title}</h3>
              {ch.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
            </article>
          ))}
        </div>
      </Section>
    );
  }

  if (id === 'roadmap') {
    const copy = siteRoadmap[language];
    return (
      <Section title={copy.heading}>
        <blockquote className="site-narrative" lang={language}>{copy.note}</blockquote>
        <div className="site-grid" lang={language}>
          {copy.items.map((it) => (
            <article key={it.id} className="site-card site-paper [overflow-wrap:anywhere]">
              <span className="site-badge">{copy.eraLabels[it.era]}</span>
              <h3>{it.title}</h3>
              <ul>{it.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>
            </article>
          ))}
        </div>
      </Section>
    );
  }

  if (id === 'faq') {
    return (
      <Section title={`${faq.heading} · ${faq.items.length}`}>
        <div className="site-filters min-w-0">
          <label>{faq.search}<input type="search" value={faqQuery} onChange={(e) => setFaqQuery(e.target.value)} placeholder={faq.placeholder} /></label>
          <label>{faq.topic}<select value={faqTag} onChange={(e) => setFaqTag(e.target.value as FaqTopic | 'all')}>
            <option value="all">{faq.all}</option>
            {(Object.keys(faq.topics) as FaqTopic[]).map((topic) => <option key={topic} value={topic}>{faq.topics[topic]}</option>)}
          </select></label>
        </div>
        <p role="status">{faq.found}: {faqFiltered.length}</p>
        <Accordion className="min-w-0 [overflow-wrap:anywhere]">
          {faqFiltered.map((f) => (
            <details key={f.id}>
              <summary>{f.q}</summary>
              <div><p>{f.a}</p></div>
            </details>
          ))}
        </Accordion>
        {faqFiltered.length === 0 && <p>{faq.noResults}</p>}
      </Section>
    );
  }

  if (id === 'glossary') {
    return (
      <Section title={gloss.heading}>
        <label className="site-search-label">{gloss.search}<input type="search" value={glossQuery} onChange={(e) => setGlossQuery(e.target.value)} /></label>
        <p role="status">{gloss.found}: {glossFiltered.length}</p>
        <dl className="site-glossary">
          {glossFiltered.map((g) => {
            const icon = g.id === 'mind' ? resourceIcon('mind') : undefined;
            return (
              <div className={'site-paper' + (icon ? ' site-glossary__with-icon' : '')} key={g.id}>
                {icon && <SitePlate src={icon} size={44} className="site-glossary__icon" />}
                <dt>{g.term}</dt>
                <dd>{g.definition}</dd>
              </div>
            );
          })}
        </dl>
        {glossFiltered.length === 0 && <p>{gloss.empty}</p>}
        <blockquote className="site-narrative">{gloss.note}</blockquote>
      </Section>
    );
  }

  if (id === 'weather') {
    const copy = editorialPages[language].weather;
    return (
      <Section title={copy.heading}>
        <WeatherDemo />
        <blockquote className="site-narrative">{copy.caution}</blockquote>
      </Section>
    );
  }

  if (id === 'seasons') {
    const copy = siteSeasons[language];
    return (
      <Section title={copy.wheelTitle}>
        <SeasonWheelDemo />
        <blockquote className="site-narrative">{copy.disclaimer}</blockquote>
      </Section>
    );
  }

  if (id === 'trust') {
    const copy = siteTrust[language];
    return (
      <Section title={copy.heading}>
        <p className="site-guide-warn">{copy.note}</p>
        <div className="site-grid">
          {copy.medallions.map((medallion, i) => (
            <article key={medallion.id} className="site-card site-paper min-w-0 [overflow-wrap:anywhere]" style={{ textAlign: 'center' }}>
              <svg width="95" height="95" viewBox="0 0 100 100" aria-hidden="true">
                <circle cx="50" cy="50" r="43" fill="var(--sb-cyan)" stroke="var(--sb-body)" strokeWidth="4" />
                {Array.from({ length: i + 1 }, (_, n) => (
                  <circle key={n} cx="50" cy="50" r={38 - n * 6} fill="none" stroke="var(--sb-body-2)" strokeWidth="1.5" />
                ))}
                <text x="50" y="58" textAnchor="middle" fontSize="26" fill="var(--sb-green)">{i + 1}</text>
              </svg>
              <span className="sr-only">{copy.tierLabel(i + 1)}: </span>
              <h3>{medallion.name}</h3>
              <p>{medallion.text}</p>
            </article>
          ))}
        </div>
      </Section>
    );
  }

  if (id === 'mine') {
    const copy = siteMine[language];
    return (
      <>
        <Section title={copy.heading}>
          <ol className="site-steps">
            {copy.steps.map((step, index) => (
              <li key={index} className="site-paper">
                <span className="site-step-number">{String(index + 1).padStart(2, '0')}</span>
                <div><h3>{step.title}</h3><p>{step.text}</p></div>
              </li>
            ))}
          </ol>
          <p className="site-guide-warn">{copy.expedition}</p>
          <p className="site-guide-warn">{copy.note}</p>
        </Section>
      </>
    );
  }

  if (id === 'tools') {
    const copy = siteTools[language];
    const catalog = toolsCatalogCopy[language];
    const rarityLabels = toolsCopy[language].collectionPage.rarities;
    const profiles = toolProfiles[language];
    const types = TOOL_NFTS.map((tool) => tool.id as ToolTypeId);
    const source = (type: ToolTypeId) => TOOL_FROM_PACK[type] ? catalog.fromPack : catalog.craftOnly;
    return (
      <>
        {/* 1. Реестр: типы одной таблицей — что добывает, сколько часов держит
            заход, откуда берётся. Порядок колонок повторяет путь мастера. */}
        <Section title={catalog.registryHeading}>
          <p className="site-reading">{catalog.registryIntro}</p>
          <div className="site-table-wrap">
            <table className="site-table">
              <thead>
                <tr>
                  <th scope="col">{catalog.columns.tool}</th>
                  <th scope="col">{catalog.columns.resource}</th>
                  <th scope="col">{catalog.columns.hours}</th>
                  <th scope="col">{catalog.columns.yield}</th>
                  <th scope="col">{catalog.columns.source}</th>
                </tr>
              </thead>
              <tbody>
                {types.map((type) => (
                  <tr key={type}>
                    <th scope="row" className="site-tool-cell">
                      <SitePlate src={toolPlate(type, 'common')} alt="" size={44} className="site-io-icon" />
                      <span>{toolName(language, type)}</span>
                    </th>
                    <td className="site-tool-cell">
                      <SitePlate src={resourceIcon(TOOL_RESOURCE[type])} alt="" size={32} className="site-io-icon" />
                      <span>{resourceName(TOOL_RESOURCE[type], TOOL_RESOURCE[type])}</span>
                    </td>
                    <td>
                      {TOOL_SHIFT_HOURS.join(' / ')}
                      <small className="site-cell-note">{catalog.hoursHint}</small>
                    </td>
                    <td>
                      ×{TOOL_YIELD_MULTIPLIER[0]} … ×{TOOL_YIELD_MULTIPLIER[TOOL_YIELD_MULTIPLIER.length - 1]}
                      <small className="site-cell-note">{catalog.yieldHint}</small>
                    </td>
                    <td><span className="site-chip" data-source={TOOL_FROM_PACK[type] ? 'pack' : 'craft'}>{source(type)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* 2. Профили: одна карточка на тип — картина, смысл и рабочие числа. */}
        <Section title={catalog.profileHeading}>
          <p className="site-reading">{catalog.profileIntro}</p>
          <div className="site-grid site-tool-profiles">
            {types.map((type, index) => (
              <article key={type} className={'site-card site-paper site-tool site-tool--' + index % 5}>
                <SitePlate src={toolPlate(type, 'common')} alt="" size="100%" className="site-tool__art" />
                <h3>{toolName(language, type)}</h3>
                <p>{profiles[type]}</p>
                <dl className="site-tool-facts">
                  <div>
                    <dt>{catalog.columns.resource}</dt>
                    <dd className="site-tool-cell">
                      <SitePlate src={resourceIcon(TOOL_RESOURCE[type])} alt="" size={26} className="site-io-icon" />
                      <span>{resourceName(TOOL_RESOURCE[type], TOOL_RESOURCE[type])}</span>
                    </dd>
                  </div>
                  <div>
                    <dt>{catalog.hoursLabel}</dt>
                    <dd>{TOOL_SHIFT_HOURS.join(' · ')}</dd>
                  </div>
                  <div>
                    <dt>{catalog.yieldLabel}</dt>
                    <dd>×{TOOL_YIELD_MULTIPLIER.join(' · ×')}</dd>
                  </div>
                  <div>
                    <dt>{catalog.sourceLabel}</dt>
                    <dd>{source(type)}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
          <p className="site-guide-warn">{catalog.miningNote}</p>
        </Section>

        {/* 3. Редкости: характер словами и числа одной таблицей. */}
        <Section title={copy.rarityHeading}>
          <div className="site-grid">
            {TOOL_RARITIES.map((rarity, index) => (
              <article key={rarity} className={'site-tool site-paper site-tool--' + index}>
                <SitePlate src={toolPlate('plasma_cutter', rarity)} alt="" size="100%" className="site-tool__art" />
                <h3>{rarityLabels[index]}</h3>
                <p>{copy.rarityDescriptions[index]}</p>
                <dl className="site-tool-facts">
                  <div><dt>{catalog.columns.hours}</dt><dd>{TOOL_SHIFT_HOURS[index]}</dd></div>
                  <div><dt>{catalog.yieldLabel}</dt><dd>×{TOOL_YIELD_MULTIPLIER[index]}</dd></div>
                </dl>
              </article>
            ))}
          </div>
          <p className="site-guide-warn">{copy.rarityNotice}</p>
          <div className="site-table-wrap site-rarity-matrix">
            <h3>{catalog.matrixHeading}</h3>
            <p className="site-reading">{catalog.matrixIntro}</p>
            <table className="site-table">
              <thead>
                <tr>
                  <th scope="col">{catalog.matrixHeading}</th>
                  <th scope="col">{catalog.columns.hours}</th>
                  <th scope="col">{catalog.yieldLabel}</th>
                </tr>
              </thead>
              <tbody>
                {TOOL_RARITIES.map((rarity, index) => (
                  <tr key={rarity} className={'site-rarity-row site-tool--' + index}>
                    <th scope="row" className="site-tool-cell">
                      <SitePlate src={toolPlate('silicon_extractor', rarity)} alt="" size={36} className="site-io-icon" />
                      <span>{rarityLabels[index]}</span>
                    </th>
                    <td>{TOOL_SHIFT_HOURS[index]}</td>
                    <td>×{TOOL_YIELD_MULTIPLIER[index]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* 4. Галерея: все 25 исполнений, фильтр по редкости. */}
        <Section title={copy.galleryHeading}>
          <ToolGallery
            language={language}
            intro={copy.galleryIntro}
            notice={copy.galleryNotice}
            filterLabel={catalog.galleryFilter}
            allLabel={catalog.galleryAllRarities}
            showing={catalog.galleryShowing}
          />
        </Section>
      </>
    );
  }

  if (id === 'quests') {
    const copy = siteJournalCopy[language];
    return (
      <Section title={copy.heading}>
        <JournalBoard />
        <div className="site-actions min-w-0 [overflow-wrap:anywhere]">
          <Button to="/site/resources">{copy.inspect}</Button>
          <Button to="/site/packs" variant="ghost">{copy.capsule}</Button>
          <Button to="/site/lottery" variant="ghost">{copy.wheel}</Button>
          <Button to="/site/roadmap" variant="ghost">{copy.roadmap}</Button>
        </div>
      </Section>
    );
  }

  if (id === 'home') {
    return (
      <>
        <Section title={home.chainTitle}>
          <ChainDiagram />
        </Section>
        <Section title={home.samplesTitle}>
          <div className="site-grid">
            {resources.slice(0, 8).map((r, index) => (
              <Link className="site-card site-paper" key={r.id} to={'/site/resources/' + r.slug}>
                <SitePlate src={resourcePlate(r.id)} alt="" size="100%" className="site-card__art" />
                <p className="site-eyebrow">{home.material}</p>
                <h3>{resourceName(r.id, r.name)}</h3>
                <p>{language === 'ru' ? r.lead : home.leads[index]}</p>
              </Link>
            ))}
          </div>
          <div className="site-icon-strip" aria-label={home.allResources}>
            {resources.map((r) => (
              <Link key={r.id} to={'/site/resources/' + r.slug} title={resourceName(r.id, r.name)} className="site-icon-strip__item">
                <SitePlate src={resourceIcon(r.id)} alt="" size={56} />
                <small>{resourceName(r.id, r.name)}</small>
              </Link>
            ))}
          </div>
        </Section>
      </>
    );
  }

  if (id === 'market') {
    const copy = siteMarket[language];
    const names = tradeNavigationCopy[language].market;
    return (
      <Section title={copy.heading}>
        <div className="site-grid">
          {marketVenueIds.map((venue) => (
            <article key={venue} className="site-card site-paper">
              <SitePlate src={marketVenueIcons[venue]} alt="" size={44} />
              <h3>{venueLabel(names, venue)}</h3>
              <p>{copy.venues[venue]}</p>
            </article>
          ))}
        </div>
        <p className="site-guide-warn">{copy.note}</p>
      </Section>
    );
  }

  if (id === 'economy') {
    const copy = siteEconomy[language];
    return (
      <>
        <Section title={copy.flowHeading}>
          <div className="site-grid">
            <article className="site-card site-paper">
              <h3>{copy.incoming}</h3>
              <ul>{copy.incomingItems.map((item, index) => <li key={index}>{item}</li>)}</ul>
            </article>
            <article className="site-card site-paper">
              <h3>{copy.outgoing}</h3>
              <ul>{copy.outgoingItems.map((item, index) => <li key={index}>{item}</li>)}</ul>
            </article>
          </div>
        </Section>
        <Section title={copy.cyclesHeading}>
          <div className="site-grid">
            {economyCycleIds.map((id) => {
              const cycle = copy.cycles[id];
              return (
                <article key={id} className="site-card site-paper">
                  <h3>{cycle.title}</h3>
                  <ol>{cycle.steps.map((step, index) => <li key={index}>{step}</li>)}</ol>
                </article>
              );
            })}
          </div>
          <p className="site-guide-warn">{copy.note}</p>
        </Section>
      </>
    );
  }

  if (id === 'docs') {
    const copy = siteDocs[language];
    return (
      <Section title={copy.heading}>
        <p className="site-guide-warn">{copy.codeNote}</p>
        <Accordion className="site-docs-accordion">
          {instructionGroups.map((group) => (
            <details key={group.id}>
              <summary>{copy.groups[group.id].title}</summary>
              <div>
                <p>{copy.groups[group.id].description}</p>
                <ul>
                  {group.instructions.map((instruction) => <li key={instruction}><code>{instruction}</code></li>)}
                </ul>
              </div>
            </details>
          ))}
        </Accordion>
        <p className="site-guide-warn">{copy.caution}</p>
      </Section>
    );
  }

  return null;
}

import { pages as xlPages } from '../content/game';
const relatedMap: Record<string, string[]> = {
  home: ['guide', 'recipes', 'trade', 'potato'],
  start: ['guide', 'rules', 'energy'],
  guide: ['start', 'strategies', 'recipes'],
  strategies: ['guide', 'quests', 'trade'],
  manifesto: ['lore', 'rules', 'investors'],
  world: ['farm', 'mine', 'market'],
  energy: ['farm', 'recipes', 'weather'],
  weather: ['farm', 'seasons', 'energy'],
  farm: ['recipes', 'weather', 'energy'],
  craft: ['recipes', 'tools', 'docs'],
  recipes: ['farm', 'craft', 'potato'],
  tools: ['craft', 'trade', 'market'],
  mine: ['trade', 'recipes', 'energy'],
  packs: ['lottery', 'trade', 'recipes'],
  lottery: ['packs', 'quests', 'trust'],
  economy: ['trade', 'market', 'investors'],
  market: ['trade', 'economy', 'tools'],
  trade: ['market', 'economy', 'tools'],
  potato: ['recipes', 'trade', 'rules'],
  seasons: ['quests', 'roadmap', 'trust'],
  quests: ['guide', 'strategies', 'trust'],
  trust: ['rules', 'quests', 'docs'],
  resources: ['recipes', 'trade', 'glossary'],
  lore: ['manifesto', 'seasons', 'rules'],
  rules: ['trust', 'potato', 'start'],
  faq: ['glossary', 'docs', 'guide'],
  glossary: ['faq', 'docs', 'recipes'],
  roadmap: ['investors', 'seasons', 'lore'],
  investors: ['economy', 'roadmap', 'manifesto'],
  docs: ['glossary', 'faq', 'investors'],
};
export function CrossLinks({ id }: { id: string }) {
  const { language } = useLocale();
  const ids = relatedMap[id];
  if (!ids || ids.length === 0) return null;
  return (
    <Section title={furtherLabels[language]}>
      <div className="site-actions">
        {ids.map((rid) => {
          const p = xlPages.find((x) => x.id === rid);
          return p ? <Link key={rid} className="site-chip" to={'/site/' + rid}>{pageNames[language][rid as PageId] ?? p.title} →</Link> : null;
        })}
      </div>
    </Section>
  );
}
