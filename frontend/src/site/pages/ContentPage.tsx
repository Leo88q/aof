import { useState, useEffect } from 'react';
import { ExtraSections, CrossLinks } from './ExtraSections';
import { Link, useParams } from 'react-router-dom';
import { pages, resources, resourcesBySlug, categoryNames, mechanicsById } from '../content/game';
import {
  PageTitle, Section, Button, Counter, ParchmentCard, StatusBadge,
  CommitReveal, PackOpener, DrumInteract,
} from '../ui/Components';

const mechanicMap: Record<string, string[]> = {
  farm: ['farm', 'milling'], craft: ['craft'], fair: ['forge'],
  energy: ['energy'], tools: ['tools'], mine: ['mine', 'exploration'],
  weather: ['weather'], packs: ['packs'], lottery: ['lottery', 'drum'],
  market: ['marketplace', 'orderbook', 'auction', 'hot_market'],
  liquidity: ['liquidity'], rental: ['rental'], npc: ['npc'],
  seasons: ['seasons'], rebirth: ['rebirth'], quests: ['quests'],
  trust: ['trust'], community: ['social', 'collectors'], start: ['gas'],
};

export function ContentPage({ id }: { id: string }) {
  const page = pages.find(p => p.id === id);
  if (!page) return <NotFound />;
  const hero = id === 'home';
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('aof:visit', { detail: id }));
  }, [id]);
  return (
    <>
      <PageTitle eyebrow={hero ? 'AOF · Honest Craft Solarpunk' : page.group} title={page.title} lead={page.lead}>
        <div className="site-god-rays" aria-hidden="true"><i/><i/><i/></div>
        <div className="site-dust-motes" aria-hidden="true">{Array.from({ length: 20 }).map((_, i) => <span key={i} />)}</div>
      </PageTitle>
      {hero && (
        <div className="site-hero-actions">
          <Button to="/site/start">Начни знакомство</Button>
          <Button to="/site/manifesto" variant="ghost">Прочитай манифест</Button>
        </div>
      )}
      <Section>
        <div className="site-card site-paper">
          {page.paragraphs.map(p => <p key={p}>{p}</p>)}
        </div>
      </Section>

      {hero && (
        <>
          <Section title="Четыре числа, с которых стоит начать">
            <div className="site-grid site-grid--four">
              <Counter value={20} label="максимум энергии" />
              <Counter value={20} label="максимум прочности" />
              <Counter value={5} label="редкости инструмента" />
              <Counter value={5} label="тиров доверия" />
            </div>
          </Section>
          <Section title="Проверь обещание"><CommitReveal /></Section>
        </>
      )}

      {id === 'fair' && <Section title="Commit / Reveal"><CommitReveal /></Section>}
      {id === 'packs' && <Section title="Открой демонстрацию"><PackOpener /></Section>}
      {id === 'lottery' && (
        <>
          <Section title="Ритм без ставки"><DrumInteract /></Section>
          <Section title="Сверь запись"><CommitReveal /></Section>
        </>
      )}

      <ExtraSections id={id} />
      {(mechanicMap[id] || []).map(mid => {
        const m = mechanicsById.get(mid);
        return m ? (
          <Section key={mid} title={m.name + ' · порядок действий'}>
            <ol className="site-steps">
              {m.steps.map((step, i) => (
                <li key={step.title} className="site-paper">
                  <span className="site-step-number">{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.text}</p>
                    {step.instruction && <code>{step.instruction}</code>}
                  </div>
                </li>
              ))}
            </ol>
          </Section>
        ) : null;
      })}

      {!hero && <CrossLinks id={id} />}
      {!hero && (
        <Section>
          <div className="site-actions">
            <Button to="/site/start">К началу пути</Button>
            <Button to="/site/resources" variant="ghost">Сверь материал</Button>
          </div>
        </Section>
      )}
    </>
  );
}

export function ResourcesCatalog() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const list = resources.filter(r =>
    (category === 'all' || r.category === category) &&
    (r.name + ' ' + r.lead).toLowerCase().includes(query.toLowerCase())
  );
  return (
    <>
      <PageTitle eyebrow="Каталог" title={resources.length + ' ресурсов'} lead="Восемь категорий." />
      <Section>
        <div className="site-filters">
          <label>Поиск<input type="search" value={query} onChange={e => setQuery(e.target.value)} /></label>
          <label>Категория
            <select value={category} onChange={e => setCategory(e.target.value)}>
              <option value="all">Все</option>
              {Object.entries(categoryNames).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
            </select>
          </label>
        </div>
        <p role="status">Найдено: {list.length}</p>
        <div className="site-grid">
          {list.map(r => (
            <Link className="site-card site-paper" key={r.id} to={'/site/resources/' + r.slug}>
              <StatusBadge status={r.status} />
              <h2>{r.name}</h2>
              <p>{r.lead}</p>
              <span>{categoryNames[r.category]}</span>
            </Link>
          ))}
        </div>
      </Section>
    </>
  );
}

export function ResourceDetail() {
  const { slug } = useParams();
  const resource = slug ? resourcesBySlug.get(slug) : undefined;
  useEffect(() => {
    if (resource) window.dispatchEvent(new CustomEvent('aof:badge', { detail: 'resource' }));
  }, [resource]);
  if (!resource) return <NotFound />;
  return (
    <>
      <PageTitle eyebrow={categoryNames[resource.category]} title={resource.name} lead={resource.lead} />
      <Section>
        <StatusBadge status={resource.status} />
        {resource.description.map(p => <p key={p}>{p}</p>)}
      </Section>
      <Section>
        <div className="site-grid">
          <ParchmentCard><h2>Откуда берётся</h2><ul>{resource.sources.map(s => <li key={s}>{s}</li>)}</ul></ParchmentCard>
          <ParchmentCard><h2>Куда расходуется</h2><ul>{resource.sinks.map(s => <li key={s}>{s}</li>)}</ul></ParchmentCard>
        </div>
      </Section>
      <Section title="Связанные занятия">
        <div className="site-actions">
          {resource.relatedMechanics.map(mid => {
            const m = mechanicsById.get(mid);
            return m ? <Link className="site-chip" key={mid} to={'/site/' + mid}>{m.name}</Link> : null;
          })}
        </div>
      </Section>
      <Section>
        <div className="site-actions">
          <Button to="/site/resources">Весь каталог</Button>
        </div>
      </Section>
    </>
  );
}

export function NotFound() {
  return (
    <>
      <PageTitle eyebrow="404" title="Страницы нет в мастерской" lead="Проверь адрес." />
      <Section>
        <div className="site-actions">
          <Button to="/site/home">На главную</Button>
          <Button to="/site/resources" variant="ghost">Открой каталог</Button>
        </div>
      </Section>
    </>
  );
}
