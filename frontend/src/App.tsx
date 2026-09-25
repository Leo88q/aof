import { Toast } from "./components/ui/Toast";
import React from "react";
import { NavProvider } from "./nav/NavContext";
import { TabPager } from "./nav/TabPager";
import { TabBar } from "./nav/TabBar";
import { AppWalletProvider } from "./wallet/WalletProvider";
import { useVipStatus } from "./lib/useVipStatus";
import { SceneBackdrop } from "./components/visual/SceneBackdrop";

// Импортируем наши существующие страницы
import { FarmDashboard } from "./pages/farm/FarmDashboard";
import { ToolsHome } from "./pages/tools/ToolsHome";
import { EconomyHome } from "./pages/economy";
import { MarketHome } from "./pages/market/MarketHome";
import { QuestsHome } from "./pages/quests/QuestsHome";
import { PrivilegesPage } from "./pages/PrivilegesPage";
import { ProfileHome } from "./pages/profile/ProfileHome";
import { FriendFarmPage } from "./pages/friend/FriendFarmPage";

const ROOTS = {
  // farm объединён с buildings (см. ниже)
  farm: { key: "root", el: <FarmDashboard /> },
  tools: { key: "root", el: <ToolsHome /> },
  economy: { key: "root", el: <EconomyHome /> },
  market: { key: "root", el: <MarketHome /> },
  quests: { key: "root", el: <QuestsHome /> },
  // portfolio перенесено внутрь ProfileHome
  // privileges перенесено внутрь ProfileHome
  profile: { key: "root", el: <ProfileHome /> },
};


// Глобальная загрузка VIP-статуса при подключении кошелька
function VipLoader() {
  useVipStatus();
  return null;
}

export default function App() {
  return (
    <AppWalletProvider>
      <VipLoader />
      <NavProvider tabs={["farm", "tools", "economy", "market", "quests", "profile"]} roots={ROOTS}>
        <div className="app-shell">
          <SceneBackdrop />
        <Toast />
          <TabPager />
          <TabBar />
        </div>
      </NavProvider>
    </AppWalletProvider>
  );
}
