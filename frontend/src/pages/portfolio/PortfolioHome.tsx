import { VipGate } from "../../components/ui/VipGate";
import { useEffect, useRef, useState } from "react";
import { createChart, ColorType, IChartApi } from "lightweight-charts";
import { api } from "../../lib/api";
import { Card } from "../../components/ui/Card";
import { AnimatedCounter } from "../../components/ui/AnimatedCounter";
import { ProgressRing } from "../../components/ProgressRing";
import { TOOL_ICON, RARITY_META, rarityKey } from "../../lib/toolMeta";
import { ArtPlate } from "../../components/visual/ArtPlate";
import { fmtNum } from "../../lib/marketUtils";
import { useWalletStr } from "../../lib/useWalletStr";
import { useStore } from "../../store/useStore";
import { motion } from "framer-motion";

const RESOURCE_META: Record<string, { icon: string; label: string }> = {
  FOOD: { icon: "🌾", label: "Данные" },
  WOOD: { icon: "🪵", label: "Схема" },
  STONE: { icon: "🪨", label: "Кремний" },
  SEEDS: { icon: "🌰", label: "Нейрон" },
  WHEAT: { icon: "🌾", label: "Синапс" },
  FLOUR: { icon: "🥣", label: "Сигнал" },
  BREAD: { icon: "🍞", label: "Модель" },
  WATER: { icon: "💧", label: "Энергопоток" },
  COAL: { icon: "⬛", label: "Вычисления" },
  MEAT: { icon: "🍖", label: "Датасет" },
  STONE_BLUE: { icon: "🔵", label: "Голубое ядро" },
  STONE_PURPLE: { icon: "🟣", label: "Фиолетовое ядро" },
  STONE_RED: { icon: "🔴", label: "Красное ядро" },
  SAND_WHITE: { icon: "⚪", label: "Чистый кварц" },
  SAND_PINK: { icon: "💗", label: "Розовый кварц" },
  SAND_YELLOW: { icon: "🟡", label: "Янтарный кварц" },
  GEM_BLUE: { icon: "💎", label: "Квантовый бит" },
  GEM_ORANGE: { icon: "🟠", label: "Нейрочип" },
  GEM_WHITE: { icon: "⚪", label: "Фотон-бит" },
  GEM_GREEN: { icon: "🟢", label: "Био-чип" },
  FLASK_BLUE: { icon: "🧪", label: "Крио-флюид" },
  FLASK_YELLOW: { icon: "🧪", label: "Вольт-флюид" },
  FLASK_GREEN: { icon: "🧪", label: "Био-флюид" },
  FLASK_PINK: { icon: "🧪", label: "Нано-флюид" },
  FLASK_PURPLE: { icon: "🧪", label: "Квантовый флюид" },
};

