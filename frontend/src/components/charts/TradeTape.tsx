import { motion, AnimatePresence } from "framer-motion";

interface Trade {
  ts: string;
  pricePotato: number;
  side: string;
  mint?: string;
}

export function TradeTape({ trades }: { trades: Trade[] }) {
  return (
    <div className="space-y-1 max-h-48 overflow-y-auto">
      <AnimatePresence>
        {trades.slice(0, 10).map((trade, i) => (
          <motion.div
            key={`${trade.ts}-${i}`}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-between px-2 py-1.5 bg-soil-800/50 rounded-lg text-xs"
          >
            <span className="text-straw">
              {new Date(trade.ts).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
            </span>
            <span className={trade.side === "buy" ? "text-sprout-500" : "text-wheat-700"}>
              {trade.side === "buy" ? "🪴 покупка" : trade.side === "sell" ? "🪣 продажа" : "⚙️ кранк"}
            </span>
            <span className="text-parchment font-medium">{trade.pricePotato.toFixed(4)}</span>
          </motion.div>
        ))}
      </AnimatePresence>
      {trades.length === 0 && (
        <p className="text-straw text-xs text-center py-4">Пока нет сделок</p>
      )}
    </div>
  );
}
