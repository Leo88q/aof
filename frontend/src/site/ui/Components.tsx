import { type ReactNode, useState, useEffect } from 'react';
import { useLocale } from '../../i18n/LocaleProvider';
import { commitLabels } from '../../i18n/commitLabels';
import { siteChanceCopy } from '../../i18n/siteChanceCopy';
import { resourceCatalogCopy } from '../../i18n/resourceCatalogCopy';
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
  const { language } = useLocale();
  return <span className="site-badge">{resourceCatalogCopy[language][status]}</span>;
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
  const { language } = useLocale();
  const copy = commitLabels[language];
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
      <h3>{copy.heading}</h3>
      <p>{copy.summary}</p>
      {commit && <><h4>{copy.hash}</h4><code className="site-hash">{commit}</code></>}
      {phase === 'revealed' && <><h4>{copy.secret}</h4><code className="site-hash">{secret}</code></>}
      <p role="status">
        {phase === 'idle' && copy.idle}
        {phase === 'committed' && copy.committed}
        {phase === 'revealed' && (valid ? copy.valid : copy.invalid)}
      </p>
      <div className="site-actions">
        {phase === 'idle' && <Button onClick={seal}>{copy.seal}</Button>}
        {phase === 'committed' && <Button onClick={reveal}>{copy.reveal}</Button>}
        {phase === 'revealed' && <Button onClick={() => { setPhase('idle'); setSecret(''); setCommit(''); }}>{copy.again}</Button>}
      </div>
    </div>
  );
}

export function PackOpener() {
  const { language } = useLocale();
  const copy = siteChanceCopy[language].packDemo;
  const [size, setSize] = useState<'small' | 'medium' | 'big'>('medium');
  const [sample, setSample] = useState<number | null>(null);
  const open = () => {
    setSample(Math.floor(Math.random() * copy.samples.length));
    window.dispatchEvent(new CustomEvent('aof:badge', { detail: 'pack' }));
  };
  return (
    <div className="site-paper site-card min-w-0 [overflow-wrap:anywhere]">
      <p className="site-demo-label">{copy.label}</p>
      <p>{copy.hint}</p>
      <fieldset className="site-options">
        <legend>{copy.sizeLegend}</legend>
        {(['small', 'medium', 'big'] as const).map((s, i) => (
          <label key={s}>
            <input type="radio" name="pack" checked={size === s} onChange={() => { setSize(s); setSample(null); }} />
            {copy.sizes[i]}
          </label>
        ))}
      </fieldset>
      <p role="status">{sample === null ? copy.sealed : copy.opened(copy.samples[sample])}</p>
      <div className="site-actions">
        {sample === null ? <Button onClick={open}>{copy.open}</Button> : <Button onClick={() => setSample(null)}>{copy.again}</Button>}
      </div>
    </div>
  );
}

export function DrumInteract() {
  const { language } = useLocale();
  const copy = siteChanceCopy[language].drumDemo;
  const [result, setResult] = useState<number | null>(null);
  const strike = () => {
    setResult(Math.floor(Math.random() * copy.rhythms.length));
    window.dispatchEvent(new CustomEvent('aof:badge', { detail: 'drum' }));
  };
  return (
    <div className="site-paper site-ritual min-w-0 [overflow-wrap:anywhere]">
      <p className="site-demo-label">{copy.label}</p>
      <h3>{copy.heading}</h3>
      <p>{copy.hint}</p>
      <div className="site-actions"><Button onClick={strike}>{copy.strike}</Button></div>
      <p role="status">{result === null ? copy.idle : copy.rhythms[result]}</p>
    </div>
  );
}
