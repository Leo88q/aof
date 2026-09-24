import React, { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useWalletStore } from "../../store/walletStore";

// Группировка ресурсов по категориям (из мастер-документа §3)
const CATEGORIES = [
  {
    title: "Базовые",
    icon: "🌾",
    items: [
      { key: "DATA", label: "Данные", icon: "🌾", accent: "#c9a24a" },
      { key: "CIRCUIT", label: "Схема", icon: "🪵", accent: "#6bbf59" },
      { key: "SILICON", label: "Кремний", icon: "🪨", accent: "#9a8f82" },
    ],
  },
  {
    title: "Модельная цепочка",
    icon: "🍞",
    items: [
      { key: "NEURON", label: "Нейрон", icon: "🌰", accent: "#8b6b3e" },
      { key: "SYNAPSE", label: "Синапс", icon: "🌾", accent: "#d4a94a" },
      { key: "SIGNAL", label: "Сигнал", icon: "🥣", accent: "#e8d7a8" },
      { key: "MODEL", label: "Модель", icon: "🍞", accent: "#c9884a" },
      { key: "POWER", label: "Энергопоток", icon: "💧", accent: "#4a9fd4" },
      { key: "COMPUTE", label: "Вычисления", icon: "⬛", accent: "#2a2a2a" },
      { key: "DATASET", label: "Датасет", icon: "🍖", accent: "#c44a4a" },
    ],
  },
  {
    title: "Камни",
    icon: "🪨",
    items: [
      { key: "BLUE_CORE", label: "Голубое ядро", icon: "🔵", accent: "#4a7fd4" },
      { key: "PURPLE_CORE", label: "Фиолетовое ядро", icon: "🟣", accent: "#8a4ac4" },
      { key: "RED_CORE", label: "Красное ядро", icon: "🔴", accent: "#c44a4a" },
    ],
  },
  {
    title: "Песок",
    icon: "🏖️",
    items: [
      { key: "CLEAR_QUARTZ", label: "Чистый кварц", icon: "⚪", accent: "#e8e8e8" },
      { key: "ROSE_QUARTZ", label: "Розовый кварц", icon: "💗", accent: "#e87aa8" },
      { key: "AMBER_QUARTZ", label: "Янтарный кварц", icon: "🟡", accent: "#e8d84a" },
    ],
  },
  {
    title: "Гемы",
    icon: "💎",
    items: [
      { key: "QUANTUM_BIT", label: "Квантовый бит", icon: "💎", accent: "#4a7fd4" },
      { key: "NEURAL_CHIP", label: "Нейрочип", icon: "🟠", accent: "#e8a84a" },
      { key: "PHOTON_BIT", label: "Фотон-бит", icon: "⚪", accent: "#e8e8e8" },
      { key: "BIO_CHIP", label: "Био-чип", icon: "🟢", accent: "#6bbf59" },
    ],
  },
  {
    title: "Баночки",
    icon: "🧪",
    items: [
      { key: "CRYO_FLUID", label: "Крио-флюид", icon: "🧪", accent: "#4a7fd4" },
      { key: "VOLT_FLUID", label: "Вольт-флюид", icon: "🧪", accent: "#e8d84a" },
      { key: "BIO_FLUID", label: "Био-флюид", icon: "🧪", accent: "#6bbf59" },
      { key: "NANO_FLUID", label: "Нано-флюид", icon: "🧪", accent: "#e87aa8" },
      { key: "QUANTUM_FLUID", label: "Квантовый флюид", icon: "🧪", accent: "#8a4ac4" },
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
