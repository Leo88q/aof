import { Toast } from "./components/ui/Toast";
import React, { Suspense, useEffect } from "react";
import { Link } from "react-router-dom";
import { LanguageSwitcher, useLocale } from "./i18n/LocaleProvider";
import { gameNotices } from "./i18n/gameNotices";
import { gameMetaCopy } from "./i18n/gameMetaCopy";
import { setPageMetadata } from "./lib/pageMetadata";
import { NavProvider } from "./nav/NavContext";
import { TabPager } from "./nav/TabPager";
import { TabBar } from "./nav/TabBar";
import { TabFallback } from "./nav/TabFallback";
import { TAB_VIEWS } from "./nav/tabChunks";
import { useVipStatus } from "./lib/useVipStatus";
import { applyVipTheme } from "./lib/vipTheme";
import { SceneBackdrop } from "./components/visual/SceneBackdrop";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useWalletStore } from "./store/walletStore";

const V = TAB_VIEWS;

// Экраны вкладок приходят отдельными чанками (см. nav/tabChunks.ts).
const ROOTS = {
  // farm объединён с buildings (см. ниже)
  farm: {
    key: "root",
    el: (
      <Suspense fallback={<TabFallback label="farm" />}>
        <V.farm />
      </Suspense>
    ),
  },
  tools: {
    key: "root",
    el: (
      <Suspense fallback={<TabFallback label="tools" />}>
        <V.tools />
      </Suspense>
    ),
  },
  economy: {
    key: "root",
    el: (
      <Suspense fallback={<TabFallback label="economy" />}>
        <V.economy />
      </Suspense>
    ),
  },
  market: {
    key: "root",
    el: (
      <Suspense fallback={<TabFallback label="market" />}>
        <V.market />
      </Suspense>
    ),
  },
  quests: {
    key: "root",
    el: (
      <Suspense fallback={<TabFallback label="quests" />}>
        <V.quests />
      </Suspense>
    ),
  },
  // portfolio перенесено внутрь ProfileHome
  // privileges перенесено внутрь ProfileHome
  profile: {
    key: "root",
    el: (
      <Suspense fallback={<TabFallback label="profile" />}>
        <V.profile />
      </Suspense>
    ),
  },
};

// Глобальная загрузка VIP-статуса при подключении кошелька
function VipLoader() {
  const { user, reading, seasonId } = useVipStatus(true);
  const verifiedVip = reading?.owner === user && reading.kind === 'ready' && reading.snapshot?.isVip === true;
  useEffect(() => {
    applyVipTheme(user, seasonId ?? -1, verifiedVip);
    return () => applyVipTheme('', -1, false);
  }, [user, seasonId, verifiedVip]);
  return null;
}

export default function App() {
  const { language, t } = useLocale();
  useEffect(() => {
    setPageMetadata('NeuroForge — Age of Intelligence', gameMetaCopy[language], language);
  }, [language]);
  useEffect(() => {
    void useWalletStore.getState().reconnectSilently();
  }, []);
  return (
    <>
      <VipLoader />
      <NavProvider tabs={["farm", "tools", "economy", "market", "quests", "profile"]} roots={ROOTS}>
        <div className="app-shell" lang={language}>
          <SceneBackdrop />
          <header className="game-topbar" lang={language}>
            <span className="game-topbar__brand">NeuroForge <small>Age of Intelligence</small></span>
            <div className="game-topbar__tools"><Link to="/site/home" aria-label={t('siteMenu')}>{t('siteMenu')} <span aria-hidden="true">↗</span></Link><LanguageSwitcher compact /></div>
          </header>
          {language !== 'ru' && <p className="game-language-notice" lang={language}>{gameNotices[language]}</p>}
          <Toast />
          {/* Падение ленты вкладок раньше оставляло игрока с одним доком на
              чёрном экране без единого слова. Теперь сбой показывается словами,
              а док и шапка остаются живыми. */}
          <ErrorBoundary>
            <TabPager />
          </ErrorBoundary>
          <TabBar />
        </div>
      </NavProvider>
    </>
  );
}
