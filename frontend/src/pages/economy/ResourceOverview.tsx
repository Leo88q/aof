import React, { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useWalletStore } from "../../store/walletStore";
import { resourceIcon, UI_ICONS } from "../../lib/visualAssets";
import { ResourceGlyph } from "../../components/visual/ResourceGlyph";
import { Panel, Readout, Readouts, Sticker, Note } from "../../ui/forge/kit";
import { GelLanes, type GelLane, type GelBand } from "../../ui/forge/devices";

/**
 * К8 · гель-электрофорез. Дорожка — категория склада, полоса — позиция ресурса.
 * Полоса идёт тем выше, чем больше запаса (тяжёлый фрагмент меньше уходит от
 * лунки), поэтому картинка читается как «где у меня густо, а где пусто».
 * Масштаб логарифмический от самой полной позиции склада — иначе один крупный
 * ресурс прижимал бы все остальные к лунке. Ноль не рисуется: пустая позиция
 * остаётся пустой дорожкой, а не полосой на нуле.
 */
function gelLanes(categories: typeof CATEGORIES, balances: Record<string, number>): GelLane[] {
  const all = categories.flatMap((c) => c.items);
  const top = Math.max(1, ...all.map((i) => Number(balances[i.key] ?? 0)));
  const logTop = Math.log1p(top);
  return categories
    .map((cat) => {
      const filled = cat.items.filter((i) => Number(balances[i.key] ?? 0) > 0);
      const bands: GelBand[] = filled.map((i) => {
        const amount = Number(balances[i.key] ?? 0);
        const ratio = logTop > 1 ? Math.log1p(amount) / logTop : 1;
        return {
          // 0.06 — у самой лунки (полно), 0.88 — у нижнего края (мало)
          at: 0.06 + 0.82 * (1 - Math.min(1, Math.max(0, ratio))),
          kind: amount < top * 0.05 ? "weak" : "fresh",
        };
      });
      return { key: cat.title, name: cat.title.split(" ")[0], bands };
    })
    .filter((lane) => lane.bands.length > 0);
}

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
      { key: "DATA", label: "Данные", icon: resourceIcon("DATA") || "", accent: "#5FC9DA" },
      { key: "CIRCUIT", label: "Схема", icon: resourceIcon("CIRCUIT") || "", accent: "#5FD3A8" },
      { key: "SILICON", label: "Кремний", icon: resourceIcon("SILICON") || "", accent: "#A99BEC" },
      { key: "NEURON", label: "Нейрон", icon: resourceIcon("NEURON") || "", accent: "#8FB3DE" },
      { key: "SYNAPSE", label: "Синапс", icon: resourceIcon("SYNAPSE") || "", accent: "#5FC9DA" },
      { key: "SIGNAL", label: "Сигнал", icon: resourceIcon("SIGNAL") || "", accent: "#8FE3F0" },
      { key: "MODEL", label: "Модель", icon: resourceIcon("MODEL") || "", accent: "#E0708A" },
      { key: "POWER", label: "Энергопоток", icon: resourceIcon("POWER") || "", accent: "#A99BEC" },
    ],
  },
  {
    title: "Расходники и топливо",
    icon: UI_ICONS.transformations,
    items: [
      { key: "COMPUTE", label: "Вычисления", icon: resourceIcon("COMPUTE") || "", accent: "#E0708A" },
      { key: "DATASET", label: "Датасет", icon: resourceIcon("DATASET") || "", accent: "#E2685F" },
    ],
  },
  {
    title: "Камни",
    icon: UI_ICONS.gems,
    items: [
      { key: "BLUE_CORE", label: "Голубое ядро", icon: resourceIcon("BLUE_CORE") || "", accent: "#8FB3DE" },
      { key: "PURPLE_CORE", label: "Фиолетовое ядро", icon: resourceIcon("PURPLE_CORE") || "", accent: "#A99BEC" },
      { key: "RED_CORE", label: "Красное ядро", icon: resourceIcon("RED_CORE") || "", accent: "#E2685F" },
    ],
  },
  {
    title: "Песок",
    icon: UI_ICONS.locCoolLake,
    items: [
      { key: "CLEAR_QUARTZ", label: "Чистый кварц", icon: resourceIcon("CLEAR_QUARTZ") || "", accent: "#E6EBF0" },
      { key: "ROSE_QUARTZ", label: "Розовый кварц", icon: resourceIcon("ROSE_QUARTZ") || "", accent: "#E0708A" },
      { key: "AMBER_QUARTZ", label: "Янтарный кварц", icon: resourceIcon("AMBER_QUARTZ") || "", accent: "#E0708A" },
    ],
  },
  {
    title: "Гемы",
    icon: UI_ICONS.transformations,
    items: [
      { key: "QUANTUM_BIT", label: "Квантовый бит", icon: resourceIcon("QUANTUM_BIT") || "", accent: "#8FB3DE" },
      { key: "NEURAL_CHIP", label: "Нейрочип", icon: resourceIcon("NEURAL_CHIP") || "", accent: "#5FC9DA" },
      { key: "PHOTON_BIT", label: "Фотон-бит", icon: resourceIcon("PHOTON_BIT") || "", accent: "#E6EBF0" },
      { key: "BIO_CHIP", label: "Био-чип", icon: resourceIcon("BIO_CHIP") || "", accent: "#5FD3A8" },
    ],
  },
  {
    title: "Баночки",
    icon: UI_ICONS.flasks,
    items: [
      { key: "CRYO_FLUID", label: "Крио-флюид", icon: resourceIcon("CRYO_FLUID") || "", accent: "#8FB3DE" },
      { key: "VOLT_FLUID", label: "Вольт-флюид", icon: resourceIcon("VOLT_FLUID") || "", accent: "#E0708A" },
      { key: "BIO_FLUID", label: "Био-флюид", icon: resourceIcon("BIO_FLUID") || "", accent: "#5FD3A8" },
      { key: "NANO_FLUID", label: "Нано-флюид", icon: resourceIcon("NANO_FLUID") || "", accent: "#E0708A" },
      { key: "QUANTUM_FLUID", label: "Квантовый флюид", icon: resourceIcon("QUANTUM_FLUID") || "", accent: "#A99BEC" },
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
            ? "Читаем балансы из сети…"
            : "Балансы ресурсов недоступны из сети"}
        </p>
      </div>
    );
  }

  const lanes = gelLanes(CATEGORIES, balances);
  const allItems = CATEGORIES.flatMap((c) => c.items);
  const withStock = allItems.filter((i) => Number(balances[i.key] ?? 0) > 0);
  const fullest = withStock.reduce<{ label: string; amount: number } | null>((acc, i) => {
    const amount = Number(balances[i.key] ?? 0);
    return !acc || amount > acc.amount ? { label: i.label, amount } : acc;
  }, null);

  return (
    <div className="economy-overview">
      {/* Склад читается как гель: сколько чего лежит — видно по полосам дорожек */}
      <Panel
        tier="panel"
        device="gel"
        id={<Sticker>СКЛАД</Sticker>}
        meta="ГЕЛЬ-АНАЛИЗ"
        title="Гель склада"
        sub="полоса — позиция ресурса"
        className="mb-2"
      >
        {lanes.length > 0 ? (
          <GelLanes lanes={lanes} />
        ) : (
          <Note quiet>Все позиции пусты — полос нет.</Note>
        )}
        <div style={{ marginTop: 16 }}>
          <Readouts>
            <Readout label="Позиций с запасом" value={String(withStock.length)} hint={`всего позиций: ${allItems.length}`} />
            <Readout
              label="Полнее всего"
              value={fullest ? String(fullest.amount.toLocaleString()) : undefined}
              dash={!fullest}
              hint={fullest ? fullest.label : "запасов нет"}
            />
          </Readouts>
        </div>
      </Panel>

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
