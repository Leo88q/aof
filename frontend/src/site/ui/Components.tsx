import { type ReactNode, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll } from 'framer-motion';
import { useReducedMotionSite } from '../hooks/useReducedMotionSite';

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="site-eyebrow">{children}</p>;
}

export function PageTitle({ eyebrow, title, lead, children }: { eyebrow?: string; title: string; lead?: string; children?: ReactNode }) {
  return (
    <header className="site-title">
      {children}
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h1>{title}</h1>
      {lead && <p>{lead}</p>}
    </header>
  );
}

export function Section({ title, children }: { title?: string; children: ReactNode }) {
  const reduced = useReducedMotionSite();
  return (
    <motion.section className="site-section"
      initial={reduced ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.08 }}
      transition={{ duration: reduced ? 0 : 0.3 }}>
      {title && <h2>{title}</h2>}
      {children}
    </motion.section>
  );
}

export function ParchmentCard({ children }: { children: ReactNode }) {
  return <article className="site-card site-paper">{children}</article>;
}

export function StatusBadge({ status }: { status: 'live' | 'soon' }) {
  return <span className="site-badge">{status === 'live' ? 'Описано в спецификации' : 'Запланировано'}</span>;
}

export function Button({ children, to, onClick, variant = 'primary' }: {
  children: ReactNode; to?: string; onClick?: () => void; variant?: 'primary' | 'ghost';
}) {
  const cls = `site-button ${variant === 'ghost' ? 'site-button--ghost' : ''}`;
  if (to) return <Link to={to} className={cls}>{children}</Link>;
  return <button type="button" className={cls} onClick={onClick}>{children}</button>;
}

export function Counter({ value, label }: { value: number; label: string }) {
  return (
    <div className="site-stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

export function ScrollFlask() {
  const { scrollYProgress } = useScroll();
  const [value, setValue] = useState(0);
  useEffect(() => {
    return scrollYProgress.on('change', v => setValue(Math.round(v * 100)));
  }, [scrollYProgress]);
  return (
    <div className="site-scroll-flask" role="progressbar" aria-valuenow={value}>
      <motion.div style={{ scaleX: scrollYProgress }} />
      <span>{value}%</span>
    </div>
  );
}

function encodeUtf8(input: string) {
  const source = new TextEncoder().encode(input);
  const target = new Uint8Array(source.length);
  target.set(source);
  return target;
}

export function CommitReveal() {
  const [phase, setPhase] = useState<'idle' | 'committed' | 'revealed'>('idle');
  const [secret, setSecret] = useState('');
  const [commit, setCommit] = useState('');
  const [valid, setValid] = useState(false);

  const seal = async () => {
    const value = Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    const hash = await crypto.subtle.digest('SHA-256', encodeUtf8(value));
    const digest = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    setSecret(value);
    setCommit(digest);
    setPhase('committed');
  };

  const reveal = async () => {
    const hash = await crypto.subtle.digest('SHA-256', encodeUtf8(secret));
    const check = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    setValid(check === commit);
    window.dispatchEvent(new CustomEvent('aof:badge', { detail: 'commit' }));
    setPhase('revealed');
  };

  return (
    <div className="site-ritual site-paper">
      <h3>Запечатай запись. Затем проверь.</h3>
      <p>Локальное демо SHA-256, без транзакции.</p>
      {commit && <><h4>Хеш</h4><code className="site-hash">{commit}</code></>}
      {phase === 'revealed' && <><h4>Секрет</h4><code className="site-hash">{secret}</code></>}
      <p role="status">
        {phase === 'idle' && 'Done к проверке.'}
        {phase === 'committed' && 'Запись запечатана.'}
        {phase === 'revealed' && (valid ? 'Хеш совпал.' : 'Хеш не совпал.')}
      </p>
      <div className="site-actions">
        {phase === 'idle' && <Button onClick={seal}>Запечатать</Button>}
        {phase === 'committed' && <Button onClick={reveal}>Раскрыть и сверить</Button>}
        {phase === 'revealed' && <Button onClick={() => { setPhase('idle'); setSecret(''); setCommit(''); }}>Ещё раз</Button>}
      </div>
    </div>
  );
}

export function PackOpener() {
  const [size, setSize] = useState<'small' | 'medium' | 'big'>('medium');
  const [phase, setPhase] = useState<'sealed' | 'revealed'>('sealed');
  const [prize, setPrize] = useState('');
  const prizes = ['Мешочек семян', 'Связка дерева', 'Образец камня', 'Медная заготовка'];

  const open = () => {
    setPrize(prizes[Math.floor(Math.random() * prizes.length)]);
    window.dispatchEvent(new CustomEvent('aof:badge', { detail: 'pack' }));
    setPhase('revealed');
  };

  return (
    <div className="site-paper site-card">
      <p className="site-demo-label">Демо упаковки</p>
      <div className="site-options">
        {(['small', 'medium', 'big'] as const).map(s => (
          <label key={s}>
            <input type="radio" name="pack" checked={size === s} onChange={() => { setSize(s); setPhase('sealed'); }} />
            {s === 'small' ? ' Мешочек' : s === 'medium' ? ' Футляр' : ' Ящик'}
          </label>
        ))}
      </div>
      <p role="status">
        {phase === 'sealed' ? 'Упаковка закрыта.' : 'Открыто: ' + prize + '. Только демонстрация.'}
      </p>
      <div className="site-actions">
        {phase === 'sealed' ? <Button onClick={open}>Открыть демо</Button> : <Button onClick={() => setPhase('sealed')}>Ещё раз</Button>}
      </div>
    </div>
  );
}

export function DrumInteract() {
  const [result, setResult] = useState('');
  const strike = () => {
    const rhythms = ['Ритм поля', 'Ритм кузницы', 'Ритм мельницы'];
    setResult(rhythms[Math.floor(Math.random() * rhythms.length)]);
    window.dispatchEvent(new CustomEvent('aof:badge', { detail: 'drum' }));
  };
  return (
    <div className="site-paper site-ritual">
      <p className="site-demo-label">Безденежный ритуал</p>
      <h3>Почувствуй ритм мастерской</h3>
      <Button onClick={strike}>Ударить в барабан</Button>
      <p role="status">{result || 'Барабан ждёт первого удара.'}</p>
    </div>
  );
}
