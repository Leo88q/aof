import { motion } from "framer-motion";
import { useState } from "react";
import { UI_ICONS, resourceIcon } from "../../lib/visualAssets";
import { ResourceGlyph } from "../visual/ResourceGlyph";

interface RewardBurstProps {
  onClaim: () => void;
  rewardLabel: string;
}

// Сундук трясётся → открывается → лучи → награда вылетает частицами
export function RewardBurst({ onClaim, rewardLabel }: RewardBurstProps) {
  const [stage, setStage] = useState<"idle" | "shaking" | "burst" | "done">("idle");

  function handleClick() {
    if (stage !== "idle") return;
    setStage("shaking");
    setTimeout(() => setStage("burst"), 800);
    setTimeout(() => {
      setStage("done");
      onClaim();
    }, 1600);
  }

  if (stage === "done") {
    return (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="text-center py-2"
      >
        <span className="text-2xl">✅</span>
        <p className="text-sprout-500 text-sm mt-1">Получено: {rewardLabel}</p>
      </motion.div>
    );
  }

  return (
    <div className="relative flex flex-col items-center py-2">
      {/* Лучи при открытии */}
      {stage === "burst" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1.5 }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <div className="w-32 h-32 rounded-full bg-wheat-500/30 blur-xl" />
        </motion.div>
      )}

      {/* Сундук */}
      <motion.button
        onClick={handleClick}
        animate={
          stage === "shaking"
            ? { rotate: [0, -8, 8, -8, 8, 0] }
            : stage === "burst"
            ? { scale: [1, 1.2, 0] }
            : {}
        }
        transition={{ duration: stage === "shaking" ? 0.8 : 0.6 }}
        className="text-5xl relative z-10"
      >
        {stage === "burst" ? (
          <ResourceGlyph icon={UI_ICONS.rewardSpark} alt="" className="w-14 h-14" />
        ) : (
          <ResourceGlyph icon={UI_ICONS.rewardCapsule} alt="" className="w-14 h-14" />
        )}
      </motion.button>

      {/* Частицы при взрыве */}
      {stage === "burst" && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = (i / 12) * Math.PI * 2;
            const particleIcons = [UI_ICONS.tokenCoin, UI_ICONS.rewardStar, resourceIcon("SYNAPSE") || "", resourceIcon("QUANTUM_BIT") || ""];
            return (
              <motion.span
                key={i}
                className="absolute"
                initial={{ x: 0, y: 0, opacity: 1 }}
                animate={{
                  x: Math.cos(angle) * 80,
                  y: Math.sin(angle) * 80,
                  opacity: 0,
                }}
                transition={{ duration: 0.8 }}
              >
                <ResourceGlyph icon={particleIcons[i % 4]} alt="" className="w-5 h-5" />
              </motion.span>
            );
          })}
        </div>
      )}

      {stage === "idle" && (
        <p className="text-straw text-xs mt-2">Нажми чтобы открыть</p>
      )}
    </div>
  );
}
