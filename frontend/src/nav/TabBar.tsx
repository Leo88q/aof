import { useNav } from "./NavContext";
import { UI_ICONS } from "../lib/visualAssets";
import { prefetchTab } from "./tabChunks";

const TABS = [
  { key: "farm", label: "Лаборатория", icon: UI_ICONS.menuLab },
  { key: "tools", label: "Мастерская", icon: UI_ICONS.menuWorkshop },
  { key: "economy", label: "Экономика", icon: UI_ICONS.menuEconomy },
  { key: "market", label: "Рынок", icon: UI_ICONS.menuMarket },
  { key: "quests", label: "Задания", icon: UI_ICONS.menuQuests },
  { key: "profile", label: "Профиль", icon: UI_ICONS.menuProfile },
];

/**
 * Нижняя навигация — плавающая капсула прибора, а не плоская панель на всю
 * ширину: активная вкладка подсвечена ровно одним источником света, подписи
 * обрезаются многоточием (см. .fg-dock__tab .tab-label в theme/forge.css).
 */
export function TabBar() {
  const { tab, setTab } = useNav();
  return (
    <nav className="fg-dockwrap" aria-label="Основная навигация">
      <div className="fg-dock">
        {TABS.map((t) => {
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              className={"fg-dock__tab" + (isActive ? " fg-dock__tab--on" : "")}
              onClick={() => setTab(t.key)}
              // Чанк вкладки догружаем заранее: переход не должен ждать сеть.
              onPointerEnter={() => prefetchTab(t.key)}
              onTouchStart={() => prefetchTab(t.key)}
              onFocus={() => prefetchTab(t.key)}
              aria-current={isActive ? "page" : undefined}
            >
              <img src={t.icon} alt="" width={16} height={16} />
              <span className="tab-label">{t.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export const TAB_KEYS = TABS.map((t) => t.key);
export const TAB_LABELS: Record<string, string> = Object.fromEntries(
  TABS.map((t) => [t.key, t.label])
);
