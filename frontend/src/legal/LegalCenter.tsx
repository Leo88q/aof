import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import operator from './operator.json';
import { useLocale } from '../i18n/LocaleProvider';
import { legalUiCopy } from '../i18n/legalUiCopy';
import { legalUnavailableCopy } from '../i18n/legalUnavailableCopy';
import { gpcEnabled, initializePrivacy, readConsent, saveConsent } from './consent';
import './legal.css';

export function LegalLinks() {
  const { language } = useLocale();
  const text = legalUiCopy[language];
  return <nav aria-label={text.nav} className="legal-links">
    <Link to="/legal/status">{legalUnavailableCopy[language].link}</Link>
    <a href="/licenses/inter.txt">{text.interLicense}</a>
    <a href="/licenses/jetbrains-mono.txt">{text.monoLicense}</a>
    <a href="/licenses/playfair-display.txt">{text.playfairLicense}</a>
  </nav>;
}
// Non-modal: the visitor can keep reading or using the application after refusal.
export function PrivacyControls() {
  const { language } = useLocale();
  const location = useLocation();
  const game = !location.pathname.startsWith('/site') && !location.pathname.startsWith('/legal') && location.pathname !== '/visual';
  const text = legalUiCopy[language];
  const [choice, setChoice] = useState(readConsent);
  // Две ступени: короткая полоса, пока выбора нет, и полная панель — только
  // когда игрок сам открыл настройки. Раньше на каждом входе разворачивалась
  // большая панель, и после подтверждения казалось, что выбор не сохранился.
  const [open, setOpen] = useState(false);
  const [ask, setAsk] = useState(() => !readConsent());
  const [functional, setFunctional] = useState(() => readConsent()?.functional ?? false);
  const [notice, setNotice] = useState<'' | 'savedLocal' | 'savedSession' | 'savedMemory'>('');
  const gpc = gpcEnabled();
  const panel = useRef<HTMLDivElement>(null);
  const settingsButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const sync = () => {
      initializePrivacy();
      const current = readConsent();
      setChoice(current); setFunctional(current?.functional ?? false);
      // Выбор есть — полоса больше не показывается ни при возврате на вкладку,
      // ни при синхронизации из другого окна.
      setAsk(!current);
    };
    const openFromProfile = () => { setAsk(false); openSettings(); };
    window.addEventListener('storage', sync);
    window.addEventListener('focus', sync);
    window.addEventListener('nf:privacy-change', sync);
    window.addEventListener('nf:open-privacy', openFromProfile);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('focus', sync);
      window.removeEventListener('nf:privacy-change', sync);
      window.removeEventListener('nf:open-privacy', openFromProfile);
    };
  }, []);
  function openSettings() {
    setOpen(true);
    requestAnimationFrame(() => panel.current?.focus());
  }
  function save(allow: boolean) {
    const result = saveConsent(allow);
    setChoice(result.choice); setFunctional(result.choice.functional);
    setOpen(false); setAsk(false);
    settingsButton.current?.focus();
    setNotice(result.mode === 'local' ? 'savedLocal' : result.mode === 'session' ? 'savedSession' : 'savedMemory');
  }
  if (game && !ask && !open) return null;
  if (game) return <div className="legal-area legal-game" lang={language}>
    {ask && !open && <div className="legal-consent legal-consent--ask" role="region" aria-label={text.choiceLabel}>
      <p>{text.banner}</p>
      <div className="legal-actions">
        <button type="button" onClick={() => save(true)} disabled={gpc}>{text.accept}</button>
        <button type="button" onClick={() => save(false)}>{text.necessaryOnly}</button>
      </div>
    </div>}
    {open && <div ref={panel} tabIndex={-1} id="privacy-controls" className="legal-consent" role="region" aria-label={text.choiceLabel}>
      <h2>{text.heading}</h2>
      <p>{text.details}</p>
      <p><Link to="/legal/cookies">{text.storageLink}</Link> · <Link to="/legal/privacy">{text.privacyLink}</Link></p>
      <label><input type="checkbox" checked disabled /> {text.necessary}</label>
      <label><input type="checkbox" checked={functional && !gpc} disabled={gpc} onChange={e => setFunctional(e.target.checked)} /> {text.functional}</label>
      <div className="legal-actions">
        <button type="button" onClick={() => save(false)}>{text.decline}</button>
        <button type="button" onClick={() => save(functional)}>{text.save}</button>
      </div>
    </div>}
  </div>;
  return <footer className="legal-area legal-footer" lang={language}>
    <p className="legal-safety">{text.safety}</p>
    <LegalLinks />
    {!operator.approved && <p className="legal-draft-label">{legalUnavailableCopy[language].notice}</p>}
    {ask && !open && <div className="legal-consent legal-consent--ask" role="region" aria-label={text.choiceLabel}>
      <p>{text.banner}</p>
      <div className="legal-actions">
        <button type="button" onClick={() => save(true)} disabled={gpc}>{text.accept}</button>
        <button type="button" onClick={() => save(false)}>{text.necessaryOnly}</button>
        <button type="button" onClick={openSettings}>{text.configure}</button>
      </div>
    </div>}
    <button ref={settingsButton} type="button" aria-expanded={open} aria-controls="privacy-controls" onClick={() => { if (open) setOpen(false); else openSettings(); }}>{text.settings}</button>
    <p role="status">{notice ? text[notice] : ''}</p>
    {open && <div ref={panel} tabIndex={-1} id="privacy-controls" className="legal-consent" role="region" aria-label={text.choiceLabel}>
      <h2>{text.heading}</h2>
      <p>{text.details}</p>
      <p><Link to="/legal/cookies">{text.storageLink}</Link> · <Link to="/legal/privacy">{text.privacyLink}</Link></p>
      <label><input type="checkbox" checked disabled /> {text.necessary}</label>
      <label><input type="checkbox" checked={functional && !gpc} disabled={gpc} onChange={e => setFunctional(e.target.checked)} /> {text.functional}</label>
      <p>{text.analytics}</p>
      {gpc && <p>{text.gpc}</p>}
      <div className="legal-actions">
        <button type="button" onClick={() => save(true)} disabled={gpc}>{text.accept}</button>
        <button type="button" onClick={() => save(false)}>{text.decline}</button>
        <button type="button" onClick={() => save(functional)}>{text.save}</button>
      </div>
      {choice && <p>{text.choiceRecord}: {choice.id}. {text.version} {choice.version}. {text.date}: {new Date(choice.timestamp).toLocaleDateString(language)}. {text.browserRecord}</p>}
    </div>}
  </footer>;
}
