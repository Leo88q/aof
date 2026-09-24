import { Fragment } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';
import {
  AOF_COLOR_NAMES, AOF_COLOR_VARS, AOF_DURATION_VARS, AOF_SHADOW_VARS, AOF_TOKENS,
  type AofDurationName, type AofShadowName,
} from '../tokens';
import './Foundation.css';
const durationNames = Object.keys(AOF_DURATION_VARS) as AofDurationName[];
const shadowNames = Object.keys(AOF_SHADOW_VARS) as AofShadowName[];
type RadiusName = keyof typeof AOF_TOKENS.radii;
export function Foundation() {
  const reducedMotion = useReducedMotion();
  return (
    <main className="aof-foundation" data-testid="aof-foundation">
      <section className="aof-foundation__paper">
        <h1>NeuroForge · Основание UI</h1>
        <p>Honest Craft Solarpunk. Стенд токенов, локальных шрифтов и доступности.</p>
        <h2>Палитра · {AOF_COLOR_NAMES.length} токенов</h2>
        <ul className="aof-foundation__palette">
          {AOF_COLOR_NAMES.map((name) => (
            <li key={name}>
              <div className="aof-foundation__swatch" data-color={name}
                   style={{ backgroundColor: AOF_TOKENS.colors[name] }} aria-hidden="true" />
              <code className="aof-foundation__name">{AOF_COLOR_VARS[name]}</code>
            </li>
          ))}
        </ul>
      </section>
      <section className="aof-foundation__paper">
        <h2>Шрифты · русский и английский</h2>
        <p className="aof-foundation__display">Playfair Display 600 · Мастерская / Workshop</p>
        <p className="aof-foundation__display-strong">Playfair Display 700 · Урожай / Harvest</p>
        <p>Inter 400 · Энергия восстановлена / Energy restored</p>
        <p className="aof-foundation__medium">Inter 500 · Сезонные награды / Season rewards</p>
        <p className="aof-foundation__strong">Inter 600 · Подтвердить действие / Confirm action</p>
        <p className="aof-foundation__mono">JetBrains Mono 500 · Durability 20/20 · 0123456789</p>
      </section>
      <section className="aof-foundation__paper">
        <h2>Тени</h2>
        <ul className="aof-foundation__shadows">
          {shadowNames.map((name) => (
            <li key={name} className="aof-foundation__shadow" data-shadow={name}
                style={{ boxShadow: AOF_TOKENS.shadows[name] }}>
              <code>{AOF_SHADOW_VARS[name]}</code>
            </li>
          ))}
        </ul>
      </section>
      <section className="aof-foundation__paper">
        <h2>Радиусы и сетка</h2>
        <p>Базовая единица: <code>{AOF_TOKENS.unit}px</code></p>
        <div className="aof-foundation__radius-list">
          {(Object.keys(AOF_TOKENS.radii) as RadiusName[]).map((name) => (
            <div key={name} className="aof-foundation__radius"
                 style={{ borderRadius: `var(--aof-radius-${name})` }}>
              <code>{name}: {AOF_TOKENS.radii[name]}px</code>
            </div>
          ))}
        </div>
      </section>
      <section className="aof-foundation__paper">
        <h2>Длительности</h2>
        <p role="status">Reduced motion: {reducedMotion ? 'включён' : 'выключен'}</p>
        <dl className="aof-foundation__definitions">
          {durationNames.map((name) => (
            <Fragment key={name}>
              <dt><code>{AOF_DURATION_VARS[name]}</code></dt>
              <dd>{reducedMotion ? 0 : AOF_TOKENS.durations[name]}ms</dd>
            </Fragment>
          ))}
        </dl>
      </section>
    </main>
  );
}
