import { useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { setPageMetadata } from '../lib/pageMetadata';
import { LegalLinks } from './LegalCenter';
import { LanguageSwitcher, useLocale } from '../i18n/LocaleProvider';
import { legalPageCopy } from '../i18n/legalPageCopy';
import { legalStorageCopy } from '../i18n/legalStorageCopy';
import { legalUnavailableCopy } from '../i18n/legalUnavailableCopy';
import type { Language } from '../i18n/translations';
import './legal.css';

function storageRows(language: Language): string[][] {
  const { purposes: purpose, periods: period, categories: category, walletProvider } = legalStorageCopy[language];
  return [
    ['nf:privacy-choice:v1', 'NeuroForge', purpose[0], period[0], category[0]],
    ['aof:site:journal:v1', 'NeuroForge', purpose[1], period[1], category[1]],
    ['aof_onboarded', 'NeuroForge', purpose[2], period[1], category[1]],
    ['aof:language', 'NeuroForge', purpose[3], period[1], category[1]],
    ['manor.sound / manor.motion', 'NeuroForge', purpose[4], period[1], category[1]],
    ['walletName (wallet-adapter)', walletProvider, purpose[5], period[2], category[2]],
  ];
}

/** No former draft or archive is rendered. Keep a visible unavailable notice
 * and the factual local-storage inventory rather than implying incognito mode
 * supplies privacy, legal approval or an operator identity. */
export function LegalPage() {
  const { language } = useLocale();
  const text = legalPageCopy[language];
  const copy = legalUnavailableCopy[language];
  const { slug, version } = useParams();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    setPageMetadata(`${copy.title} · NeuroForge`, `${copy.notice} ${copy.visibility}`, language);
    heading.current?.focus();
    window.scrollTo(0, 0);
  }, [copy, language]);
  return <div className="legal-area" lang={language}>
    <header className="legal-top"><Link to="/site/home">← {text.site}</Link><Link to="/">{text.app}</Link><LanguageSwitcher compact /></header>
    <main className="legal-document">
      <h1 ref={heading} tabIndex={-1}>{copy.title}</h1>
      {version && <p role="status">{copy.archive}</p>}
      <aside className="legal-warning" role="alert">{copy.notice}</aside>
      <p>{copy.visibility}</p>
      {!version && slug === 'cookies' && <section>
        <h2>{copy.storage}</h2>
        <div className="legal-table-wrap" tabIndex={0} role="region" aria-label={text.tableRegion}>
          <table>
            <caption>{text.tableCaption}</caption>
            <thead><tr>{[text.name, text.provider, text.purpose, text.period, text.category].map(x => <th key={x} scope="col">{x}</th>)}</tr></thead>
            <tbody>{storageRows(language).map(row => <tr key={row[0]}>{row.map((cell, i) => <td key={i}>{cell}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </section>}
      <LegalLinks />
    </main>
  </div>;
}
