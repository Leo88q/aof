import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card } from "../../components/ui/Card";
import { ProgressRing } from "../../components/ProgressRing";
import { api } from "../../lib/api";
import { useWalletStr } from "../../lib/useWalletStr";

interface BreakdownItem {
  score: number;
  max: number;
  hint: string;
}

interface TrustData {
  score: number;
  tier: number;
  breakdown: Record<string, BreakdownItem>;
  penaltyMult: number;
  privileges: {
    traderLimitSolPerDay: number;
    feeDiscountPct: number;
    holdingPeriodHours: number;
  };
  computedAt: string;
}

const TIER_NAMES = ["", "Росток", "Саженец", "Колос", "Урожай", "Мастер"];
const TIER_COLORS = ["", "#9ca3af", "#60a5fa", "#34d399", "#fbbf24", "#f472b6"];

const COMPONENT_META: Record<string, { icon: string; label: string }> = {
  age:        { icon: "📅", label: "Возраст аккаунта" },
  referral:   { icon: "👥", label: "Рефералы" },
  trader:     { icon: "🤖", label: "Farm-Trader" },
  staking:    { icon: "🔒", label: "Стейкинг" },
  rebirth:    { icon: "🔄", label: "Ребёрты" },
  guild:      { icon: "🏰", label: "Гильдия" },
  compendium: { icon: "📖", label: "Компендиум" },
  quests:     { icon: "🎯", label: "Задания" },
  craftRep:   { icon: "🛠️", label: "Репутация кузнеца" },
  antiBot:    { icon: "🛡️", label: "Анти-бот" },
};

export function TrustPage() {
  const user = useWalletStr();
  const [data, setData] = useState<TrustData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    api.trust.get(user)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) {
    return (
      <div className="p-4">
        <Card><p className="text-straw text-center py-8">Загрузка индекса доверия...</p></Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4">
        <Card><p className="text-straw text-center py-8">Подключите кошелёк</p></Card>
      </div>
    );
  }

  const isVerified = data.score >= 400;
  const tierColor = TIER_COLORS[data.tier] || "#9ca3af";
  const tierName = TIER_NAMES[data.tier] || "—";
  
  const tierThresholds = [0, 200, 400, 600, 800, 1000];
  const currentThreshold = tierThresholds[data.tier];
  const nextThreshold = tierThresholds[Math.min(data.tier + 1, 5)];
  const progressToNext = nextThreshold > currentThreshold 
    ? ((data.score - currentThreshold) / (nextThreshold - currentThreshold)) * 100
    : 100;

  return (
    <div className="p-4 pb-24">
      {/* Главный скор и тир */}
      <Card className="mb-4 text-center">
        <div className="flex items-center justify-center gap-4 mb-3">
          <ProgressRing
            value={data.score}
            max={1000}
            size={120}
            stroke={10}
            color={tierColor}
            label={`${data.score}`}
            sub={`из 1000`}
          />
        </div>
        
        <h2 className="text-2xl font-bold" style={{ color: tierColor }}>
          {tierName}
        </h2>
        <p className="text-straw text-sm">Tier {data.tier} из 5</p>
        
        {isVerified && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-full bg-sprout-500/20 border border-sprout-500/40"
          >
            <span className="text-sprout-500">✓</span>
            <span className="text-sprout-500 text-sm font-bold">Verified Player</span>
          </motion.div>
        )}
        
        {data.tier < 5 && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-straw mb-1">
              <span>До следующего тира</span>
              <span>{nextThreshold - data.score} очков</span>
            </div>
            <div className="h-2 bg-soil-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: tierColor }}
                initial={{ width: 0 }}
                animate={{ width: `${progressToNext}%` }}
                transition={{ duration: 1 }}
              />
            </div>
          </div>
        )}
        
        <p className="text-straw text-xs mt-3">
          Обновлено: {new Date(data.computedAt).toLocaleString()}
        </p>
      </Card>

      {/* Привилегии */}
      <Card className="mb-4">
        <h3 className="text-parchment font-semibold text-sm mb-3">🎁 Привилегии</h3>
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2 rounded-lg bg-soil-800/60 text-center">
            <p className="text-wheat-500 font-bold">{data.privileges.traderLimitSolPerDay}◎</p>
            <p className="text-straw text-[10px]">Лимит/день</p>
          </div>
          <div className="p-2 rounded-lg bg-soil-800/60 text-center">
            <p className="text-sprout-500 font-bold">-{data.privileges.feeDiscountPct}%</p>
            <p className="text-straw text-[10px]">Скидка на fees</p>
          </div>
          <div className="p-2 rounded-lg bg-soil-800/60 text-center">
            <p className="text-parchment font-bold">{data.privileges.holdingPeriodHours}ч</p>
            <p className="text-straw text-[10px]">Холд реф.</p>
          </div>
        </div>
      </Card>

      {/* Breakdown по компонентам */}
      <Card className="mb-4">
        <h3 className="text-parchment font-semibold text-sm mb-3">📊 Компоненты репутации</h3>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(data.breakdown).map(([key, item], i) => {
            const meta = COMPONENT_META[key] || { icon: "❓", label: key };
            const pct = item.max > 0 ? (item.score / item.max) * 100 : 0;
            const color = pct >= 70 ? "#34d399" : pct >= 40 ? "#fbbf24" : "#f87171";
            
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="p-2 rounded-lg bg-soil-800/40"
              >
                <div className="flex items-center gap-2">
                  <ProgressRing
                    value={item.score}
                    max={item.max}
                    size={44}
                    stroke={4}
                    color={color}
                    label={`${item.score}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-sm">{meta.icon}</span>
                      <span className="text-parchment text-xs font-medium truncate">{meta.label}</span>
                    </div>
                    <p className="text-straw text-[10px] mt-0.5 truncate">{item.hint}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </Card>

      {/* Penalty множитель */}
      {data.penaltyMult < 1 && (
        <Card className="bg-red-500/10 border-red-500/30">
          <div className="flex items-center gap-3">
            <span className="text-3xl">⚠️</span>
            <div>
              <h3 className="text-red-400 font-semibold text-sm">Штраф активен</h3>
              <p className="text-straw text-xs">
                Ваш скор умножается на ×{data.penaltyMult.toFixed(2)} из-за активных флагов
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
