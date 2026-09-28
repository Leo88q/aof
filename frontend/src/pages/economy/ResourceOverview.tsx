import React, { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useWalletStore } from "../../store/walletStore";
import { resourceIcon, UI_ICONS } from "../../lib/visualAssets";
import { ResourceGlyph } from "../../components/visual/ResourceGlyph";

// Группировка ресурсов по категориям (из мастер-документа §3).
//
// Базовые ресурсы больше не идут отдельной витриной: балансы Данных/Схемы/Кремния
// показываются на обзоре лаборатории вместе с остальными добываемыми ресурсами
// (components/farm/LabPanels.tsx), а здесь они лежат в одном списке с модельной
// цепочкой. Так один и тот же ресурс не встречается в интерфейсе дважды.
const LAB_RESOURCE_KEYS = ["DATA", "CIRCUIT", "SILICON", "POWER", "NEURON", "SYNAPSE", "SIGNAL", "MODEL"];

const CATEGORIES = [
  {
    title: "Производство лаборатории",
    hint: "Добывается на участке и видно на обзоре лаборатории",
    icon: UI_ICONS.labOverview,
    items: [
      { key: "DATA", label: "Данные", icon: resourceIcon("DATA") || "", accent: "#00D4FF" },
      { key: "CIRCUIT", label: "Схема", icon: resourceIcon("CIRCUIT") || "", accent: "#00E5A0" },
      { key: "SILICON", label: "Кремний", icon: resourceIcon("SILICON") || "", accent: "#9B59FF" },
      { key: "NEURON", label: "Нейрон", icon: resourceIcon("NEURON") || "", accent: "#4F7BFF" },
      { key: "SYNAPSE", label: "Синапс", icon: resourceIcon("SYNAPSE") || "", accent: "#00D4FF" },
      { key: "SIGNAL", label: "Сигнал", icon: resourceIcon("SIGNAL") || "", accent: "#60EFFF" },
      { key: "MODEL", label: "Модель", icon: resourceIcon("MODEL") || "", accent: "#FFD700" },
      { key: "POWER", label: "Энергопоток", icon: resourceIcon("POWER") || "", accent: "#9B59FF" },
    ],
  },
  {
    title: "Расходники и топливо",
    icon: UI_ICONS.transformations,
    items: [
      { key: "COMPUTE", label: "Вычисления", icon: resourceIcon("COMPUTE") || "", accent: "#FF3CAC" },
      { key: "DATASET", label: "Датасет", icon: resourceIcon("DATASET") || "", accent: "#FF3366" },
    ],
  },
  {
    title: "Камни",
    icon: UI_ICONS.gems,
    items: [
      { key: "BLUE_CORE", label: "Голубое ядро", icon: resourceIcon("BLUE_CORE") || "", accent: "#4F7BFF" },
      { key: "PURPLE_CORE", label: "Фиолетовое ядро", icon: resourceIcon("PURPLE_CORE") || "", accent: "#9B59FF" },
      { key: "RED_CORE", label: "Красное ядро", icon: resourceIcon("RED_CORE") || "", accent: "#FF3366" },
    ],
  },
  {
    title: "Песок",
    icon: UI_ICONS.locCoolLake,
    items: [
      { key: "CLEAR_QUARTZ", label: "Чистый кварц", icon: resourceIcon("CLEAR_QUARTZ") || "", accent: "#E0E4F0" },
      { key: "ROSE_QUARTZ", label: "Розовый кварц", icon: resourceIcon("ROSE_QUARTZ") || "", accent: "#FF3CAC" },
      { key: "AMBER_QUARTZ", label: "Янтарный кварц", icon: resourceIcon("AMBER_QUARTZ") || "", accent: "#FFD700" },
    ],
  },
  {
    title: "Гемы",
    icon: UI_ICONS.transformations,
    items: [
      { key: "QUANTUM_BIT", label: "Квантовый бит", icon: resourceIcon("QUANTUM_BIT") || "", accent: "#4F7BFF" },
      { key: "NEURAL_CHIP", label: "Нейрочип", icon: resourceIcon("NEURAL_CHIP") || "", accent: "#00D4FF" },
      { key: "PHOTON_BIT", label: "Фотон-бит", icon: resourceIcon("PHOTON_BIT") || "", accent: "#E0E4F0" },
      { key: "BIO_CHIP", label: "Био-чип", icon: resourceIcon("BIO_CHIP") || "", accent: "#00E5A0" },
    ],
  },
  {
    title: "Баночки",
    icon: UI_ICONS.flasks,
    items: [
      { key: "CRYO_FLUID", label: "Крио-флюид", icon: resourceIcon("CRYO_FLUID") || "", accent: "#4F7BFF" },
      { key: "VOLT_FLUID", label: "Вольт-флюид", icon: resourceIcon("VOLT_FLUID") || "", accent: "#FFD700" },
      { key: "BIO_FLUID", label: "Био-флюид", icon: resourceIcon("BIO_FLUID") || "", accent: "#00E5A0" },
      { key: "NANO_FLUID", label: "Нано-флюид", icon: resourceIcon("NANO_FLUID") || "", accent: "#FF3CAC" },
      { key: "QUANTUM_FLUID", label: "Квантовый флюид", icon: resourceIcon("QUANTUM_FLUID") || "", accent: "#9B59FF" },
    ],
  },
];

export function ResourceOverview() {
  const { address } = useWalletStore();
  const [balances, setBalances] = useState<Record<string, number> | null>(null);
  // Стартуем с true: до первого ответа игрок видит «читаем», а не ложное
  // «недоступно» и тем более не нули.
  const [loading, setLoading] = useState(true);

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
        <p className={loading ? "text-straw" : "text-amber-400"}>
          {loading
            ? "Читаем балансы из канонической сети…"
            : "Балансы ресурсов недоступны из канонической сети"}
        </p>
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
            {cat.hint && <span className="category-hint">{cat.hint}</span>}
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
