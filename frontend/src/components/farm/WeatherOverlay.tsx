import { motion } from "framer-motion";

export function WeatherOverlay({ type }: { type: string }) {
  if (type === "rain") {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
        {Array.from({ length: 20 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-0.5 h-3 bg-water-500/40 rounded-full"
            style={{ left: `${(i * 5) % 100}%` }}
            initial={{ top: "-10%" }}
            animate={{ top: "110%" }}
            transition={{
              duration: 1 + Math.random(),
              repeat: Infinity,
              delay: Math.random() * 2,
              ease: "linear",
            }}
          />
        ))}
      </div>
    );
  }

  if (type === "sunny") {
    return (
      <div className="absolute inset-0 pointer-events-none z-10">
        <motion.div
          className="absolute top-2 right-2 text-3xl"
          animate={{ opacity: [0.6, 1, 0.6], scale: [1, 1.1, 1] }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          ☀️
        </motion.div>
      </div>
    );
  }

  if (type === "drought") {
    return (
      <div className="absolute inset-0 pointer-events-none z-10 bg-wheat-800/10" />
    );
  }

  return null;
}
