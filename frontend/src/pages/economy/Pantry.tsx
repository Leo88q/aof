import { useToast } from "../../components/ui/Toast";
import { handleTxResponse } from "../../lib/txFlow";
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

// Маппинг флаконов к типам (для контракта)
const FLASK_TYPE_MAP: Record<string, number> = {
  FLASK_BLUE: 1,    // Энергия
  FLASK_YELLOW: 2,  // Газ
  FLASK_GREEN: 3,   // Рост
  FLASK_PINK: 4,    // Любовь
  FLASK_PURPLE: 5,  // Удача
};

const FLASK_EFFECTS: Record<string, string> = {
  FLASK_BLUE: "+20% к добыче ресурсов на 1 час",
  FLASK_YELLOW: "+100 газа в GasTank",
  FLASK_GREEN: "×2 скорость таймеров (печь/мельница) на 1 час",
  FLASK_PINK: "+3 ❤️ к соседу (бонус дружбы)",
  FLASK_PURPLE: "+50% шанс успеха Forge на 1 час",
};


export function Pantry() {
  const toast = useToast();
  const { address } = useWalletStore();
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState("raw");
  const [usingFlask, setUsingFlask] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    api.query.balances(address).then((b: any) => setBalances(b || {})).catch(() => {});
  }, [address]);

  const activeFilter = FILTERS.find((f) => f.key === filter) || FILTERS[0];


  async function handleUseFlask(flaskKey: string) {
    if (!address) return;
    const flaskType = FLASK_TYPE_MAP[flaskKey];
    if (!flaskType) return;
    
    setUsingFlask(flaskKey);
    try {
      // TODO: Получить реальный mint из MaterialMints PDA
      // Пока используем placeholder
      const flaskMint = "11111111111111111111111111111111";
      
      const resp = await api.tools.useFlask({
        user: address,
        flaskType,
        flaskMint,
      });
      
      const result = await handleTxResponse(resp);
      if (result.success) {
        toast.show(`✨ ${FLASK_EFFECTS[flaskKey]}\n\nБафф активен 1 час!`);
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setUsingFlask(null);
    }
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
