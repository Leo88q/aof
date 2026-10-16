/**
 * Read-only organism view (phase 1). Loaded lazily behind VITE_ORGANISM_VIEW.
 * Polls the same endpoints as the laboratory panels, derives a state with the
 * pure model, and draws it with three.js. Nothing here sends a transaction.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import { readEconomyBalances } from '../lib/economyBalances';
import { fmtNum } from '../lib/marketUtils';
import { useLocale } from '../i18n/LocaleProvider';
import { organismCopy } from '../i18n/organismCopy';
import { homeResourceNames, type ResourceId } from '../i18n/homeDetail';
import { deriveOrganism, toNumber, type OrganismInput } from './model';
import { ORGANS, ORGAN_IDS, type OrganId } from './registry';
import { createOrganismScene, type OrganismScene } from './scene';

const POLL_MS = 10_000;
const CLOCK_MS = 1_000;

/** clockOffsetSec = chain time − local time, measured when the lab response arrived. */
type Snapshot = OrganismInput & { loaded: boolean; failed: boolean; clockOffsetSec: number };

const EMPTY_SNAPSHOT: Snapshot = { balances: null, tiles: null, tools: null, energy: null, loaded: false, failed: false, clockOffsetSec: 0 };

export default function OrganismView({ owner }: { owner: string | null }) {
  const { language } = useLocale();
  const copy = organismCopy[language];
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY_SNAPSHOT);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [webgl, setWebgl] = useState(true);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<OrganismScene | null>(null);

  // Poll the same sources the laboratory panels already use.
  useEffect(() => {
    if (!owner) {
      setSnapshot(EMPTY_SNAPSHOT);
      return;
    }
    let alive = true;
    const load = async () => {
      const [b, t, m, e] = await Promise.allSettled([
        api.query.balances(owner),
        api.query.labTiles(owner),
        api.query.myTools(owner),
        api.energy.balance(owner),
      ]);
      if (!alive) return;
      const balances = b.status === 'fulfilled' ? readEconomyBalances(b.value) : null;
      const tiles = t.status === 'fulfilled' && Array.isArray((t.value as { tiles?: unknown })?.tiles)
        ? ((t.value as { tiles: unknown[] }).tiles)
        : null;
      const tools = m.status === 'fulfilled' && Array.isArray(m.value) ? (m.value as unknown[]) : null;
      const energy = e.status === 'fulfilled' && e.value && typeof e.value === 'object'
        ? (e.value as { amount?: unknown; cap?: unknown })
        : null;
      // Convert the browser clock into chain time using the server's serverNow.
      const serverNow = t.status === 'fulfilled' ? toNumber((t.value as { serverNow?: unknown })?.serverNow) : null;
      const clockOffsetSec = serverNow !== null ? serverNow - Date.now() / 1000 : 0;
      setSnapshot({ balances, tiles, tools, energy, loaded: true, failed: !balances && !tiles && !tools && !energy, clockOffsetSec });
    };
    load();
    const id = window.setInterval(load, POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [owner]);

  // Clock for mining timers; the chain stays the source of truth.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), CLOCK_MS);
    return () => window.clearInterval(id);
  }, []);

  // Chain time: local clock plus the offset measured on the last lab response.
  const chainNow = now + snapshot.clockOffsetSec;
  const state = useMemo(() => deriveOrganism(snapshot, chainNow), [snapshot, chainNow]);

  // Scene lifecycle: create once per mount, dispose on unmount.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    try {
      sceneRef.current = createOrganismScene(container);
    } catch {
      setWebgl(false);
      sceneRef.current = null;
    }
    return () => {
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setState(state);
  }, [state]);

  const resourceName = (id: string) => homeResourceNames[language][id as ResourceId] ?? id;
  const amountText = (v: number | null) => (v === null ? copy.unknown : fmtNum(v, language));

  if (!owner) {
    return (
      <section className="organism-view" aria-label={copy.title}>
        <h2>{copy.title}</h2>
        <p>{copy.disconnected}</p>
      </section>
    );
  }

  return (
    <section className="organism-view" aria-label={copy.title}>
      <h2>{copy.title}</h2>
      <p>{copy.subtitle}</p>
      <p><small>{copy.phaseNote}</small></p>
      {snapshot.failed && <p role="status">{copy.unavailable}</p>}
      {!snapshot.loaded && <p role="status">{copy.loading}</p>}
      {webgl ? (
        <div ref={containerRef} className="organism-canvas" style={{ width: '100%', height: 360 }} />
      ) : (
        <p role="status">{copy.webglMissing}</p>
      )}
      <div className="organism-lists">
        <h3>{copy.heart}</h3>
        <p>
          {state.heart.known ? `${amountText(state.heart.amount)}${state.heart.cap ? ` / ${fmtNum(state.heart.cap, language)}` : ''}` : copy.unknown}
        </p>

        <h3>{copy.body}</h3>
        <ol>
          {state.cells.map((c) => (
            <li key={c.index}>{copy.cell[c.state]}{c.state === 'growing' ? ` ${Math.round(c.progress * 100)}%` : ''}</li>
          ))}
        </ol>

        <h3>{copy.limbs}</h3>
        <ul>
          {state.docks.map((d) => (
            <li key={d.toolType}>
              {d.toolType}: {d.owned === null ? copy.dock.unknownTools : `${copy.dock.owned} ${d.owned}`}
              {d.owned !== null && d.owned > 0 ? `, ${copy.dock.working} ${d.working}` : ''}
              {d.bestRarity ? ` (${d.bestRarity})` : ''}
            </li>
          ))}
        </ul>

        <h3>{copy.organs}</h3>
        {ORGAN_IDS.map((organId: OrganId) => {
          const organ = state.organs.find((o) => o.id === organId);
          const names = ORGANS.find((o) => o.id === organId)?.resources ?? [];
          return (
            <div key={organId}>
              <h4>{copy.organNames[organId]}</h4>
              <ul>
                {names.map((id) => {
                  const r = organ?.resources.find((x) => x.id === id);
                  return <li key={id}>{resourceName(id)}: {amountText(r?.amount ?? null)}</li>;
                })}
              </ul>
            </div>
          );
        })}

        <h3>{copy.soulCore}</h3>
        <p>
          {amountText(state.soulCore.amount)} · {copy.soulCoreNote}
        </p>
      </div>
    </section>
  );
}
