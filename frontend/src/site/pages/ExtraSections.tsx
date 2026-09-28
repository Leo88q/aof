import { functionalStorage } from "../../legal/consent";
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button, Section } from '../ui/Components';
import {
  resourcesById, resources, recipes, stationNames,
  potatoOrigin, potatoUses, potatoRules, potatoLore, potatoIntegration,
  guideSteps, strategies, masterStories,
  tradeMethods, tradeComparison, investorDeepDive,
  faqItems, faqTagsList, glossaryTerms, loreChapters,
  roadmapItems, roadmapEraNames, manifestoPrinciples, manifestoClosing, rulesList,
  mechanics,
} from '../content/game';
import {
  resourceIcon, resourcePlate, resourceVisual, toolPlate, TOOL_NFTS, TOOL_RARITIES, UI_ICONS,
} from '../../lib/visualAssets';

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

/** Строка входа/выхода рецепта: иконка + имя + количество. `tools` и `skr` — не ресурсы каталога. */
function RecipeIo({ recipeId, resourceId, amount, kind }: { recipeId: string; resourceId: string; amount: number; kind: 'in' | 'out' }) {
  let icon: string | undefined;
  let label: string;
  if (resourceId === 'tools') {
    const rarity = /legendary/.test(recipeId) ? 'legendary' : /epic/.test(recipeId) ? 'epic' : /rare/.test(recipeId) ? 'rare' : /uncommon/.test(recipeId) ? 'uncommon' : 'common';
    icon = toolPlate('plasma_cutter', rarity);
    label = 'Инструмент (NFT)';
  } else if (resourceId === 'skr') {
    icon = UI_ICONS.tokenCoin;
    label = 'SKR';
  } else {
    const res = resourcesById.get(resourceId);
    icon = resourceIcon(resourceId);
    label = res ? res.name : resourceId;
  }
  return (
    <li className={kind === 'in' ? 'site-recipe-in' : 'site-recipe-out'}>
      <SitePlate src={icon} size={40} className="site-io-icon" />
      <span>{label} ×{amount}</span>
    </li>
  );
}

const TOOL_RARITY_LABEL: Record<string, string> = {
  common: 'Base', uncommon: 'Enhanced', rare: 'Quantum', epic: 'Singularity', legendary: 'Transcendent',
};

function groups(): [string, typeof recipes][] {
  const map = new Map<string, typeof recipes>();
  for (const r of recipes) {
    const list = map.get(r.station) || [];
    list.push(r);
    map.set(r.station, list);
  }
  return [...map.entries()];
}

const trustTiers = [
  { name: 'Stranger', text: 'Чужак, чья запись ещё пуста. С этого порога начинается каждый путь.' },
  { name: 'Neighbour', text: 'Коллега: первые обещания выполнены, первые сделки состоялись без посредников.' },
  { name: 'Partner', text: 'Партнёр по регулярным сделкам: совместные циклы и разделённый риск.' },
  { name: 'Guildsman', text: 'Член круга: доля коллективной работы и коллективного ответа.' },
  { name: 'Elder', text: 'Старейшина: запись длиннее эпохи, слово тяжелее печати.' },
];

const rarities = [
  { name: 'Base', text: 'Грубая сборка, базовая кромка, проводная обмотка. Первый инструмент каждого мастера.' },
  { name: 'Enhanced', text: 'Кованая сталь, промасленный дуб, кожаная обмотка. Держит кромку вдвое дольше.' },
  { name: 'Quantum', text: 'Булат с медным ошейником. Патина как знак времени, а не дефекта.' },
  { name: 'Singularity', text: 'Между редким и легендарным: уже больше ремесла, ещё не легенда.' },
  { name: 'Transcendent', text: 'Метеоритное железо с медной инкрустацией. Тёплый на ощупь даже зимой.' },
];

