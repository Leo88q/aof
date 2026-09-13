import { motion } from "framer-motion";

interface TrustRingProps {
  score: number; // 0-1000
  tier: number;  // 1-5
  size?: number;
}

// Метафора роста: росток → саженец → колос → полный урожай
const tierMeta: Record<number, { icon: string; label: string; color: string }> = {
  1: { icon: "🌱", label: "Росток", color: "#6bbf59" },
  2: { icon: "🌿", label: "Саженец", color: "#4e9d42" },
  3: { icon: "🌾", label: "Колос", color: "#e8a33d" },
  4: { icon: "🌻", label: "Урожай", color: "#d97941" },
  5: { icon: "👑", label: "Полный урожай", color: "#b8863b" },
};

export function TrustRing({ score, tier, size = 120 }: TrustRingProps) {
  const meta = tierMeta[tier] || tierMeta[1];
  const progress = Math.min(score / 1000, 1);
  const radius = size / 2 - 8;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Фоновое кольцо */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#3d3226"
          strokeWidth="6"
        />
        {/* Прогресс */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={meta.color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        />
      </svg>
      {/* Иконка тира в центре */}
      <div className="absolute flex flex-col items-center">
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.5, type: "spring" }}
          className="text-3xl"
        >
          {meta.icon}
        </motion.span>
        <span className="text-xs text-straw mt-1">{score}</span>
      </div>
    </div>
  );
}
