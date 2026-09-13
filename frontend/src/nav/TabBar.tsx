import React from "react";
import { useNav } from "./NavContext";

// Наши 5 вкладок (игровая структура)
const TABS: { key: string; label: string; icon: string }[] = [
  { key: "farm", label: "Ферма", icon: "🏡" },
  { key: "tools", label: "Инструменты", icon: "🛠️" },
  { key: "economy", label: "Экономика", icon: "🌾" },
  { key: "market", label: "Рынок", icon: "📈" },
  { key: "quests", label: "Задания", icon: "⭐" },
  { key: "profile", label: "Профиль", icon: "👤" },
];

export function TabBar() {
  const { tab, setTab } = useNav();
  return (
    <div className="tabbar">
      {TABS.map((t) => (
        <button
          key={t.key}
          className={"tab-btn" + (tab === t.key ? " active" : "")}
          onClick={() => setTab(t.key)}
        >
          <span className="tab-icon">{t.icon}</span>
          <span className="tab-label">{t.label}</span>
        </button>
      ))}
    </div>
  );
}

export const TAB_KEYS = TABS.map((t) => t.key);
