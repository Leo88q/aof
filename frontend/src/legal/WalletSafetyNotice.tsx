import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLocale } from '../i18n/LocaleProvider';
import { walletCopy } from '../i18n/walletCopy';
import { legalUnavailableCopy } from '../i18n/legalUnavailableCopy';

export function WalletSafetyNotice({ onContinue, onCancel }: { onContinue: () => void; onCancel: () => void }) {
  const { language } = useLocale();
  const copy = walletCopy[language];
  const [understood, setUnderstood] = useState(false);
  return <section lang={language} className="legal-area wallet-safety min-w-0 max-w-full [overflow-wrap:anywhere]" aria-label={copy.safetyTitle}>
    <h2>{copy.safetyTitle}</h2>
    <p>{copy.seedWarning}</p>
    <p>{copy.signatureWarning}</p>
    <p><Link to="/legal/status">{legalUnavailableCopy[language].link}</Link></p>
    <label><input type="checkbox" checked={understood} onChange={e => setUnderstood(e.target.checked)} />{copy.acknowledge}</label>
    <p>{copy.disclaimer}</p>
    <div className="legal-actions"><button type="button" disabled={!understood} onClick={onContinue}>{copy.continue}</button>
      <button type="button" onClick={onCancel}>{copy.cancel}</button></div>
  </section>;
}
