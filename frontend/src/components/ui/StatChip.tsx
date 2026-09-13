import { motion } from "framer-motion";

interface StatChipProps {
  icon: string;
  value: string | number;
  label?: string;
  accent?: "green" | "gold" | "water" | "neutral";
}

const accentColors = {
  green: "text-sprout-500",
  gold: "text-wheat-500",
  water: "text-water-500",
  neutral: "text-parchment",
};

export function StatChip({ icon, value, label, accent = "neutral" }: StatChipProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 px-3 py-2 bg-soil-850 rounded-2xl shadow-card"
    >
      <span className="text-lg">{icon}</span>
      <div className="flex flex-col">
        <span className={`text-sm font-semibold ${accentColors[accent]}`}>{value}</span>
        {label && <span className="text-[10px] text-straw">{label}</span>}
      </div>
    </motion.div>
  );
}
