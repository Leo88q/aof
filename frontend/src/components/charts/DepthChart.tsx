import { motion } from "framer-motion";
import { UI_ICONS } from "../../lib/visualAssets";
import { ResourceGlyph } from "../visual/ResourceGlyph";

interface OrderLevel {
  price: number;
  amount: number;
}

interface DepthChartProps {
  bids: OrderLevel[]; // лопата (покупка)
  asks: OrderLevel[]; // корзина (продажа)
}

// [ФИКС Средний] Кумулятивная глубина вместо списка разовых объёмов:
// каждый уровень показывает накопленный объём, ширина бара — кумулятивная
// глубина до этой цены (как в настоящих стакан-чартах).
export function DepthChart({ bids, asks }: DepthChartProps) {
  const cumAsks = asks.map((lvl, i) => ({
    ...lvl,
    cumulative: asks.slice(0, i + 1).reduce((s, x) => s + x.amount, 0),
  }));
  const cumBids = bids.map((lvl, i) => ({
    ...lvl,
    cumulative: bids.slice(0, i + 1).reduce((s, x) => s + x.amount, 0),
  }));
  const maxCum = Math.max(
    cumAsks.length ? cumAsks[cumAsks.length - 1].cumulative : 0,
    cumBids.length ? cumBids[cumBids.length - 1].cumulative : 0,
    1
  );

  return (
    <div className="space-y-3">
      {/* Заголовки */}
      <div className="flex justify-between text-xs text-straw">
        <span className="flex items-center gap-1"><ResourceGlyph icon={UI_ICONS.chartsDown} alt="" className="w-4 h-4" /> корзина (продажа)</span>
        <span className="flex items-center gap-1"><ResourceGlyph icon={UI_ICONS.chartsUp} alt="" className="w-4 h-4" /> лопата (покупка)</span>
      </div>

      {/* Asks (корзины) — сверху, кумулятив растёт вниз */}
      <div className="space-y-1">
        {cumAsks.length === 0 && (
          <p className="text-straw text-xs px-2 py-1">Очередь пуста — продавать нечего</p>
        )}
        {cumAsks.slice(0, 4).map((ask, i) => (
          <motion.div
            key={`ask-${i}`}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="relative flex justify-between items-center px-2 py-1 rounded-lg overflow-hidden"
          >
            <div
              className="absolute inset-y-0 right-0 bg-wheat-700/30 rounded-lg"
              style={{ width: `${(ask.cumulative / maxCum) * 100}%` }}
            />
            <span className="text-wheat-700 text-xs relative z-10">{ask.price.toFixed(4)}</span>
            <span className="text-straw text-xs relative z-10">Σ {ask.cumulative}</span>
          </motion.div>
        ))}
      </div>

      {/* Спред */}
      <div className="text-center text-[10px] text-straw py-1">
        ─── спред ───
      </div>

      {/* Bids (лопаты) — снизу, кумулятив растёт вверх */}
      <div className="space-y-1">
        {cumBids.length === 0 && (
          <p className="text-straw text-xs px-2 py-1">Уровни поддержки отсутствуют</p>
        )}
        {cumBids.slice(0, 4).map((bid, i) => (
          <motion.div
            key={`bid-${i}`}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="relative flex justify-between items-center px-2 py-1 rounded-lg overflow-hidden"
          >
            <div
              className="absolute inset-y-0 left-0 bg-sprout-600/30 rounded-lg"
              style={{ width: `${(bid.cumulative / maxCum) * 100}%` }}
            />
            <span className="text-sprout-500 text-xs relative z-10">{bid.price.toFixed(4)}</span>
            <span className="text-straw text-xs relative z-10">Σ {bid.cumulative}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
