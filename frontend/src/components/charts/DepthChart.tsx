import { motion } from 'framer-motion';
import type { Language } from '../../i18n/translations';
import { orderbookCopy } from '../../i18n/orderbookCopy';
import { formatResourceUnits, priceSolPerResource } from '../../lib/orderbookReadings';
import { UI_ICONS } from '../../lib/visualAssets';
import { ResourceGlyph } from '../visual/ResourceGlyph';

type OrderLevel = { price: string; amount: string };
type Props = { bids: OrderLevel[]; asks: OrderLevel[]; language: Language };

// Depth and labels use atomic strings. Number arithmetic would round large
// quotes and could turn tiny, non-zero balances into apparent zeros.
export function DepthChart({ bids, asks, language }: Props) {
  const copy = orderbookCopy[language];
  const accumulate = (levels: OrderLevel[]) => {
    let volume = 0n;
    return levels.map(level => {
      volume += BigInt(level.amount);
      return { price: level.price, volume };
    });
  };
  const sell = accumulate(asks);
  const buy = accumulate(bids);
  const max = [sell[sell.length - 1]?.volume ?? 0n, buy[buy.length - 1]?.volume ?? 0n, 1n]
    .reduce((a, b) => a > b ? a : b);
  const section = (levels: typeof sell, side: 'sell' | 'buy') => (
    <div className="space-y-1">
      {levels.length === 0 && <p className="text-straw text-xs px-2 py-1">{side === 'sell' ? copy.noAsks : copy.noBids}</p>}
      {levels.slice(0, 4).map((level, i) => (
        <motion.div key={`${side}-${i}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="relative flex justify-between gap-2 items-center px-2 py-1 rounded-lg overflow-hidden min-w-0">
          <div className={`absolute inset-y-0 ${side === 'sell' ? 'right-0 bg-accent-700/30' : 'left-0 bg-sprout-600/30'} rounded-lg`}
            style={{ width: `${Number(level.volume * 100n / max)}%` }} />
          <span className="text-parchment text-xs relative z-10 break-all min-w-0">{priceSolPerResource(level.price, language)} SOL</span>
          <span className="text-straw text-xs relative z-10 shrink-0">Σ {formatResourceUnits(level.volume)}</span>
        </motion.div>
      ))}
    </div>
  );
  return <div className="space-y-3 min-w-0">
    <div className="flex flex-wrap justify-between gap-2 text-xs text-straw">
      <span className="inline-flex items-center gap-1"><ResourceGlyph icon={UI_ICONS.chartsDown} alt="" className="w-4 h-4" />{copy.asks}</span>
      <span className="inline-flex items-center gap-1"><ResourceGlyph icon={UI_ICONS.chartsUp} alt="" className="w-4 h-4" />{copy.bids}</span>
    </div>
    {section(sell, 'sell')}
    <div className="text-center text-[10px] text-straw py-1">— {copy.spread} —</div>
    {section(buy, 'buy')}
  </div>;
}