function WeatherDemo() {
  const [state, setState] = useState('sun');
  const names: Record<string, string> = { drought: 'Блэкаут', sun: 'Номинал', rain: 'Скачок', festival: 'Френзи' };
  return (
    <div>
      <fieldset className="site-options">
        <legend>Демонстрация неба</legend>
        {Object.entries(names).map(([sid, name]) => (
          <label key={sid}>
            <input type="radio" name="site-weather" checked={state === sid} onChange={() => setState(sid)} />
            {name}
          </label>
        ))}
      </fieldset>
      <div className="site-weather" aria-hidden="true">
        <svg viewBox="0 0 700 230" className="site-weather-scene">
          <path d="M0 175Q180 80 360 170T700 130V230H0Z" fill="var(--aof-sage)" />
          <path d="M220 120h150v90H220z" fill="var(--aof-oak)" />
          <path d="M200 125l95-90 95 90z" fill="var(--aof-terracotta)" />
          <path d="M280 145h32v65h-32z" fill="var(--aof-oak-dark)" />
          <path d="M335 145h22v26h-22z" fill="var(--aof-golden)" />
        </svg>
        {Object.keys(names).map((sid) => (
          <div key={sid} className={'site-weather-layer site-weather--' + sid} style={{ opacity: state === sid ? 1 : 0 }}>
            {sid === 'rain' &&
              Array.from({ length: 32 }, (_, i) => (
                <i key={i} style={{ left: ((i * 37) % 100) + '%', top: (-(i * 17) % 100) + '%', animationDelay: -(i * 0.19) + 's', animationDuration: 1 + (i % 2) * 0.3 + 's' }} />
              ))}
          </div>
        ))}
      </div>
      <p role="status">Выбрано: {names[state]}</p>
    </div>
  );
}

function SeasonWheelDemo() {
  const [season, setSeason] = useState(0);
  const names = ['Весна', 'Вторую фазу', 'Третью фазу', 'Завершение цикла'];
  return (
    <div className="site-season">
      <button type="button" className="site-season-button" onClick={() => setSeason((s) => (s + 1) % 4)} aria-label={'Эпох: ' + names[season] + '. Сменить'}>
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r="43" fill="var(--aof-oak)" stroke="var(--aof-copper)" strokeWidth="5" />
          {[0, 1, 2, 3].map((i) => (
            <path key={i} d="M50 12v25" transform={'rotate(' + i * 90 + ' 50 50)'} stroke="var(--aof-parchment)" strokeWidth="2" />
          ))}
          <g style={{ transform: 'rotate(' + season * 90 + 'deg)', transformOrigin: '50px 50px' }}>
            <path d="M50 18l-8 30h16z" fill="var(--aof-golden)" />
          </g>
        </svg>
      </button>
      <p role="status">{names[season]} · оформление, не погода игры</p>
    </div>
  );
}

function ChainDiagram() {
  const steps = [
    { id: 'neuron', name: 'Нейроны' },
    { id: 'synapse', name: 'Синапс' },
    { id: 'signal', name: 'Сигнал' },
    { id: 'model', name: 'Модель' },
  ];
  return (
    <figure className="site-diagram site-paper">
      <ol className="site-chain" aria-label="Нейроны, синапс, сигнал, модель">
        {steps.map((st, i) => (
          <li key={st.id} className="site-chain__step">
            <Link to={'/site/resources/' + (resourcesById.get(st.id)?.slug ?? st.id)} className="site-chain__node">
              <SitePlate src={resourceIcon(st.id)} alt="" size={72} />
              <span>{st.name}</span>
            </Link>
            {i < steps.length - 1 && <span className="site-chain__arrow" aria-hidden="true">→</span>}
          </li>
        ))}
      </ol>
      <figcaption>Выращивай → перерабатывай → тренируй. Схема качественная, без норм расхода.</figcaption>
    </figure>
  );
}

