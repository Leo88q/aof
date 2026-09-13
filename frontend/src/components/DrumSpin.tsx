import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../lib/api";
import { useWalletStore } from "../store/walletStore";
import { useFlash } from "../lib/marketUtils";

const PRIZES = [
  { icon: "🪵", label: "100 WOOD", weight: 40 },
  { icon: "🪨", label: "50 STONE", weight: 30 },
  { icon: "🌾", label: "200 FOOD", weight: 20 },
  { icon: "🪓", label: "Rare Tool", weight: 8 },
  { icon: "💎", label: "Legendary Gem", weight: 2 },
];

export function DrumSpin() {
  const { address } = useWalletStore();
  const [txStatus, flash] = useFlash();
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [spinsLeft, setSpinsLeft] = useState(1); // Можно расширить до проверки баланса

  // Симуляция вращения (в проде здесь будет вызов api.drum.commit + reveal)
  async function handleSpin() {
    if (!address) return flash("❌ Подключите кошелёк");
    if (spinning) return;

    setSpinning(true);
    setResult(null);

    try {
      // 1. Commit (в проде: api.drum.commit({ user: address }))
      // Для демо используем задержку и случайный результат
      await new Promise((r) => setTimeout(r, 2000));

      // 2. Reveal (в проде: api.drum.reveal({ user: address, secret }))
      const random = Math.random() * 100;
      let cumulative = 0;
      let selectedPrize = PRIZES[0];
      
      for (const prize of PRIZES) {
        cumulative += prize.weight;
        if (random <= cumulative) {
          selectedPrize = prize;
          break;
        }
      }

      setResult(selectedPrize);
      setSpinsLeft((prev) => Math.max(0, prev - 1));
      flash(`🎉 Вы выиграли: ${selectedPrize.label}!`);
      
      // TODO: В проде здесь вызов api.drum.reveal и обновление баланса
    } catch (e: any) {
      flash(`❌ Ошибка: ${e.message}`);
    } finally {
      setSpinning(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Информация о спинах */}
      <div className="flex justify-between items-center bg-soil-800 p-4 rounded-xl border border-straw/10">
        <div>
          <h3 className="text-parchment font-semibold">Доступно спинов</h3>
          <p className="text-straw text-xs">Каждый спин стоит 10 CORE</p>
        </div>
        <div className="text-3xl font-bold text-gold">{spinsLeft}</div>
      </div>

      {/* Барабан */}
      <div className="relative flex flex-col items-center justify-center py-8 bg-gradient-to-b from-soil-800 to-soil-900 rounded-2xl border-2 border-wheat-600/30">
        {/* Указатель */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 text-4xl drop-shadow-lg">
          🔻
        </div>

        {/* Вращающийся элемент */}
        <motion.div
          className="w-48 h-48 rounded-full bg-soil-700 border-4 border-gold/50 flex items-center justify-center overflow-hidden relative"
          animate={
            spinning
              ? { rotate: 360 * 5 } // 5 полных оборотов
              : { rotate: 0 }
          }
          transition={
            spinning
              ? { duration: 3, ease: "circOut" }
              : { duration: 0.5 }
          }
        >
          {/* Сектора барабана (визуализация) */}
          <div className="absolute inset-0 flex items-center justify-center">
            {spinning ? (
              <div className="text-6xl animate-pulse">🎡</div>
            ) : result ? (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="text-center"
              >
                <div className="text-6xl mb-2">{result.icon}</div>
                <div className="text-parchment font-bold text-sm">{result.label}</div>
              </motion.div>
            ) : (
              <div className="text-6xl">🎁</div>
            )}
          </div>
        </motion.div>

        {/* Кнопка спина */}
        <button
          onClick={handleSpin}
          disabled={spinning || spinsLeft === 0}
          className="mt-8 px-8 py-3 rounded-2xl bg-gradient-to-r from-gold to-wheat-600 text-soil-950 font-bold text-lg shadow-lg shadow-gold/20 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {spinning ? "Крутим..." : spinsLeft > 0 ? "🎡 Крутить барабан" : "Нет спинов"}
        </button>
      </div>

      {/* Таблица призов */}
      <div className="bg-soil-800 p-4 rounded-xl border border-straw/10">
        <h3 className="text-parchment font-semibold mb-3 text-center">Возможные призы</h3>
        <div className="grid grid-cols-2 gap-3">
          {PRIZES.map((prize, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-2 bg-soil-700/50 rounded-lg"
            >
              <span className="text-2xl">{prize.icon}</span>
              <div>
                <div className="text-parchment text-sm font-medium">{prize.label}</div>
                <div className="text-straw text-xs">{prize.weight}% шанс</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Подсказка */}
      <p className="text-center text-straw text-xs">
        💡 Совет: Выполняйте comeback-челленджи, чтобы получить бесплатные спины!
      </p>
    </div>
  );
}
