import { Toast } from "./components/ui/Toast";
import React, { Suspense } from "react";
import { Link } from "react-router-dom";
import { NavProvider } from "./nav/NavContext";
import { TabPager } from "./nav/TabPager";
import { TabBar, TAB_LABELS } from "./nav/TabBar";
import { TabFallback } from "./nav/TabFallback";
import { TAB_VIEWS } from "./nav/tabChunks";
import { useVipStatus } from "./lib/useVipStatus";
import { SceneBackdrop } from "./components/visual/SceneBackdrop";

const V = TAB_VIEWS;

// Экраны вкладок приходят отдельными чанками (см. nav/tabChunks.ts).
const ROOTS = {
  // farm объединён с buildings (см. ниже)
  farm: {
    key: "root",
    el: (
      <Suspense fallback={<TabFallback label={TAB_LABELS.farm} />}>
        <V.farm />
      </Suspense>
    ),
  },
  tools: {
    key: "root",
    el: (
      <Suspense fallback={<TabFallback label={TAB_LABELS.tools} />}>
        <V.tools />
      </Suspense>
    ),
  },
  economy: {
    key: "root",
    el: (
      <Suspense fallback={<TabFallback label={TAB_LABELS.economy} />}>
        <V.economy />
      </Suspense>
    ),
  },
  market: {
    key: "root",
    el: (
      <Suspense fallback={<TabFallback label={TAB_LABELS.market} />}>
        <V.market />
      </Suspense>
    ),
  },
  quests: {
    key: "root",
    el: (
      <Suspense fallback={<TabFallback label={TAB_LABELS.quests} />}>
        <V.quests />
      </Suspense>
    ),
  },
  // portfolio перенесено внутрь ProfileHome
  // privileges перенесено внутрь ProfileHome
  profile: {
    key: "root",
    el: (
      <Suspense fallback={<TabFallback label={TAB_LABELS.profile} />}>
        <V.profile />
      </Suspense>
    ),
  },
};

// Глобальная загрузка VIP-статуса при подключении кошелька
function VipLoader() {
  useVipStatus();
  return null;
}

export default function App() {
  return (
    <>
      <VipLoader />
      <NavProvider tabs={["farm", "tools", "economy", "market", "quests", "profile"]} roots={ROOTS}>
        <div className="app-shell">
          <SceneBackdrop />
          <nav aria-label="Безопасность и документы" className="legal-area" style={{ position: "relative", zIndex: 5, padding: "8px 16px" }}>
            <Link to="/legal/terms">Условия</Link> · <Link to="/legal/privacy">Конфиденциальность</Link> · <Link to="/legal/cookies">Cookies</Link>
          </nav>
        <Toast />
          <TabPager />
          <TabBar />
        </div>
      </NavProvider>
    </>
  );
}
