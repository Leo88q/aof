import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { pages as seoPages, resourcesBySlug as seoResources } from '../content/game';
import { pages } from '../content/pages';
import { ScrollFlask } from '../ui/Components';

const navGroups = [...new Set(pages.map(p => p.group))].map(title => ({
  title,
  items: pages.filter(p => p.group === title).map(p => ({ path: p.id, label: p.title })),
}));

export function SiteLayout() {
  const location = useLocation();
  // Переход по ссылке с длинной страницы оставлял окно на прежнем месте: новая
  // страница открывалась своей серединой или подвалом. Теперь маршрут меняется —
  // окно возвращается наверх, а фокус уходит в содержимое (для чтения с экрана).
  useEffect(() => {
    if (window.location.hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.getElementById('site-main')?.focus?.({ preventScroll: true });
  }, [location.pathname]);
  useEffect(() => {
    const parts = location.pathname.split('/').filter(Boolean);
    const id = parts[1] || 'home';
    const res = parts[0] === 'site' && parts[1] === 'resources' ? seoResources.get(parts[2]) : undefined;
    const page = seoPages.find((p) => p.id === id);
    const title = res ? res.name + ' · NeuroForge' : page ? page.title + ' · NeuroForge' : 'NeuroForge';
    const desc = res
      ? res.lead
      : page
        ? page.lead
        : 'NeuroForge — лаборатория-RPG на Solana: культивируй образцы, обучай модели, собирай инструменты и торгуй на рынке.';
    document.title = title;
    const setMeta = (attr: string, key: string, content: string) => {
      let el = document.querySelector<HTMLMetaElement>('meta[' + attr + '="' + key + '"]');
      if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
      el.setAttribute('content', content);
    };
    setMeta('name', 'description', desc);
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', desc);
    setMeta('property', 'og:type', 'website');
    setMeta('property', 'og:locale', 'ru_RU');
  }, [location.pathname]);
  const [mobile, setMobile] = useState(false);

  return (
    <div className="aof-ui aof-site" lang="ru">
      <a className="site-skip" href="#site-main">Перейти к содержимому</a>
      <header className="site-header">
        <div className="site-header-inner">
          <Link className="site-logo" to="/site/home">
            {/* Знак — манометр лаборатории: корпус, шкала и стрелка. Прибор читается
                как оборудование и не повторяет нейро-декор из ранних макетов. */}
            <svg width="30" height="30" viewBox="0 0 32 32" role="img" aria-label="NeuroForge">
              <circle cx="16" cy="16" r="12" fill="none" stroke="var(--sb-cyan)" strokeWidth="2" />
              <circle cx="16" cy="16" r="8.5" fill="none" stroke="var(--sb-line)" strokeWidth="1" />
              <path d="M16 4.5v3M16 24.5v3M4.5 16h3M24.5 16h3" stroke="var(--sb-cyan-2)" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M16 16l6.2-4.4" stroke="var(--sb-gold)" strokeWidth="2" strokeLinecap="round" />
              <circle cx="16" cy="16" r="1.8" fill="var(--sb-cyan-2)" />
            </svg>
            <span>NeuroForge<span className="site-logo-sub">Age of Intelligence</span></span>
          </Link>
          <nav className="site-desktop-nav" aria-label="Основная">
            {navGroups.map(g => (
              <details key={g.title}>
                <summary>{g.title}</summary>
                <div className="site-nav-panel">
                  {g.items.map(it => (
                    <NavLink key={it.path} to={'/site/' + it.path}>{it.label}</NavLink>
                  ))}
                </div>
              </details>
            ))}
          </nav>
          <div className="site-header-tools">
            <ScrollFlask />
            <button className="site-small-button site-menu-toggle" type="button" aria-expanded={mobile} onClick={() => setMobile(!mobile)}>Меню</button>
          </div>
        </div>
        {mobile && (
          <div className="site-mobile-menu">
            {navGroups.map(g => (
              <section key={g.title}>
                <h2>{g.title}</h2>
                <ul>
                  {g.items.map(it => (
                    <li key={it.path}>
                      <NavLink to={'/site/' + it.path} onClick={() => setMobile(false)}>{it.label}</NavLink>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </header>
      <main id="site-main" className="site-main" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="site-footer-intro">
          <h2>Создавай модели. Торгуй интеллектом.</h2>
          <p>NeuroForge — лаборатория-RPG на Solana: образцы, модели, инструменты и рынок.</p>
        </div>
        <div className="site-footer-grid">
          {navGroups.map(g => (
            <nav key={g.title} aria-label={g.title}>
              <h3>{g.title}</h3>
              <ul>{g.items.map(it => <li key={it.path}><Link to={'/site/' + it.path}>{it.label}</Link></li>)}</ul>
            </nav>
          ))}
        </div>
        <div className="site-footer-bottom">
          <span>NeuroForge · {new Date().getFullYear()}</span>
          <Link to="/site/rules">Правила</Link>
        </div>
      </footer>
    </div>
  );
}
