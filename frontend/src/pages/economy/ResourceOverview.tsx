import React, { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useWalletStore } from "../../store/walletStore";
import { resourceIcon, UI_ICONS } from "../../lib/visualAssets";
import { ResourceGlyph } from "../../components/visual/ResourceGlyph";

// Группировка ресурсов по категориям (из мастер-документа §3)
const CATEGORIES = [
  {
    title: "Базовые",
    icon: UI_ICONS.labOverview,
    items: [
      { key: "DATA", label: "Данные", icon: resourceIcon("DATA") || "", accent: "#c9a24a" },
      { key: "CIRCUIT", label: "Схема", icon: resourceIcon("CIRCUIT") || "", accent: "#6bbf59" },
      { key: "SILICON", label: "Кремний", icon: resourceIcon("SILICON") || "", accent: "#9a8f82" },
    ],
  },
  {
    title: "Модельная цепочка",
    icon: UI_ICONS.transformations,
    items: [
      { key: "NEURON", label: "Нейрон", icon: resourceIcon("NEURON") || "", accent: "#8b6b3e" },
      { key: "SYNAPSE", label: "Синапс", icon: resourceIcon("SYNAPSE") || "", accent: "#d4a94a" },
      { key: "SIGNAL", label: "Сигнал", icon: resourceIcon("SIGNAL") || "", accent: "#e8d7a8" },
      { key: "MODEL", label: "Модель", icon: resourceIcon("MODEL") || "", accent: "#c9884a" },
      { key: "POWER", label: "Энергопоток", icon: resourceIcon("POWER") || "", accent: "#4a9fd4" },
      { key: "COMPUTE", label: "Вычисления", icon: resourceIcon("COMPUTE") || "", accent: "#2a2a2a" },
      { key: "DATASET", label: "Датасет", icon: resourceIcon("DATASET") || "", accent: "#c44a4a" },
    ],
  },
  {
    title: "Камни",
    icon: UI_ICONS.gems,
    items: [
      { key: "BLUE_CORE", label: "Голубое ядро", icon: resourceIcon("BLUE_CORE") || "", accent: "#4a7fd4" },
      { key: "PURPLE_CORE", label: "Фиолетовое ядро", icon: resourceIcon("PURPLE_CORE") || "", accent: "#8a4ac4" },
      { key: "RED_CORE", label: "Красное ядро", icon: resourceIcon("RED_CORE") || "", accent: "#c44a4a" },
    ],
  },
  {
    title: "Песок",
    icon: UI_ICONS.catalog,
    items: [
      { key: "CLEAR_QUARTZ", label: "Чистый кварц", icon: resourceIcon("CLEAR_QUARTZ") || "", accent: "#e8e8e8" },
      { key: "ROSE_QUARTZ", label: "Розовый кварц", icon: resourceIcon("ROSE_QUARTZ") || "", accent: "#e87aa8" },
      { key: "AMBER_QUARTZ", label: "Янтарный кварц", icon: resourceIcon("AMBER_QUARTZ") || "", accent: "#e8d84a" },
    ],
  },
  {
    title: "Гемы",
    icon: UI_ICONS.transformations,
    items: [
      { key: "QUANTUM_BIT", label: "Квантовый бит", icon: resourceIcon("QUANTUM_BIT") || "", accent: "#4a7fd4" },
      { key: "NEURAL_CHIP", label: "Нейрочип", icon: resourceIcon("NEURAL_CHIP") || "", accent: "#e8a84a" },
      { key: "PHOTON_BIT", label: "Фотон-бит", icon: resourceIcon("PHOTON_BIT") || "", accent: "#e8e8e8" },
      { key: "BIO_CHIP", label: "Био-чип", icon: resourceIcon("BIO_CHIP") || "", accent: "#6bbf59" },
    ],
  },
  {
    title: "Баночки",
    icon: UI_ICONS.flasks,
    items: [
      { key: "CRYO_FLUID", label: "Крио-флюид", icon: resourceIcon("CRYO_FLUID") || "", accent: "#4a7fd4" },
      { key: "VOLT_FLUID", label: "Вольт-флюид", icon: resourceIcon("VOLT_FLUID") || "", accent: "#e8d84a" },
      { key: "BIO_FLUID", label: "Био-флюид", icon: resourceIcon("BIO_FLUID") || "", accent: "#6bbf59" },
      { key: "NANO_FLUID", label: "Нано-флюид", icon: resourceIcon("NANO_FLUID") || "", accent: "#e87aa8" },
      { key: "QUANTUM_FLUID", label: "Квантовый флюид", icon: resourceIcon("QUANTUM_FLUID") || "", accent: "#8a4ac4" },
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
            <span className="category-icon"><ResourceGlyph icon={cat.icon} alt="" className="w-5 h-5" /></span>
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
                    <ResourceGlyph icon={item.icon} alt={item.label} className="w-8 h-8" />
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
