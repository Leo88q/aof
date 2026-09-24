import React, { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useWalletStore } from "../../store/walletStore";

const FILTERS = [
  {
    key: "raw",
    label: "Сырьё",
    icon: "🪨",
    items: [
      { key: "BLUE_CORE", label: "Голубое ядро", icon: "🔵" },
      { key: "PURPLE_CORE", label: "Фиолетовое ядро", icon: "🟣" },
      { key: "RED_CORE", label: "Красное ядро", icon: "🔴" },
      { key: "CLEAR_QUARTZ", label: "Чистый кварц", icon: "⚪" },
      { key: "ROSE_QUARTZ", label: "Розовый кварц", icon: "💗" },
      { key: "AMBER_QUARTZ", label: "Янтарный кварц", icon: "🟡" },
      { key: "COMPUTE", label: "Вычисления", icon: "⬛" },
      { key: "DATASET", label: "Датасет", icon: "🍖" },
      { key: "MIND", label: "MIND", icon: "🥔" },
    ],
  },
  {
    key: "materials",
    label: "Материалы",
    icon: "💎",
    items: [
      { key: "QUANTUM_BIT", label: "Квантовый бит", icon: "💎" },
      { key: "NEURAL_CHIP", label: "Нейрочип", icon: "🟠" },
      { key: "PHOTON_BIT", label: "Фотон-бит", icon: "⚪" },
      { key: "BIO_CHIP", label: "Био-чип", icon: "🟢" },
      { key: "SYNAPSE", label: "Синапс", icon: "🌾" },
      { key: "SIGNAL", label: "Сигнал", icon: "🥣" },
    ],
  },
  {
    key: "flasks",
    label: "Баночки",
    icon: "🧪",
    items: [
      { key: "CRYO_FLUID", label: "Крио-флюид", icon: "🧪", desc: "Восстанавливает энергию" },
      { key: "VOLT_FLUID", label: "Вольт-флюид", icon: "🧪", desc: "Пополняет газ-бак" },
      { key: "BIO_FLUID", label: "Био-флюид", icon: "🧪", desc: "Ускоряет таймеры" },
      { key: "NANO_FLUID", label: "Нано-флюид", icon: "🧪", desc: "Сердца любви" },
      { key: "QUANTUM_FLUID", label: "Квантовый флюид", icon: "🧪", desc: "Буст Forge" },
      { key: "SOUL_CORE", label: "Ядро души", icon: "💗", desc: "Непередаваемое" },
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
