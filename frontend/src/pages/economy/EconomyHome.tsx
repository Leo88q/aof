import React, { useState } from "react";
import { useLocale } from "../../i18n/LocaleProvider";
import { tradeNavigationCopy } from "../../i18n/tradeNavigationCopy";
import { Pantry } from "./Pantry";
import { Workshop } from "./Workshop";
import { SeasonCalendar } from "./SeasonCalendar";
import { ResourceOverview } from "./ResourceOverview";
import { UI_ICONS } from "../../lib/visualAssets";

const SUB_TABS = [
  { key: "overview", icon: UI_ICONS.economyOverview },
  { key: "pantry", icon: UI_ICONS.pantry },
  { key: "workshop", icon: UI_ICONS.economyWorkshop },
  { key: "calendar", icon: UI_ICONS.epochs },
] as const;

export function EconomyHome() {
  const { language } = useLocale();
  const copy = tradeNavigationCopy[language].economy;
  const [sub, setSub] = useState("overview");
  return (
    <div lang={language} className="economy-root">
      <div className="sub-tabs">
        {SUB_TABS.map((t) => (
          <button
            key={t.key}
            className={"sub-tab-btn" + (sub === t.key ? " active" : "")}
            onClick={() => setSub(t.key)}
            aria-pressed={sub === t.key}
          >
            <span className="sub-tab-icon">
              {t.icon.startsWith("/") ? (
                <img src={t.icon} alt="" width={16} height={16} style={{ objectFit: "contain", display: "block" }} />
              ) : t.icon}
            </span>
            <span>{copy[t.key]}</span>
          </button>
        ))}
      </div>
      <div className="sub-content">
        {sub === "overview" && <ResourceOverview />}
        {sub === "pantry" && <Pantry />}
        {sub === "workshop" && <Workshop />}
        {sub === "calendar" && <SeasonCalendar />}
      </div>
    </div>
  );
}
