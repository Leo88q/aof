import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import operator from './operator.json';
import { documents } from './documents';
import archive from './archive/2026-09-28.1.json';
import { gpcEnabled, initializePrivacy, readConsent, saveConsent } from './consent';
import './legal.css';

const storageRows = [
  ['nf:privacy-choice:v1', 'NeuroForge', 'Версия, время, категории и случайный ID записи выбора (не адрес кошелька)', '180 дней', 'Необходимая'],
  ['aof:site:journal:v1', 'NeuroForge', 'Локальные отметки чтения и значки', 'До отзыва / истечения выбора при следующем посещении', 'Функциональная'],
  ['aof_onboarded', 'NeuroForge', 'Отметка прохождения вводного экрана', 'До отзыва / истечения выбора при следующем посещении', 'Функциональная'],
  ['manor.sound / manor.motion', 'NeuroForge', 'Звук и анимация интерфейса', 'До отзыва / истечения выбора при следующем посещении', 'Функциональная'],
  ['walletName (wallet-adapter)', 'Библиотека кошелька', 'Имя выбранного кошелька, не seed и не приватный ключ', 'До очистки данных браузера; lifecycle проверить с кошельками', 'Функция подключения по запросу'],
];
export function LegalLinks() {
  return <nav aria-label="Правовые документы" className="legal-links">
    {documents.map(d => <Link key={d.slug} to={'/legal/' + d.slug}>{d.title}</Link>)}
    <Link to="/legal/contacts">Контакты и оператор</Link>
    <a href="/licenses/inter.txt">Лицензия Inter</a>
    <a href="/licenses/jetbrains-mono.txt">Лицензия JetBrains Mono</a>
    <a href="/licenses/playfair-display.txt">Лицензия Playfair Display</a>
  </nav>;
}
function Contact({ value, label }: { value: string; label: string }) {
  return <p><strong>{label}: </strong>{value ? <a href={'mailto:' + value}>{value}</a> : 'не указан — требуется до запуска'}</p>;
}
export function LegalPage() {
  const { slug, version } = useParams();
  const knownVersion = !version || version === archive.operator.version;
  const pageOperator = version ? archive.operator : operator;
  const doc = knownVersion ? (version ? archive.documents : documents).find(d => d.slug === slug) : undefined;
  const contacts = knownVersion && slug === 'contacts';
  const title = contacts ? 'Контакты и оператор' : doc?.title || 'Документ не найден';
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { document.title = title + ' · NeuroForge'; heading.current?.focus(); window.scrollTo(0, 0); }, [title]);
  return <div className="legal-area" lang="ru">
    <header className="legal-top"><Link to="/site/home">← Сайт NeuroForge</Link><Link to="/">Открыть приложение</Link></header>
    <main className="legal-document">
      <h1 ref={heading} tabIndex={-1}>{title}</h1>
      <p>Редакция {pageOperator.version} · {pageOperator.date}</p>
      {!pageOperator.approved && <aside className="legal-warning"><strong>Проект документа — не окончательная редакция.</strong> Реквизиты оператора, юрисдикции, процессоры и сроки серверного хранения ещё не утверждены. Публикация этой страницы не означает юридическую готовность проекта к запуску с реальными средствами.</aside>}
      {doc && <><p className="legal-lead">{doc.summary}</p>{doc.sections.map(section => <section key={section.title}><h2>{section.title}</h2>{section.paragraphs.map(p => <p key={p}>{p}</p>)}</section>)}</>}
      {!doc && !contacts && <p>Такой редакции здесь нет. Выберите документ в навигации ниже.</p>}
      {(contacts || (knownVersion && slug === 'privacy')) && <section><h2>Реквизиты и сведения оператора</h2>
        <dl>{[
          ['Оператор', pageOperator.operatorName], ['Адрес', pageOperator.operatorAddress], ['Страна оператора', pageOperator.operatorCountry],
          ['Регистрационные сведения', pageOperator.registrationDetails], ['Применимое право (для условий)', pageOperator.governingLaw],
          ['Обслуживаемые страны', pageOperator.audienceCountries.join(', ')], ['Процессоры / страны / цели', pageOperator.processors.join('; ')],
          ['Серверные сроки хранения и удаления', pageOperator.retentionPolicy], ['Гарантии международной передачи', pageOperator.transferSafeguards],
          ['DPO / представитель или обоснование неприменимости', pageOperator.privacyRepresentative],
          ['Официальный адрес сайта', pageOperator.canonicalOrigin],
        ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Не указано — требуется до запуска'}</dd></div>)}</dl>
        <Contact value={pageOperator.contactEmail} label="Поддержка, претензии и права на контент" />
        <Contact value={pageOperator.privacyEmail} label="Персональные данные" />
        <Contact value={pageOperator.securityEmail} label="Безопасность" />
      </section>}
      {knownVersion && slug === 'cookies' && <section><h2>Инвентаризация локального хранения</h2><div className="legal-table-wrap" tabIndex={0} role="region" aria-label="Таблица хранения, прокручивается горизонтально"><table><caption>Приложение, версия {pageOperator.version}; дополнительные cookies хостинга требуют live-проверки</caption><thead><tr>{['Имя', 'Провайдер', 'Назначение', 'Срок', 'Категория'].map(x => <th key={x} scope="col">{x}</th>)}</tr></thead><tbody>{storageRows.map(row => <tr key={row[0]}>{row.map((cell, i) => <td key={i}>{cell}</td>)}</tr>)}</tbody></table></div></section>}
      {version && <p>Архивная редакция: сведения ниже могут быть неактуальны. <Link to={'/legal/' + slug}>Текущий документ</Link></p>}
      {!version && doc && <p><Link to={'/legal/archive/' + archive.operator.version + '/' + doc.slug}>Архив: редакция {archive.operator.version} (проект)</Link></p>}
      <LegalLinks />
    </main>
  </div>;
}

// Non-modal: the visitor can keep reading or using the application after refusal.
export function PrivacyControls() {
  const [choice, setChoice] = useState(readConsent);
  const [open, setOpen] = useState(() => !readConsent());
  const [functional, setFunctional] = useState(() => readConsent()?.functional ?? false);
  const [notice, setNotice] = useState('');
  const gpc = gpcEnabled();
  const panel = useRef<HTMLDivElement>(null);
  const settingsButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const sync = () => {
      initializePrivacy();
      const current = readConsent(); setChoice(current); setFunctional(current?.functional ?? false);
      if (!current) setOpen(true);
    };
    window.addEventListener('storage', sync);
    window.addEventListener('focus', sync);
    return () => { window.removeEventListener('storage', sync); window.removeEventListener('focus', sync); };
  }, []);
  function save(allow: boolean) {
    const result = saveConsent(allow); setChoice(result.choice); setFunctional(result.choice.functional); setOpen(false);
    settingsButton.current?.focus();
    setNotice(result.persisted ? 'Выбор сохранён. Изменить или отозвать его можно здесь в любой момент.' : 'Браузер запретил сохранение. Выбор действует в памяти вкладки и может потребоваться снова.');
  }
  return <footer className="legal-area legal-footer" lang="ru">
    <p><strong>Никогда не вводите seed-фразу или приватный ключ.</strong> Токены и NFT не гарантируют доход. Перед подписью проверяйте сумму, получателя, комиссию и разрешения.</p>
    <LegalLinks />
    {!operator.approved && <p className="legal-draft-label">Правовые документы — проекты. Реквизиты оператора должны быть заполнены до production-релиза.</p>}
    <button ref={settingsButton} type="button" aria-expanded={open} aria-controls="privacy-controls" onClick={() => { setOpen(!open); if (!open) requestAnimationFrame(() => panel.current?.focus()); }}>Настройки cookies</button>
    <p role="status">{notice}</p>
    {open && <div ref={panel} tabIndex={-1} id="privacy-controls" className="legal-consent" role="region" aria-label="Выбор локального хранения">
      <h2>Ваш выбор хранения</h2>
      <p>Необходимая запись сохраняет только ваш выбор. Необязательные настройки и журнал сайта — только с разрешения. Аналитика и реклама здесь не подключены. Отказ не закрывает доступ к сайту.</p>
      <p><Link to="/legal/cookies">Состав и сроки хранения</Link> · <Link to="/legal/privacy">Конфиденциальность</Link></p>
      <label><input type="checkbox" checked disabled /> Необходимое хранение выбора</label>
      <label><input type="checkbox" checked={functional && !gpc} disabled={gpc} onChange={e => setFunctional(e.target.checked)} /> Функциональные настройки и журнал</label>
      <p>Аналитика: выключена. Маркетинг: выключен.</p>
      {gpc && <p>Получен Global Privacy Control: необязательное хранение выключено.</p>}
      <div className="legal-actions">
        <button type="button" onClick={() => save(true)} disabled={gpc}>Принять функциональные</button>
        <button type="button" onClick={() => save(false)}>Отклонить необязательные</button>
        <button type="button" onClick={() => save(functional)}>Сохранить выбор</button>
      </div>
      {choice && <p>Запись выбора: {choice.id}. Версия {choice.version}. Дата: {new Date(choice.timestamp).toLocaleDateString('ru-RU')}. Хранится в этом браузере, не является серверным журналом юридического согласия.</p>}
    </div>}
  </footer>;
}
