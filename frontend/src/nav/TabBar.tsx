import { useNav } from "./NavContext";
import { useLocale } from "../i18n/LocaleProvider";
import { gameTabs, type GameTab } from "../i18n/gameLabels";
import { UI_ICONS } from "../lib/visualAssets";
import { prefetchTab } from "./tabChunks";

const TABS = [
  { key: "farm", icon: UI_ICONS.menuLab },
  { key: "tools", icon: UI_ICONS.menuWorkshop },
  { key: "economy", icon: UI_ICONS.menuEconomy },
  { key: "market", icon: UI_ICONS.menuMarket },
  { key: "quests", icon: UI_ICONS.menuQuests },
  { key: "profile", icon: UI_ICONS.menuProfile },
];

/**
 * Нижняя навигация — плавающая капсула прибора, а не плоская панель на всю
 * ширину: активная вкладка подсвечена ровно одним источником света, подписи
 * обрезаются многоточием (см. .fg-dock__tab .tab-label в theme/forge.css).
 */
export function TabBar() {
  const { tab, setTab } = useNav();
  const { language, t } = useLocale();
  return (
    <nav className="fg-dockwrap" lang={language} aria-label={t('nav')}>
      <div className="fg-dock">
        {TABS.map((t) => {
          const isActive = tab === t.key;
          const label = gameTabs[language][t.key as GameTab];
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
              aria-label={label.full}
            >
              <img src={t.icon} alt="" width={16} height={16} />
              <span className="tab-label tab-label--full" aria-hidden="true">{label.full}</span>
              <span className="tab-label tab-label--short" aria-hidden="true">{label.short}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export const TAB_KEYS = TABS.map((t) => t.key);
