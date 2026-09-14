import React, { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useWalletStore } from "../../store/walletStore";

// Группировка ресурсов по категориям (из мастер-документа §3)
const CATEGORIES = [
  {
    title: "Базовые",
    icon: "🌾",
    items: [
      { key: "FOOD", label: "Зерно", icon: "🌾", accent: "#c9a24a" },
      { key: "WOOD", label: "Древесина", icon: "🪵", accent: "#6bbf59" },
      { key: "STONE", label: "Камень", icon: "🪨", accent: "#9a8f82" },
    ],
  },
  {
    title: "Хлебная цепочка",
    icon: "🍞",
    items: [
      { key: "SEEDS", label: "Семена", icon: "🌰", accent: "#8b6b3e" },
      { key: "WHEAT", label: "Пшеница", icon: "🌾", accent: "#d4a94a" },
      { key: "FLOUR", label: "Мука", icon: "🥣", accent: "#e8d7a8" },
      { key: "BREAD", label: "Хлеб", icon: "🍞", accent: "#c9884a" },
      { key: "WATER", label: "Вода", icon: "💧", accent: "#4a9fd4" },
      { key: "COAL", label: "Уголь", icon: "⬛", accent: "#2a2a2a" },
      { key: "MEAT", label: "Мясо", icon: "🍖", accent: "#c44a4a" },
    ],
  },
  {
    title: "Камни",
    icon: "🪨",
    items: [
      { key: "STONE_BLUE", label: "Сапфир", icon: "🔵", accent: "#4a7fd4" },
      { key: "STONE_PURPLE", label: "Аметист", icon: "🟣", accent: "#8a4ac4" },
      { key: "STONE_RED", label: "Рубин", icon: "🔴", accent: "#c44a4a" },
    ],
  },
  {
    title: "Песок",
    icon: "🏖️",
    items: [
      { key: "SAND_WHITE", label: "Кварцевый песок", icon: "⚪", accent: "#e8e8e8" },
      { key: "SAND_PINK", label: "Розовый песок", icon: "💗", accent: "#e87aa8" },
      { key: "SAND_YELLOW", label: "Янтарный песок", icon: "🟡", accent: "#e8d84a" },
    ],
  },
  {
    title: "Гемы",
    icon: "💎",
    items: [
      { key: "GEM_BLUE", label: "Сапфировый гем", icon: "💎", accent: "#4a7fd4" },
      { key: "GEM_ORANGE", label: "Янтарный гем", icon: "🟠", accent: "#e8a84a" },
      { key: "GEM_WHITE", label: "Кварцевый гем", icon: "⚪", accent: "#e8e8e8" },
      { key: "GEM_GREEN", label: "Изумрудный гем", icon: "🟢", accent: "#6bbf59" },
    ],
  },
  {
    title: "Баночки",
    icon: "🧪",
    items: [
      { key: "FLASK_BLUE", label: "Зелье энергии", icon: "🧪", accent: "#4a7fd4" },
      { key: "FLASK_YELLOW", label: "Зелье газа", icon: "🧪", accent: "#e8d84a" },
      { key: "FLASK_GREEN", label: "Зелье роста", icon: "🧪", accent: "#6bbf59" },
      { key: "FLASK_PINK", label: "Зелье любви", icon: "🧪", accent: "#e87aa8" },
      { key: "FLASK_PURPLE", label: "Зелье удачи", icon: "🧪", accent: "#8a4ac4" },
    ],
  },
];

export function ResourceOverview() {
  const { address } = useWalletStore();
  const [balances, setBalances] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address) return;
    setLoading(true);
    api.query
      .balances(address)
      .then((b: any) => setBalances(b || null))
      .catch(() => setBalances(null))
      .finally(() => setLoading(false));
  }, [address]);

  if (!address) {
    return (
      <div className="economy-empty">
        <p className="text-straw">Подключите кошелёк, чтобы увидеть ресурсы</p>
      </div>
    );
  }

  if (!balances) {
    return (
      <div className="economy-empty">
        <p className="text-amber-400">Балансы ресурсов недоступны из канонической сети</p>
      </div>
    );
  }

  return (
    <div className="economy-overview">
      {CATEGORIES.map((cat) => (
        <div key={cat.title} className="resource-category">
          <h3 className="category-title">
            <span className="category-icon">{cat.icon}</span>
            {cat.title}
          </h3>
          <div className="resource-grid">
            {cat.items.map((item) => {
              const amount = balances[item.key] ?? 0;
              return (
                <div
                  key={item.key}
                  className="resource-card"
                  style={{ borderColor: item.accent + "66" }}
                >
                  <div className="resource-icon" style={{ background: item.accent + "26" }}>
                    {item.icon}
                  </div>
                  <div className="resource-info">
                    <div className="resource-label">{item.label}</div>
                    <div className="resource-amount" style={{ color: item.accent }}>
                      {loading ? "…" : amount.toLocaleString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
