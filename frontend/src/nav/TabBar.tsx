import React from "react";
import { useNav } from "./NavContext";
import { 
  FarmIcon, 
  ToolsIcon, 
  EconomyIcon, 
  MarketIcon, 
  QuestsIcon, 
  ProfileIcon 
} from "../components/ui/Icons";

// 6 основных вкладок игры
const TABS: { key: string; label: string; icon: React.ReactNode }[] = [
  { key: "farm", label: "Лаборатория", icon: <FarmIcon size={20} /> },
  { key: "tools", label: "Мастерская", icon: <ToolsIcon size={20} /> },
  { key: "economy", label: "Экономика", icon: <EconomyIcon size={20} /> },
  { key: "market", label: "Рынок", icon: <MarketIcon size={20} /> },
  { key: "quests", label: "Задания", icon: <QuestsIcon size={20} /> },
  { key: "profile", label: "Профиль", icon: <ProfileIcon size={20} /> },
];

export function TabBar() {
  const { tab, setTab } = useNav();
  return (
    <nav className="tabbar" aria-label="Основная навигация">
      {TABS.map((t) => {
        const isActive = tab === t.key;
        return (
          <button
            key={t.key}
            type="button"
            className={"tab-btn" + (isActive ? " active" : "")}
            onClick={() => setTab(t.key)}
            aria-current={isActive ? "page" : undefined}
          >
            <span className="tab-icon">{t.icon}</span>
            <span className="tab-label">{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export const TAB_KEYS = TABS.map((t) => t.key);