const JKEY = 'aof:site:journal:v1';
const badgeDefs = [
  { id: 'reader', name: 'Читатель', text: 'Открой пять разных страниц.' },
  { id: 'resource', name: 'Материаловед', text: 'Осмотри карточку ресурса.' },
  { id: 'commit', name: 'Проверяющий', text: 'Сверь локальный commit/reveal.' },
  { id: 'pack', name: 'Распаковщик', text: 'Открой демонстрационный пак.' },
  { id: 'drum', name: 'Ритм мастера', text: 'Попробуй демонстрационный барабан.' },
  { id: 'chronicler', name: 'Вторую фазуписец', text: 'Открой вторую фазупись сайта (changelog).' },
];
function readJournal(): { visits: string[]; badges: string[] } {
  try {
    const raw = functionalStorage.getItem(JKEY);
    if (!raw) return { visits: [], badges: [] };
    const v = JSON.parse(raw);
    return { visits: Array.isArray(v.visits) ? v.visits : [], badges: Array.isArray(v.badges) ? v.badges : [] };
  } catch { return { visits: [], badges: [] }; }
}
function writeJournal(j: { visits: string[]; badges: string[] }) {
  try { functionalStorage.setItem(JKEY, JSON.stringify(j)); } catch { /* private mode */ }
}
function JournalBoard() {
  const [j, setJ] = useState(readJournal);
  useEffect(() => {
    const onVisit = (e: Event) => {
      const id = (e as CustomEvent).detail as string;
      setJ((prev) => {
        if (prev.visits.includes(id)) return prev;
        const visits = [...prev.visits, id].slice(-100);
        const badges = visits.length >= 5 && !prev.badges.includes('reader') ? [...prev.badges, 'reader'] : prev.badges;
        const next = { visits, badges };
        writeJournal(next);
        return next;
      });
    };
    const onBadge = (e: Event) => {
      const id = (e as CustomEvent).detail as string;
      setJ((prev) => {
        if (prev.badges.includes(id)) return prev;
        const next = { ...prev, badges: [...prev.badges, id] };
        writeJournal(next);
        return next;
      });
    };
    const refreshPrivacy = () => setJ(readJournal());
    window.addEventListener('nf:privacy-change', refreshPrivacy);
    window.addEventListener('storage', refreshPrivacy);
    window.addEventListener('aof:visit', onVisit);
    window.addEventListener('aof:badge', onBadge);
    return () => {
      window.removeEventListener('nf:privacy-change', refreshPrivacy);
      window.removeEventListener('storage', refreshPrivacy);
      window.removeEventListener('aof:visit', onVisit);
      window.removeEventListener('aof:badge', onBadge);
    };
  }, []);
  const reset = () => { const empty = { visits: [], badges: [] }; writeJournal(empty); setJ(empty); };
  return (
    <div className="site-card site-paper">
      <h3>Твои отметки · {j.badges.length}/{badgeDefs.length}</h3>
      <p>Только этот браузер. Без игровых наград. Страниц открыто: {j.visits.length}.</p>
      <ul className="site-badge-list">
        {badgeDefs.map((b) => (
          <li key={b.id} data-earned={j.badges.includes(b.id)}>
            <span aria-hidden="true">{j.badges.includes(b.id) ? '✓' : '○'}</span>
            <div><strong>{b.name}</strong><p>{b.text}</p></div>
          </li>
        ))}
      </ul>
      <button type="button" className="site-small-button" onClick={reset}>Сбросить местные отметки</button>
    </div>
  );
}

