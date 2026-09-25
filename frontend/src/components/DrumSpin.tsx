import { useState } from "react";
import { motion } from "framer-motion";
import { api } from "../lib/api";
import { useWalletStore } from "../store/walletStore";
import { useFlash } from "../lib/marketUtils";
import { handleTxResponse } from "../lib/txFlow";
import { connection } from "../lib/wallet";
import { UI_ICONS, resourceIcon } from "../lib/visualAssets";
import { ResourceGlyph } from "./visual/ResourceGlyph";
import { NoticeMsg } from "./visual/NoticeMsg";

const PRIZES = [
  { icon: resourceIcon("MIND") || "", label: "10 MASCOT", weight: 40 },
  { icon: resourceIcon("MIND") || "", label: "25 MASCOT", weight: 30 },
  { icon: resourceIcon("MIND") || "", label: "50 MASCOT", weight: 20 },
  { icon: resourceIcon("MIND") || "", label: "150 MASCOT", weight: 9 },
  { icon: resourceIcon("QUANTUM_BIT") || "", label: "500 MASCOT", weight: 1 },
];

export function DrumSpin() {
  const { address } = useWalletStore();
  const [status, flash] = useFlash();
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<{ icon: string; label: string } | null>(null);

  async function handleSpin() {
    if (!address) return flash("❌ Connect wallet");
    if (spinning) return;

    setSpinning(true);
    setResult(null);

    try {
      const commitResponse = await api.drum.commit({ user: address });
      const commit = await handleTxResponse(commitResponse);
      if (!commit.success) throw new Error(commit.error || "Commit барабана не выполнен");

      if (commit.signature) {
        await connection.confirmTransaction(commit.signature, "confirmed");
      }

      // The backend reads the committed secret and the on-chain program derives
      // the prize. No client-side randomness or fake prize is displayed.
      const revealResponse = await api.drum.reveal({ user: address });
      const reveal = await handleTxResponse(revealResponse);
      if (!reveal.success) throw new Error(reveal.error || "Reveal барабана не выполнен");

      setResult({ icon: UI_ICONS.rewardStar, label: "Приз распределён on-chain" });
      flash("🎉 Результат подтверждён в блокчейне. Обновите баланс MASCOT.");
    } catch (e: any) {
      flash(`❌ Error: ${e.message}`);
    } finally {
      setSpinning(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-soil-800 p-4 rounded-xl border border-straw/10">
        <div>
          <h3 className="text-parchment font-semibold flex items-center gap-2">
            <img src={UI_ICONS.drum} alt="" className="w-5 h-5 object-contain" />
            Барабан удачи
          </h3>
          <p className="text-straw text-xs">Один спин стоит 5 MASCOT. Баланс проверяет программа.</p>
        </div>
        <div className="text-3xl font-bold text-gold">5</div>
      </div>

      {status && <div className="text-center text-straw text-sm"><NoticeMsg text={status} /></div>}

      <div className="relative flex flex-col items-center justify-center py-8 bg-gradient-to-b from-soil-800 to-soil-900 rounded-2xl border-2 border-wheat-600/30">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 text-4xl drop-shadow-lg">🔻</div>

        <motion.div
          className="w-48 h-48 rounded-full bg-soil-700 border-4 border-gold/50 flex items-center justify-center overflow-hidden relative"
          animate={spinning ? { rotate: 360 * 5 } : { rotate: 0 }}
          transition={spinning ? { duration: 3, ease: "circOut" } : { duration: 0.5 }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            {spinning ? (
              <ResourceGlyph icon={UI_ICONS.drum} alt="" className="w-16 h-16 animate-pulse" />
            ) : result ? (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-center">
                <div className="text-6xl mb-2">{result.icon}</div>
                <div className="text-parchment font-bold text-sm">{result.label}</div>
              </motion.div>
            ) : (
              <ResourceGlyph icon={UI_ICONS.rewardDaily} alt="" className="w-16 h-16" />
            )}
          </div>
        </motion.div>

        <button
          onClick={handleSpin}
          disabled={spinning || !address}
          className="mt-8 px-8 py-3 rounded-2xl bg-gradient-to-r from-gold to-wheat-600 text-soil-950 font-bold text-lg shadow-lg shadow-gold/20 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {spinning ? "Крутим..." : <span className="inline-flex items-center gap-1.5"><ResourceGlyph icon={UI_ICONS.drum} alt="" className="w-5 h-5" /> Крутить барабан</span>}
        </button>
      </div>

      <div className="bg-soil-800 p-4 rounded-xl border border-straw/10">
        <h3 className="text-parchment font-semibold mb-3 text-center">Возможные призы</h3>
        <div className="grid grid-cols-2 gap-3">
          {PRIZES.map((prize, i) => (
            <div key={i} className="flex items-center gap-3 p-2 bg-soil-700/50 rounded-lg">
              <span className="text-2xl">{prize.icon}</span>
              <div>
                <div className="text-parchment text-sm font-medium">{prize.label}</div>
                <div className="text-straw text-xs">{prize.weight}% шанс</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-center text-straw text-xs">
        💡 Результат определяется секретом commit и проверяется программой aof-quests.
      </p>
    </div>
  );
}
