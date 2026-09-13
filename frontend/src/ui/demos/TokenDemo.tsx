import { useState } from 'react';
import './TokenDemo.css';
export interface TokenDemoProps {
  material?: 'parchment' | 'oak';
  title?: string;
  description?: string;
}
export function TokenDemo({
  material = 'parchment',
  title = 'Записи мастерской',
  description = 'Дуб, медь и бумага. Ничего лишнего.',
}: TokenDemoProps) {
  const [inspected, setInspected] = useState(false);
  return (
    <main className="aof-token-demo-page">
      <article className={`aof-token-demo aof-token-demo--${material}`}>
        <span className="aof-token-demo__fastener" aria-hidden="true" />
        <p className="aof-token-demo__eyebrow">AOF · МАТЕРИАЛЬНЫЙ СТЕНД</p>
        <h1>{title}</h1>
        <p>{description}</p>
        <dl className="aof-token-demo__stats">
          <div><dt>Энергия</dt><dd>65 / 100</dd></div>
          <div><dt>Прочность</dt><dd>20 / 20</dd></div>
        </dl>
        <button className="aof-token-demo__action" type="button"
                aria-pressed={inspected}
                onClick={() => setInspected((v) => !v)}>
          Проверено мастером
        </button>
        <p className="aof-token-demo__status" role="status">
          {inspected ? 'Отметка поставлена.' : 'Ожидает осмотра.'}
        </p>
      </article>
    </main>
  );
}
