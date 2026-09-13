import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface PriceHeaderProps {
  price: number;
  prevPrice?: number;
  label?: string;
}

export function PriceHeader({ price, prevPrice, label }: PriceHeaderProps) {
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (prevPrice === undefined) return;
    if (price > prevPrice) setFlash("up");
    else if (price < prevPrice) setFlash("down");
    const timer = setTimeout(() => setFlash(null), 600);
    return () => clearTimeout(timer);
  }, [price, prevPrice]);

  const trend = price > (prevPrice ?? price) ? "↑" : price < (prevPrice ?? price) ? "↓" : "•";
  const trendColor = flash === "up" ? "text-sprout-500" : flash === "down" ? "text-wheat-700" : "text-straw";

  return (
    <div className="flex items-baseline gap-3">
      <motion.span
        key={price}
        initial={{ scale: 1.05, opacity: 0.7 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`text-3xl font-bold ${trendColor}`}
      >
        {price.toFixed(4)}
      </motion.span>
      <span className={`text-xl ${trendColor}`}>{trend}</span>
      {label && <span className="text-straw text-sm">{label}</span>}
    </div>
  );
}
