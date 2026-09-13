import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../lib/api";
import { useFlash } from "../lib/marketUtils";

interface ComebackModalProps {
  bonus: {
    id: string;
    absenceDays: number;
    type: string;
    reward: { core: number; drumSpin?: boolean; forgeFree?: boolean };
    message: string;
  };
  onClose: () => void;
}

export function ComebackModal({ bonus, onClose }: ComebackModalProps) {
  const [txStatus, flash] = useFlash();
  const [claiming, setClaiming] = useState(false);

  async function handleClaim() {
    setClaiming(true);
    try {
      const resp = await api.comeback.claim({ id: bonus.id });
      if (resp.success) {
        flash("🎉 Подарок отправлен в вашу почту!");
        onClose();
      } else {
        flash(`❌ ${resp.error}`);
      }
    } catch (e: any) {
      flash(`❌ ${e.message}`);
    } finally {
      setClaiming(false);
    }
  }

  const rewardText = [
    `${bonus.reward.core} WOOD`,
    bonus.reward.drumSpin ? "+ 🎡 Спин барабана" : null,
    bonus.reward.forgeFree ? "+ 🔨 Бесплатная ковка" : null,
  ].filter(Boolean).join(" ");

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="bg-gradient-to-br from-gold/20 to-soil-850 rounded-3xl p-6 max-w-sm w-full border-2 border-gold/40"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-center mb-4">
            <motion.div
              animate={{ rotate: [0, -10, 10, 0] }}
              transition={{ duration: 0.6, repeat: 2 }}
              className="text-6xl mb-3"
            >
              🎁
            </motion.div>
            <h2 className="text-parchment font-bold text-xl">С возвращением!</h2>
            <p className="text-straw text-sm mt-2">{bonus.message}</p>
            <p className="text-wheat-500 text-xs mt-1">
              Пропущено дней: {bonus.absenceDays}
            </p>
          </div>

          <div className="bg-soil-800/60 rounded-2xl p-4 mb-4 border border-straw/10">
            <p className="text-straw text-xs mb-2">Ваш подарок:</p>
            <p className="text-gold font-bold text-lg">{rewardText}</p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={claiming}
              className="flex-1 py-3 rounded-2xl bg-soil-800 text-straw font-semibold text-sm disabled:opacity-40"
            >
              Позже
            </button>
            <button
              onClick={handleClaim}
              disabled={claiming}
              className="flex-1 py-3 rounded-2xl bg-gold text-soil-950 font-bold text-sm disabled:opacity-40 active:scale-95 transition-transform"
            >
              {claiming ? "Отправляем..." : "🎁 Забрать"}
            </button>
          </div>

          <p className="text-straw/60 text-xs text-center mt-3">
            Награда придёт в вашу почту (Inbox)
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
