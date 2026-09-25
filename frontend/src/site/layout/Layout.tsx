import { useEffect as __seoEffect } from 'react';
import { useLocation as __seoLocation } from 'react-router-dom';
import { pages as __seoPages, resourcesBySlug as __seoRes } from '../content/game';
import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { pages } from '../content/pages';
import { ScrollFlask } from '../ui/Components';

const navGroups = [...new Set(pages.map(p => p.group))].map(title => ({
  title,
  items: pages.filter(p => p.group === title).map(p => ({ path: p.id, label: p.title })),
}));

export function SiteLayout() {
  const __seoLoc = __seoLocation();
  __seoEffect(() => {
    const parts = __seoLoc.pathname.split('/').filter(Boolean);
    const id = parts[1] || 'home';
    const res = parts[0] === 'site' && parts[1] === 'resources' ? __seoRes.get(parts[2]) : undefined;
    const page = __seoPages.find((p) => p.id === id);
    const title = res ? res.name + ' · NeuroForge' : page ? page.title + ' · NeuroForge' : 'NeuroForge';
    const desc = res ? res.lead : page ? page.lead : 'NeuroForge — AI development game on Solana. Grow neurons, train models, trade the future.';
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
  }, [__seoLoc.pathname]);
  const [mobile, setMobile] = useState(false);

  return (
    <div className="aof-ui aof-site" lang="ru">
      <a className="site-skip" href="#site-main">Перейти к содержимому</a>
      <header className="site-header">
        <div className="site-header-inner">
          <Link className="site-logo" to="/site/home">
            <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
              <defs>
                <linearGradient id="nf-logo-g" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00D4FF"/>
                  <stop offset="100%" stopColor="#9B59FF"/>
                </linearGradient>
              </defs>
              <circle cx="8" cy="8" r="2.5" fill="url(#nf-logo-g)" opacity="0.9"/>
              <circle cx="8" cy="24" r="2.5" fill="url(#nf-logo-g)" opacity="0.9"/>
              <circle cx="24" cy="8" r="2.5" fill="url(#nf-logo-g)" opacity="0.9"/>
              <circle cx="24" cy="24" r="2.5" fill="url(#nf-logo-g)" opacity="0.9"/>
              <circle cx="16" cy="16" r="3.5" fill="url(#nf-logo-g)"/>
              <line x1="8" y1="8" x2="16" y2="16" stroke="url(#nf-logo-g)" strokeWidth="1" opacity="0.5"/>
              <line x1="8" y1="24" x2="16" y2="16" stroke="url(#nf-logo-g)" strokeWidth="1" opacity="0.5"/>
              <line x1="24" y1="8" x2="16" y2="16" stroke="url(#nf-logo-g)" strokeWidth="1" opacity="0.5"/>
              <line x1="24" y1="24" x2="16" y2="16" stroke="url(#nf-logo-g)" strokeWidth="1" opacity="0.5"/>
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
            <button className="site-small-button" type="button" aria-expanded={mobile} onClick={() => setMobile(!mobile)}>Меню</button>
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
          <p>NeuroForge — AI development game on Solana.</p>
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