export function ExtraSections({ id }: { id: string }) {
  const [faqQuery, setFaqQuery] = useState('');
  const [faqTag, setFaqTag] = useState('all');
  const [glossQuery, setGlossQuery] = useState('');
  const faqFiltered = faqItems.filter(f =>
    (faqTag === 'all' || f.tags.includes(faqTag)) &&
    (f.q + ' ' + f.a).toLowerCase().includes(faqQuery.toLowerCase()));
  const glossFiltered = glossaryTerms.filter(g =>
    (g.term + ' ' + g.definition).toLowerCase().includes(glossQuery.toLowerCase()));

  if (id === 'recipes') {
    return (
      <Section title="Книга рецептов">
        {groups().map(([station, list]) => (
          <div key={station} className="site-recipe-group">
            <h3>{stationNames[station] ?? station}</h3>
            <div className="site-grid">
              {list.map((r) => {
                const missingResources = [...r.inputs, ...r.outputs]
                  .map((item) => item.resourceId)
                  .filter((resourceId, index, ids) => resourceId !== 'tools' && resourceId !== 'skr' && !resourcesById.has(resourceId) && ids.indexOf(resourceId) === index);
                return (
                  <article key={r.id} className="site-card site-paper site-recipe">
                    <span className="site-badge">
                      {r.verification === 'on-chain-verified'
                        ? 'On-chain проверено'
                        : 'Редакционный пример · on-chain не подтверждён'}
                    </span>
                    <h4>{r.name}</h4>
                    <ul className="site-recipe-io">
                      {r.inputs.map((i) => <RecipeIo key={i.resourceId} recipeId={r.id} resourceId={i.resourceId} amount={i.amount} kind="in" />)}
                    </ul>
                    <p className="site-recipe-arrow" aria-hidden="true">↓</p>
                    <ul className="site-recipe-io">
                      {r.outputs.length > 0
                        ? r.outputs.map((o) => <RecipeIo key={o.resourceId} recipeId={r.id} resourceId={o.resourceId} amount={o.amount} kind="out" />)
                        : <li className="site-recipe-out"><span>Эффект без предмета</span></li>}
                    </ul>
                    <p className="site-recipe-meta">
                      Энергия: {r.energy}{r.time ? ` · ${r.time}` : ''}{r.skrDiscount ? ' · SKR −15% на MIND' : ''}{r.potatoCost ? ` · MIND ×${r.potatoCost}` : ''}
                    </p>
                    <p>{r.description}</p>
                    {missingResources.length > 0 && (
                      <p className="site-guide-warn">В каталоге сайта не найдено: {missingResources.join(', ')}. Сначала проверь live UI и on-chain состояние.</p>
                    )}
                    {r.narrative && <blockquote className="site-narrative">{r.narrative}</blockquote>}
                  </article>
                );
              })}
            </div>
          </div>
        ))}
      </Section>
    );
  }

  if (id === 'potato') {
    return (
      <>
        <Section title="Откуда пришёл MIND">
          <div className="site-media-row">
            <SitePlate src={resourcePlate('mind')} alt="MIND" size="min(100%, 220px)" className="site-media-row__art" />
            <div>
              {potatoOrigin.paragraphs.map((p) => <p className="site-reading" key={p.slice(0, 24)}>{p}</p>)}
            </div>
          </div>
        </Section>
        <Section title="Пять способов потратить">
          <div className="site-grid">
            {potatoUses.map((u) => (
              <article key={u.id} className="site-card site-paper">
                <span className="site-badge">{u.category}</span>
                <h3>{u.title}</h3>
                <p className="site-guide-meta">Расход: {u.cost} MIND</p>
                <p>{u.description}</p>
                <blockquote className="site-narrative">{u.narrative}</blockquote>
              </article>
            ))}
          </div>
        </Section>
        <Section title="Правила токена">
          <div className="site-accordion">
            {potatoRules.map((r) => (
              <details key={r.title}>
                <summary>{r.title}</summary>
                <div><p>{r.text}</p></div>
              </details>
            ))}
          </div>
        </Section>
        <Section title="Голоса мастерской о MIND">
          <div className="site-stories">
            {potatoLore.map((f) => (
              <blockquote key={f.id} className="site-story">
                <p>{f.quote}</p>
                <footer><strong>{f.character}</strong><span>{f.context}</span></footer>
              </blockquote>
            ))}
          </div>
        </Section>
        <Section title="Техническая интеграция">
          <div className="site-grid">
            <article className="site-card site-paper"><h3>Кошелёк</h3><p>{potatoIntegration.wallet}</p></article>
            <article className="site-card site-paper"><h3>Проверка</h3><p>{potatoIntegration.verification}</p></article>
            <article className="site-card site-paper"><h3>Безопасность</h3><p>{potatoIntegration.safety}</p></article>
          </div>
        </Section>
      </>
    );
  }

  if (id === 'guide') {
    return (
      <Section title="Шесть смен мастера">
        <ol className="site-guide">
          {guideSteps.map((g) => (
            <li key={g.id} className="site-paper site-guide-step">
              <span className="site-step-number">{String(g.step).padStart(2, '0')}</span>
              <div>
                <h3>{g.title}</h3>
                <p className="site-guide-meta">{g.duration} · цель: {g.goal}</p>
                <ul>{g.actions.map((a) => <li key={a.slice(0, 20)}>{a}</li>)}</ul>
                {g.warnings.length > 0 && (
                  <ul className="site-guide-warn">{g.warnings.map((w) => <li key={w.slice(0, 20)}>⚠ {w}</li>)}</ul>
                )}
                <blockquote className="site-narrative">{g.narrative}</blockquote>
              </div>
            </li>
          ))}
        </ol>
      </Section>
    );
  }

  if (id === 'strategies') {
    return (
      <>
        <Section title="Пять путей мастера">
          <div className="site-grid">
            {strategies.map((s) => (
              <article key={s.id} className="site-card site-paper">
                <h3>{s.title}</h3>
                <p className="site-guide-meta">{s.playstyle}</p>
                <p>{s.description}</p>
                <ul>{s.tips.map((t) => <li key={t.slice(0, 20)}>{t}</li>)}</ul>
              </article>
            ))}
          </div>
        </Section>
        <Section title="Голоса мастеров">
          <div className="site-stories">
            {masterStories.map((f) => (
              <blockquote key={f.id} className="site-story">
                <p>{f.quote}</p>
                <footer><strong>{f.character}</strong><span>{f.context}</span></footer>
              </blockquote>
            ))}
          </div>
        </Section>
      </>
    );
  }

  if (id === 'trade') {
    return (
      <>
        {/* [AUDIT G-05] "six ways to trade" while aof-market is off: the
            venue list now states which ones are actually executable. */}
        <Section title="Шесть способов торговли">
          <div className="site-grid">
            {tradeMethods.map((t) => (
              <article key={t.id} className="site-card site-paper">
                <h3>
                  {t.name}{' '}
                  {!t.live && (
                    <span className="site-guide-warn" title="Программа aof-market пока не исполняет торговые инструкции">
                      — не запущено
                    </span>
                  )}
                </h3>
                <p className="site-guide-meta">{t.speed} · риск: {t.risk} · контроль: {t.control}</p>
                <p>{t.description}</p>
                <blockquote className="site-narrative">{t.narrative}</blockquote>
                <h4>Когда использовать</h4>
                <ul>{t.whenToUse.map((w) => <li key={w.slice(0, 20)}>{w}</li>)}</ul>
                <h4>Когда избегать</h4>
                <ul className="site-guide-warn">{t.whenToAvoid.map((w) => <li key={w.slice(0, 20)}>{w}</li>)}</ul>
                <p className="site-recipe-meta">Инструкции: {t.instructions.join(', ')}</p>
              </article>
            ))}
          </div>
        </Section>
        <Section title="Сравнение способов">
          <div className="site-table-wrap">
            <table className="site-table">
              <thead><tr>{tradeComparison.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
              <tbody>
                {tradeComparison.rows.map((r) => (
                  <tr key={r[0]}>{r.map((c, i) => <td key={i}>{c}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </>
    );
  }

  if (id === 'investors') {
    return (
      <>
        <Section title="Четыре игровых цикла">
          <div className="site-grid">
            {investorDeepDive.loops.map((l) => (
              <article key={l.title} className="site-card site-paper">
                <h3>{l.title}</h3>
                <ol>{l.steps.map((s) => <li key={s.slice(0, 16)}>{s}</li>)}</ol>
                <p>{l.note}</p>
              </article>
            ))}
          </div>
        </Section>
        <Section title="Стоки и источники">
          <div className="site-grid">
            <article className="site-card site-paper">
              <h3>Куда уходит</h3>
              <ul>{investorDeepDive.sinks.map((s) => <li key={s.title}><strong>{s.title}.</strong> {s.text}</li>)}</ul>
            </article>
            <article className="site-card site-paper">
              <h3>Откуда приходит</h3>
              <ul>{investorDeepDive.sources.map((s) => <li key={s.title}><strong>{s.title}.</strong> {s.text}</li>)}</ul>
            </article>
          </div>
        </Section>
        <Section title="Вопросы, которые стоит задать">
          <ul className="site-guide-warn">
            {investorDeepDive.questions.map((q) => <li key={q.slice(0, 24)}>{q}</li>)}
          </ul>
        </Section>
      </>
    );
  }

  if (id === 'manifesto') {
    return (
      <Section title="Четыре опоры">
        <div className="site-grid">
          {manifestoPrinciples.map((p) => (
            <article key={p.title} className="site-card site-paper">
              <h3>{p.title}</h3>
              <p>{p.text}</p>
            </article>
          ))}
        </div>
        <blockquote className="site-narrative">{manifestoClosing}</blockquote>
      </Section>
    );
  }

  if (id === 'rules') {
    return (
      <Section title="Пять правил мастерской">
        <div className="site-accordion">
          {rulesList.map((r) => (
            <details key={r.id}>
              <summary>{r.title}</summary>
              <div>{r.paragraphs.map((p) => <p key={p.slice(0, 20)}>{p}</p>)}</div>
            </details>
          ))}
        </div>
      </Section>
    );
  }

  if (id === 'lore') {
    return (
      <Section title="Эры мастерской">
        <div className="site-timeline">
          {loreChapters.map((ch) => (
            <article key={ch.id} className="site-paper">
              <p className="site-eyebrow">{ch.era}</p>
              <h3>{ch.title}</h3>
              {ch.paragraphs.map((p) => <p key={p.slice(0, 20)}>{p}</p>)}
            </article>
          ))}
        </div>
      </Section>
    );
  }

  if (id === 'roadmap') {
    return (
      <Section title="Направления работы">
        <div className="site-grid">
          {roadmapItems.map((it) => (
            <article key={it.id} className="site-card site-paper">
              <span className="site-badge">{roadmapEraNames[it.era]}</span>
              <h3>{it.title}</h3>
              <ul>{it.bullets.map((b) => <li key={b.slice(0, 20)}>{b}</li>)}</ul>
            </article>
          ))}
        </div>
        <blockquote className="site-narrative">Статусы — редакционный план сайта и продукта. Они не являются подтверждённым релизом, аудитом или публичным обязательством.</blockquote>
      </Section>
    );
  }

  if (id === 'faq') {
    return (
      <Section title="Тридцать ответов">
        <div className="site-filters">
          <label>Поиск<input type="search" value={faqQuery} onChange={(e) => setFaqQuery(e.target.value)} placeholder="Вопрос или слово ответа" /></label>
          <label>Тема<select value={faqTag} onChange={(e) => setFaqTag(e.target.value)}>
            <option value="all">Все темы</option>
            {faqTagsList.map((t) => <option key={t} value={t}>{t}</option>)}
          </select></label>
        </div>
        <p role="status">Найдено: {faqFiltered.length}</p>
        <div className="site-accordion">
          {faqFiltered.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <div><p>{f.a}</p></div>
            </details>
          ))}
        </div>
        {faqFiltered.length === 0 && <p>Измени запрос: подходящих вопросов нет.</p>}
      </Section>
    );
  }

  if (id === 'glossary') {
    return (
      <Section title="Шестьдесят терминов на одном столе">
        <label className="site-search-label">Найди термин<input type="search" value={glossQuery} onChange={(e) => setGlossQuery(e.target.value)} /></label>
        <p role="status">Найдено: {glossFiltered.length}</p>
        <dl className="site-glossary">
          {glossFiltered.map((g) => {
            const match = resources.find((r) => r.name.toLowerCase() === g.term.toLowerCase()) || resourceVisual(g.term);
            const icon = match ? resourceIcon(match.id) : undefined;
            return (
              <div className={'site-paper' + (icon ? ' site-glossary__with-icon' : '')} key={g.term}>
                {icon && <SitePlate src={icon} size={44} className="site-glossary__icon" />}
                <dt>{g.term}</dt>
                <dd>{g.definition}</dd>
              </div>
            );
          })}
        </dl>
        {glossFiltered.length === 0 && <p>Такого термина нет.</p>}
      </Section>
    );
  }

  if (id === 'weather') {
    return (
      <Section title="Четыре состояния неба">
        <WeatherDemo />
        <blockquote className="site-narrative">Демо меняет только картину на странице: настоящие модификаторы живут в игре и меняются вместе с балансом.</blockquote>
      </Section>
    );
  }

  if (id === 'seasons') {
    return (
      <Section title="Колесо эпох">
        <SeasonWheelDemo />
        <blockquote className="site-narrative">Колесо поворачивает только оформление: эпоха в текущей конфигурации длится 42 дня и держит 42 ступени пропуска.</blockquote>
      </Section>
    );
  }

  if (id === 'trust') {
    return (
      <Section title="Пять медальонов доверия">
        <div className="site-grid">
          {trustTiers.map((t, i) => (
            <article key={t.name} className="site-card site-paper" style={{ textAlign: 'center' }}>
              <svg width="95" height="95" viewBox="0 0 100 100" role="img" aria-label={'Тир ' + (i + 1)}>
                <circle cx="50" cy="50" r="43" fill="var(--aof-copper)" stroke="var(--aof-oak)" strokeWidth="4" />
                {Array.from({ length: i + 1 }, (_, n) => (
                  <circle key={n} cx="50" cy="50" r={38 - n * 6} fill="none" stroke="var(--aof-oak-dark)" strokeWidth="1.5" />
                ))}
                <text x="50" y="58" textAnchor="middle" fontSize="26" fill="var(--aof-forest)">{i + 1}</text>
              </svg>
              <h3>{t.name}</h3>
              <p>{t.text}</p>
            </article>
          ))}
        </div>
      </Section>
    );
  }

  if (id === 'tools') {
    return (
      <>
        <Section title="Пять редкостей — пять характеров">
          <div className="site-grid">
            {rarities.map((r, i) => (
              <article key={r.name} className={'site-tool site-paper site-tool--' + i}>
                <SitePlate src={toolPlate('plasma_cutter', TOOL_RARITIES[i])} alt={`Плазменный резчик · ${r.name}`} size="100%" className="site-tool__art" />
                <h3>{r.name}</h3>
                <p>{r.text}</p>
              </article>
            ))}
          </div>
          <blockquote className="site-narrative">Rarity — характеристика предмета, а не гарантия выгодной сделки: легендарный инструмент в простых руках дешевле обычного в рабочих.</blockquote>
        </Section>
        <Section title="Пять инструментов — двадцать пять NFT">
          <p className="site-reading">Каждый инструмент существует в пяти редкостях. Ниже — все плашки NFT, которые выдаёт кузница: базовая сборка слева, Transcendent справа.</p>
          <div className="site-nft-grid">
            {TOOL_NFTS.map((t) => (
              <article key={t.id} className="site-card site-paper site-nft">
                <SitePlate src={t.base} alt={t.name} size="100%" className="site-nft__hero" />
                <h3>{t.name}</h3>
                <ul className="site-nft__rarities">
                  {TOOL_RARITIES.map((rar) => (
                    <li key={rar}>
                      <SitePlate src={toolPlate(t.id, rar)} alt={`${t.name} · ${TOOL_RARITY_LABEL[rar]}`} size="100%" />
                      <small>{TOOL_RARITY_LABEL[rar]}</small>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </Section>
      </>
    );
  }

  if (id === 'quests') {
    return (
      <Section title="Твой журнал знакомства">
        <JournalBoard />
        <div className="site-actions">
          <Button to="/site/resources">Осмотри ресурс</Button>
          <Button to="/site/packs" variant="ghost">Попробуй пак</Button>
          <Button to="/site/lottery" variant="ghost">Найди ритм</Button>
          <Button to="/site/changelog" variant="ghost">Открой вторую фазупись</Button>
        </div>
      </Section>
    );
  }

  if (id === 'home') {
    return (
      <>
        <Section title="Цепочка труда">
          <ChainDiagram />
        </Section>
        <Section title="Потрогай материал">
          <div className="site-grid">
            {resources.slice(0, 8).map((r) => (
              <Link className="site-card site-paper" key={r.id} to={'/site/resources/' + r.slug}>
                <SitePlate src={resourcePlate(r.id)} alt="" size="100%" className="site-card__art" />
                <p className="site-eyebrow">Материал</p>
                <h3>{r.name}</h3>
                <p>{r.lead}</p>
              </Link>
            ))}
          </div>
          <div className="site-icon-strip" aria-label="Все ресурсы">
            {resources.map((r) => (
              <Link key={r.id} to={'/site/resources/' + r.slug} title={r.name} className="site-icon-strip__item">
                <SitePlate src={resourceIcon(r.id)} alt={r.name} size={56} />
                <small>{r.name}</small>
              </Link>
            ))}
          </div>
        </Section>
      </>
    );
  }

  if (id === 'economy') {
    return (
      <>
        <Section title="Откуда приходит и куда уходит">
          <div className="site-grid">
            <article className="site-card site-paper">
              <h3>Источники</h3>
              <ul>{investorDeepDive.sources.map((s) => <li key={s.title}><strong>{s.title}.</strong> {s.text}</li>)}</ul>
            </article>
            <article className="site-card site-paper">
              <h3>Стоки</h3>
              <ul>{investorDeepDive.sinks.map((s) => <li key={s.title}><strong>{s.title}.</strong> {s.text}</li>)}</ul>
            </article>
          </div>
        </Section>
        <Section title="Четыре цикла экономики">
          <div className="site-grid">
            {investorDeepDive.loops.map((l) => (
              <article key={l.title} className="site-card site-paper">
                <h3>{l.title}</h3>
                <ol>{l.steps.map((s) => <li key={s.slice(0, 16)}>{s}</li>)}</ol>
              </article>
            ))}
          </div>
        </Section>
      </>
    );
  }

  if (id === 'docs') {
    return (
      <Section title="Индекс инструкций">
        <div className="site-accordion">
          {mechanics.filter((m) => m.steps.some((s) => s.instruction)).map((m) => (
            <details key={m.id}>
              <summary>{m.name}</summary>
              <div>
                <ul>
                  {m.steps.filter((s) => s.instruction).map((s) => (
                    <li key={s.instruction}><code>{s.instruction}</code> — {s.title}</li>
                  ))}
                </ul>
              </div>
            </details>
          ))}
        </div>
        <blockquote className="site-narrative">Имена инструкций помогают связать описание с реализацией. Они не являются ссылкой на проведённый аудит.</blockquote>
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
  strategies: ['guide', 'community', 'trade'],
  manifesto: ['lore', 'rules', 'investors'],
  world: ['farm', 'mine', 'market'],
  energy: ['farm', 'recipes', 'weather'],
  weather: ['farm', 'seasons', 'energy'],
  farm: ['recipes', 'weather', 'energy'],
  craft: ['recipes', 'tools', 'fair'],
  recipes: ['farm', 'craft', 'potato'],
  tools: ['craft', 'rental', 'market'],
  mine: ['trade', 'recipes', 'energy'],
  fair: ['craft', 'packs', 'trust'],
  packs: ['lottery', 'trade', 'recipes'],
  lottery: ['packs', 'quests', 'trust'],
  economy: ['trade', 'liquidity', 'investors'],
  market: ['trade', 'liquidity', 'economy'],
  trade: ['market', 'liquidity', 'rental'],
  liquidity: ['market', 'economy', 'investors'],
  rental: ['tools', 'market', 'trade'],
  npc: ['market', 'potato', 'weather'],
  potato: ['recipes', 'trade', 'rules'],
  seasons: ['rebirth', 'quests', 'roadmap'],
  rebirth: ['seasons', 'trust', 'lore'],
  quests: ['guide', 'strategies', 'community'],
  trust: ['community', 'rules', 'docs'],
  community: ['trust', 'quests', 'strategies'],
  resources: ['recipes', 'trade', 'glossary'],
  lore: ['manifesto', 'rebirth', 'seasons'],
  rules: ['trust', 'potato', 'start'],
  faq: ['glossary', 'docs', 'guide'],
  glossary: ['faq', 'docs', 'recipes'],
  roadmap: ['investors', 'seasons', 'lore'],
  investors: ['economy', 'roadmap', 'manifesto'],
  docs: ['glossary', 'faq', 'investors'],
};
export function CrossLinks({ id }: { id: string }) {
  const ids = relatedMap[id];
  if (!ids || ids.length === 0) return null;
  return (
    <Section title="Читай дальше">
      <div className="site-actions">
        {ids.map((rid) => {
          const p = xlPages.find((x) => x.id === rid);
          return p ? <Link key={rid} className="site-chip" to={'/site/' + rid}>{p.title} →</Link> : null;
        })}
      </div>
    </Section>
  );
}
