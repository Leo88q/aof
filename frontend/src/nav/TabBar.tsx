import { useNav } from "./NavContext";
import { UI_ICONS } from "../lib/visualAssets";

const TABS = [
  { key: "farm", label: "Лаборатория", icon: UI_ICONS.menuLab },
  { key: "tools", label: "Мастерская", icon: UI_ICONS.menuWorkshop },
  { key: "economy", label: "Экономика", icon: UI_ICONS.menuEconomy },
  { key: "market", label: "Рынок", icon: UI_ICONS.menuMarket },
  { key: "quests", label: "Задания", icon: UI_ICONS.menuQuests },
  { key: "profile", label: "Профиль", icon: UI_ICONS.menuProfile },
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
            <span className="tab-icon">
              <img src={t.icon} alt="" width={22} height={22} style={{ objectFit: "contain", display: "block", margin: "0 auto" }} />
            </span>
            <span className="tab-label">{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export const TAB_KEYS = TABS.map((t) => t.key);
