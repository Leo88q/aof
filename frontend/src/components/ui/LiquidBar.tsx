import { motion } from "framer-motion";

interface LiquidBarProps {
  level: number; // 0-100
  color?: string;
  label?: string;
  icon?: string;
}

export function LiquidBar({ level, color = "#00E5A0", label, icon }: LiquidBarProps) {
  const isHigh = level >= 90;
  return (
    <div className="flex items-center gap-3">
      {icon && (icon.startsWith("/") ? (
        <img src={icon} alt="" className="w-6 h-6 object-contain" />
      ) : (
        <span className="text-xl">{icon}</span>
      ))}
      <div className="flex-1">
        {label && (
          <div className="flex justify-between text-xs text-straw mb-1">
            <span>{label}</span>
            <span>{Math.round(level)}%</span>
          </div>
        )}
        <div className="h-3 bg-soil-800 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${level}%` }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className={`h-full rounded-full ${isHigh ? "gold-pulse" : ""}`}
            style={{
              background: `linear-gradient(90deg, ${color}88, ${color})`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
