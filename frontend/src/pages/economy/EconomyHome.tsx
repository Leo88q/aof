import React, { useState } from "react";
import { Pantry } from "./Pantry";
import { Workshop } from "./Workshop";
import { SeasonCalendar } from "./SeasonCalendar";
import { ResourceOverview } from "./ResourceOverview";
import { UI_ICONS } from "../../lib/visualAssets";

const SUB_TABS = [
  { key: "overview", label: "Обзор", icon: UI_ICONS.economyOverview },
  { key: "pantry", label: "Кладовая", icon: UI_ICONS.pantry },
  { key: "workshop", label: "Мастерская", icon: UI_ICONS.economyWorkshop },
  { key: "calendar", label: "Эпохи", icon: UI_ICONS.epochs },
];

export function EconomyHome() {
  const [sub, setSub] = useState("overview");
  return (
    <div className="economy-root">
      <div className="sub-tabs">
        {SUB_TABS.map((t) => (
          <button
            key={t.key}
            className={"sub-tab-btn" + (sub === t.key ? " active" : "")}
            onClick={() => setSub(t.key)}
          >
            <span className="sub-tab-icon">
              {t.icon.startsWith("/") ? (
                <img src={t.icon} alt="" width={16} height={16} style={{ objectFit: "contain", display: "block" }} />
              ) : t.icon}
            </span>
            <span>{t.label}</span>
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
