import React, { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useWalletStore } from "../../store/walletStore";

const FILTERS = [
  {
    key: "raw",
    label: "Сырьё",
    icon: "🪨",
    items: [
      { key: "STONE_BLUE", label: "Сапфир", icon: "🔵" },
      { key: "STONE_PURPLE", label: "Аметист", icon: "🟣" },
      { key: "STONE_RED", label: "Рубин", icon: "🔴" },
      { key: "SAND_WHITE", label: "Кварцевый песок", icon: "⚪" },
      { key: "SAND_PINK", label: "Розовый песок", icon: "💗" },
      { key: "SAND_YELLOW", label: "Янтарный песок", icon: "🟡" },
      { key: "COAL", label: "Уголь", icon: "⬛" },
      { key: "MEAT", label: "Мясо", icon: "🍖" },
      { key: "POTATO", label: "POTATO", icon: "🥔" },
    ],
  },
  {
    key: "materials",
    label: "Материалы",
    icon: "💎",
    items: [
      { key: "GEM_BLUE", label: "Сапфировый гем", icon: "💎" },
      { key: "GEM_ORANGE", label: "Янтарный гем", icon: "🟠" },
      { key: "GEM_WHITE", label: "Кварцевый гем", icon: "⚪" },
      { key: "GEM_GREEN", label: "Изумрудный гем", icon: "🟢" },
      { key: "WHEAT", label: "Пшеница", icon: "🌾" },
      { key: "FLOUR", label: "Мука", icon: "🥣" },
    ],
  },
  {
    key: "flasks",
    label: "Баночки",
    icon: "🧪",
    items: [
      { key: "FLASK_BLUE", label: "Зелье энергии", icon: "🧪", desc: "Восстанавливает энергию" },
      { key: "FLASK_YELLOW", label: "Зелье газа", icon: "🧪", desc: "Пополняет газ-бак" },
      { key: "FLASK_GREEN", label: "Зелье роста", icon: "🧪", desc: "Ускоряет таймеры" },
      { key: "FLASK_PINK", label: "Зелье любви", icon: "🧪", desc: "Сердца любви" },
      { key: "FLASK_PURPLE", label: "Зелье удачи", icon: "🧪", desc: "Буст Forge" },
      { key: "LOVE_HEART", label: "Сердце любви", icon: "💗", desc: "Непередаваемое" },
    ],
  },
];

export function Pantry() {
  const { address } = useWalletStore();
  const [balances, setBalances] = useState<Record<string, number> | null>(null);
  const [filter, setFilter] = useState("raw");

  useEffect(() => {
    if (!address) return;
    api.query.balances(address).then((b: any) => setBalances(b || null)).catch(() => setBalances(null));
  }, [address]);

  const activeFilter = FILTERS.find((f) => f.key === filter) || FILTERS[0];

  if (!balances) {
    return (
      <div className="economy-empty">
        <p className="text-amber-400">Балансы ресурсов недоступны из канонической сети</p>
      </div>
    );
  }

  return (
    <div className="pantry">
      <div className="pantry-filters">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={"pantry-filter" + (filter === f.key ? " active" : "")}
            onClick={() => setFilter(f.key)}
          >
            <span>{f.icon}</span>
            <span>{f.label}</span>
          </button>
        ))}
      </div>

      <div className="pantry-grid">
        {activeFilter.items.map((item) => {
          const amount = balances[item.key] ?? 0;
          const has = amount > 0;
          return (
            <div
              key={item.key}
              className={"pantry-item" + (has ? " has" : " empty")}
            >
              <div className="pantry-item-icon">{item.icon}</div>
              <div className="pantry-item-info">
                <div className="pantry-item-label">{item.label}</div>
                {(item as any).desc && (
                  <div className="pantry-item-desc">{(item as any).desc}</div>
                )}
              </div>
              <div className="pantry-item-amount">{amount}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
