import React, { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useWalletStore } from "../../store/walletStore";
import { resourceIcon, UI_ICONS } from "../../lib/visualAssets";
import { ResourceGlyph } from "../../components/visual/ResourceGlyph";

const FILTERS = [
  {
    key: "raw",
    label: "Сырьё",
    icon: UI_ICONS.gems,
    items: [
      { key: "BLUE_CORE", label: "Голубое ядро", icon: resourceIcon("BLUE_CORE") || "" },
      { key: "PURPLE_CORE", label: "Фиолетовое ядро", icon: resourceIcon("PURPLE_CORE") || "" },
      { key: "RED_CORE", label: "Красное ядро", icon: resourceIcon("RED_CORE") || "" },
      { key: "CLEAR_QUARTZ", label: "Чистый кварц", icon: resourceIcon("CLEAR_QUARTZ") || "" },
      { key: "ROSE_QUARTZ", label: "Розовый кварц", icon: resourceIcon("ROSE_QUARTZ") || "" },
      { key: "AMBER_QUARTZ", label: "Янтарный кварц", icon: resourceIcon("AMBER_QUARTZ") || "" },
      { key: "COMPUTE", label: "Вычисления", icon: resourceIcon("COMPUTE") || "" },
      { key: "DATASET", label: "Датасет", icon: resourceIcon("DATASET") || "" },
      { key: "MIND", label: "MIND", icon: resourceIcon("MIND") || "" },
    ],
  },
  {
    key: "materials",
    label: "Материалы",
    icon: UI_ICONS.transformations,
    items: [
      { key: "QUANTUM_BIT", label: "Квантовый бит", icon: resourceIcon("QUANTUM_BIT") || "" },
      { key: "NEURAL_CHIP", label: "Нейрочип", icon: resourceIcon("NEURAL_CHIP") || "" },
      { key: "PHOTON_BIT", label: "Фотон-бит", icon: resourceIcon("PHOTON_BIT") || "" },
      { key: "BIO_CHIP", label: "Био-чип", icon: resourceIcon("BIO_CHIP") || "" },
      { key: "SYNAPSE", label: "Синапс", icon: resourceIcon("SYNAPSE") || "" },
      { key: "SIGNAL", label: "Сигнал", icon: resourceIcon("SIGNAL") || "" },
    ],
  },
  {
    key: "flasks",
    label: "Баночки",
    icon: UI_ICONS.flasks,
    items: [
      { key: "CRYO_FLUID", label: "Крио-флюид", icon: resourceIcon("CRYO_FLUID") || "", desc: "Восстанавливает энергию" },
      { key: "VOLT_FLUID", label: "Вольт-флюид", icon: resourceIcon("VOLT_FLUID") || "", desc: "Пополняет газ-бак" },
      { key: "BIO_FLUID", label: "Био-флюид", icon: resourceIcon("BIO_FLUID") || "", desc: "Ускоряет таймеры" },
      { key: "NANO_FLUID", label: "Нано-флюид", icon: resourceIcon("NANO_FLUID") || "", desc: "Сердца любви" },
      { key: "QUANTUM_FLUID", label: "Квантовый флюид", icon: resourceIcon("QUANTUM_FLUID") || "", desc: "Буст Forge" },
      { key: "SOUL_CORE", label: "Ядро души", icon: resourceIcon("SOUL_CORE") || "", desc: "Непередаваемое" },
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
            <ResourceGlyph icon={f.icon} alt="" className="w-5 h-5" />
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
              <div className="pantry-item-icon"><ResourceGlyph icon={item.icon} alt={item.label} className="w-8 h-8" /></div>
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