export function PortfolioHome() {
  const user = useWalletStr();
  const [portfolio, setPortfolio] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api.portfolio
      .get(user)
      .then((data) => setPortfolio(data))
      .catch(() => setPortfolio(null))
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (portfolio?.history?.[period]) renderChart(portfolio.history[period]);
  }, [portfolio, period]);

  function renderChart(history: any[]) {
    if (!chartRef.current || history.length === 0) return;
    chartInstance.current?.remove();

    const chart = createChart(chartRef.current, {
      height: 200,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#9c8b7a" },
      grid: {
        vertLines: { color: "rgba(61, 50, 38, 0.3)" },
        horzLines: { color: "rgba(61, 50, 38, 0.3)" },
      },
      timeScale: { timeVisible: false, borderColor: "#3d3226" },
      rightPriceScale: { borderColor: "#3d3226" },
    });

    const series = chart.addAreaSeries({
      lineColor: "#e8a33d",
      topColor: "rgba(232, 163, 61, 0.3)",
      bottomColor: "rgba(232, 163, 61, 0.02)",
      lineWidth: 2,
    });

    series.setData(
      history.map((h) => ({
        time: (Math.floor(new Date(h.tsStart).getTime() / 1000)) as any,
        value: h.close,
      }))
    );
    chart.timeScale().fitContent();
    chartInstance.current = chart;
  }

  if (loading) {
    return (
      <div className="p-4 pt-2 pb-24">
        <h1 className="text-2xl font-bold mb-4">Портфель</h1>
        <Card className="p-8 text-center">
          <div className="text-parchment">Loading портфеля...</div>
        </Card>
      
      {/* VIP: Расширенная аналитика */}

    </div>
    );
  }

  if (!user) {
    return (
      <div className="p-4 pt-2 pb-24">
        <h1 className="text-2xl font-bold mb-4">Портфель</h1>
        <Card className="p-8 text-center">
          <div className="text-4xl mb-2">🔒</div>
          <p className="text-parchment text-sm">Подключите кошелёк, чтобы увидеть портфель</p>
        </Card>
      </div>
    );
  }

  if (!portfolio) {
    return (
      <div className="p-4 pt-2 pb-24">
        <h1 className="text-2xl font-bold mb-4">Портфель</h1>
        <Card className="p-8 text-center">
          <div className="text-4xl mb-2">📭</div>
          <p className="text-parchment text-sm">Нет данных портфеля</p>
        </Card>
      </div>
    );
  }

  const categories = [
    { key: "tools", icon: "🛠️", label: "Инструменты" },
    { key: "resources", icon: "📦", label: "Ресурсы" },
    { key: "listings", icon: "🏷️", label: "Листинги" },
    { key: "orders", icon: "📊", label: "Ордера" },
  ];

  // Фильтруем ресурсы с балансом > 0
  const activeResources = Object.entries(portfolio.balances || {})
    .filter(([_, bal]) => (bal as number) > 0)
    .map(([key, bal]) => ({
      key,
      balance: bal,
      ...(RESOURCE_META[key] || { icon: "📦", label: key }),
    }));

  return (
    <div className="p-4 pt-2 pb-24">
      <h1 className="text-2xl font-bold mb-4">Портфель</h1>

      {/* Общая стоимость */}
      <Card className="mb-4 text-center">
        <p className="text-straw text-sm mb-1">Общая стоимость</p>
        <div className="text-4xl font-bold text-wheat-500">
          <AnimatedCounter value={portfolio?.netWorth?.total ?? 0} duration={1200} />
        </div>
        <p className="text-straw text-xs mt-1">POTATO</p>
      </Card>

      {/* График истории */}
      {portfolio?.history?.[period]?.length > 0 && (
        <Card className="mb-4">
          <div className="flex gap-2 mb-3">
            {(["7d", "30d", "90d"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 rounded-lg text-xs ${period === p ? "bg-wheat-600 text-soil-950" : "bg-soil-800 text-straw"}`}
              >
                {p}
              </button>
            ))}
          </div>
          <div ref={chartRef} />
        </Card>
      )}

      {/* Активы по категориям */}
      <Card className="mb-4">
        <h3 className="text-sm font-semibold text-parchment mb-3">Активы</h3>
        <div className="space-y-3">
          {categories.map((cat) => {
            const value = portfolio?.netWorth?.byCategory?.[cat.key] ?? 0;
            const total = portfolio?.netWorth?.total ?? 1;
            const pct = total > 0 ? (value / total) * 100 : 0;
            return (
              <div key={cat.key}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-straw">{cat.icon} {cat.label}</span>
                  <span className="text-parchment"><AnimatedCounter value={value} duration={600} /></span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <ProgressRing
                    value={value}
                    max={total}
                    size={32}
                    stroke={3}
                    color="#e8a33d"
                    label={`${Math.round(pct)}%`}
                  />
                  <span className="text-straw text-xs flex-1">Доля в портфеле</span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Ресурсы */}
      {activeResources.length > 0 && (
        <Card className="mb-4">
          <h3 className="text-parchment font-semibold text-sm mb-3">📦 Ресурсы ({activeResources.length})</h3>
          <div className="space-y-2">
            {activeResources.slice(0, 10).map((r) => (
              <div key={r.key} className="flex items-center justify-between p-2 rounded-lg bg-soil-800/60">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{r.icon}</span>
                  <span className="text-parchment text-xs">{r.label}</span>
                </div>
                <span className="text-wheat-500 text-xs font-bold">{fmtNum(r.balance)}</span>
              </div>
            ))}
            {activeResources.length > 10 && (
              <p className="text-straw text-xs text-center">+ ещё {activeResources.length - 10} ресурсов</p>
            )}
          </div>
        </Card>
      )}

      {/* Инструменты */}
      {(portfolio?.tools?.length ?? 0) > 0 && (
        <Card className="mb-4">
          <h3 className="text-parchment font-semibold text-sm mb-3">🛠️ Инструменты ({portfolio.tools.length})</h3>
          <div className="grid grid-cols-2 gap-2">
            {portfolio.tools.slice(0, 6).map((t: any) => {
              const rk = rarityKey(t.rarity);
              const durability = Number(t.durability || 20);
              const pct = (durability / 20) * 100;
              return (
                <div key={t.pubkey} className="p-2 rounded-lg bg-soil-800/60">
                  <div className="flex items-center gap-2 mb-1">
                    <ArtPlate src={TOOL_ICON[t.toolType]} alt={t.toolType || "Инструмент"} size={36} />
                    <div className="flex-1">
                      <p className="text-parchment text-[10px] font-medium capitalize">{t.toolType}</p>
                      <p className="text-[9px]" style={{ color: RARITY_META[rk]?.color }}>
                        {RARITY_META[rk]?.label}
                      </p>
                    </div>
                  </div>
                  <div className="h-1 bg-soil-700 rounded-full overflow-hidden">
                    <div className="h-full bg-sprout-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-straw text-[9px] text-right mt-0.5">{durability}/20</p>
                </div>
              );
            })}
          </div>
          {portfolio.tools.length > 6 && (
            <p className="text-straw text-xs text-center mt-2">+ ещё {portfolio.tools.length - 6} инструментов</p>
          )}
        </Card>
      )}

      {/* Активные листинги */}
      {(portfolio?.listings?.length ?? 0) > 0 && (
        <Card className="mb-4">
          <h3 className="text-parchment font-semibold text-sm mb-3">🏷️ Активные листинги ({portfolio.listings.length})</h3>
          <div className="space-y-2">
            {portfolio.listings.slice(0, 5).map((l: any) => (
              <div key={l.pubkey} className="flex items-center justify-between p-2 rounded-lg bg-soil-800/60">
                <div className="flex-1">
                  <p className="text-parchment text-xs font-medium">Листинг</p>
                  <p className="text-straw text-[10px]">Mint: {l.mint?.slice(0, 8)}...</p>
                </div>
                <div className="text-right">
                  <p className="text-wheat-500 text-xs font-bold">{fmtNum(l.pricePotato)} POTATO</p>
                </div>
              </div>
            ))}
            {portfolio.listings.length > 5 && (
              <p className="text-straw text-xs text-center">+ ещё {portfolio.listings.length - 5} листингов</p>
            )}
          </div>
        </Card>
      )}

      {/* Активные ордера */}
      {(portfolio?.orders?.length ?? 0) > 0 && (
        <Card className="mb-4">
          <h3 className="text-parchment font-semibold text-sm mb-3">📊 Активные ордера ({portfolio.orders.length})</h3>
          <div className="space-y-2">
            {portfolio.orders.slice(0, 5).map((o: any) => {
              const amount = Number(o.amountRemaining || 0);
              const price = Number(o.priceLamportsPerUnit || 0) / 1e9;
              return (
                <div key={o.pubkey} className="flex items-center justify-between p-2 rounded-lg bg-soil-800/60">
                  <div className="flex-1">
                    <p className="text-parchment text-xs font-medium">{o.isBuy ? "📈 Покупка" : "📉 Продажа"}</p>
                    <p className="text-straw text-[10px]">Mint: {o.mint?.slice(0, 8)}...</p>
                  </div>
                  <div className="text-right">
                    <p className="text-wheat-500 text-xs font-bold">{fmtNum(amount)} × {price.toFixed(4)} SOL</p>
                  </div>
                </div>
              );
            })}
            {portfolio.orders.length > 5 && (
              <p className="text-straw text-xs text-center">+ ещё {portfolio.orders.length - 5} ордеров</p>
            )}
          </div>
        </Card>
      )}

      {/* Статистика */}
      <Card>
        <h3 className="text-parchment font-semibold text-sm mb-3">📊 Статистика</h3>
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 rounded-lg bg-soil-800/60 text-center">
            <p className="text-2xl font-bold text-wheat-500">{portfolio.stats?.toolsCount ?? 0}</p>
            <p className="text-straw text-[10px]">Инструментов</p>
          </div>
          <div className="p-2 rounded-lg bg-soil-800/60 text-center">
            <p className="text-2xl font-bold text-wheat-500">{portfolio.stats?.listingsCount ?? 0}</p>
            <p className="text-straw text-[10px]">Листингов</p>
          </div>
          <div className="p-2 rounded-lg bg-soil-800/60 text-center">
            <p className="text-2xl font-bold text-wheat-500">{portfolio.stats?.ordersCount ?? 0}</p>
            <p className="text-straw text-[10px]">Ордеров</p>
          </div>
          <div className="p-2 rounded-lg bg-soil-800/60 text-center">
            <p className="text-2xl font-bold text-wheat-500">{portfolio.stats?.compendiumPct ?? 0}%</p>
            <p className="text-straw text-[10px]">Каталог</p>
          </div>
        </div>
      </Card>

      {/* VIP: Расширенная аналитика */}
      <VipGate isVip={false} feature="📊 Расширенная аналитика портфеля">
        <Card>
          <h3 className="text-parchment font-semibold text-sm mb-3">📈 Аналитика (Premium)</h3>
          <div className="space-y-2 text-straw text-xs">
            <p>• Графики доходности по категориям</p>
            <p>• Прогнозы цен на ресурсы</p>
            <p>• Оптимизация портфеля</p>
            <p>• Экспорт данных в CSV</p>
          </div>
        </Card>
      </VipGate>

    </div>
  );
}
