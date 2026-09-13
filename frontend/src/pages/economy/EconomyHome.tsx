import React, { useState } from "react";
import { Pantry } from "./Pantry";
import { Workshop } from "./Workshop";
import { SeasonCalendar } from "./SeasonCalendar";
import { ResourceOverview } from "./ResourceOverview";

const SUB_TABS = [
  { key: "overview", label: "Обзор", icon: "📊" },
  { key: "pantry", label: "Кладовая", icon: "🏺" },
  { key: "workshop", label: "Мастерская", icon: "⚒️" },
  { key: "calendar", label: "Сезоны", icon: "📅" },
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
            <span className="sub-tab-icon">{t.icon}</span>
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
