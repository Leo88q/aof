import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card } from "../../components/ui/Card";
import { FeatureDisabledNotice, isMechanicDisabled } from "../../components/ui/FeatureDisabledNotice";
import { useWalletStore } from "../../store/walletStore";
import { api } from "../../lib/api";
import { useFlash } from "../../lib/marketUtils";
import { getMintAsync } from "../../lib/mints";
import { handleTxResponse } from "../../lib/txFlow";
import { connection } from "../../lib/wallet";
import { UI_ICONS, resourceIcon, toolPlate } from "../../lib/visualAssets";
import { ResourceGlyph } from "../../components/visual/ResourceGlyph";

const EXPLORATION_COST = { data: 75, circuit: 35, silicon: 35, dataset: 50 };

export function ExplorationPage() {
  const { address } = useWalletStore();
  const [txStatus, flash] = useFlash();
  const [loading, setLoading] = useState(false);
  const [bow, setBow] = useState<{ mint: string; pubkey: string } | null>(null);

  useEffect(() => {
    setBow(null);
    if (!address) return;
    api.query.myTools(address)
      .then((tools: any[]) => {
        const found = (tools || []).find((tool: any) =>
          String(tool.toolType || tool.tool_type || "").toLowerCase() === "bow"
        );
        setBow(found?.mint && found?.pubkey ? { mint: found.mint, pubkey: found.pubkey } : null);
      })
      .catch(() => setBow(null));
  }, [address]);

  const bowMint = bow?.mint || null;

  const explorationDisabled = isMechanicDisabled("exploration");

  async function startExploration() {
    if (explorationDisabled) return;
    if (!address) return flash("❌ Connect wallet");
    if (!bowMint) return flash("❌ Инструмент Bow не найден в инвентаре");

    setLoading(true);
    flash("Готовим on-chain commit экспедиции…");

    try {
      const [foodMint, woodMint, stoneMint, meatMint] = await Promise.all([
        getMintAsync("DATA"),
        getMintAsync("CIRCUIT"),
        getMintAsync("SILICON"),
        getMintAsync("DATASET"),
      ]);
      if (!foodMint || !woodMint || !stoneMint || !meatMint) {
        throw new Error("Реальный mint экспедиции не найден в Config/MaterialMints");
      }

      const commitResponse = await api.exploration.startCommit({
        user: address,
        toolMint: bowMint,
        toolData: bow!.pubkey,
        foodMint,
        woodMint,
        stoneMint,
        meatMint,
      });
      const commit = await handleTxResponse(commitResponse);
      if (!commit.success) throw new Error(commit.error || "Commit не выполнен");
      if (commit.signature) await connection.confirmTransaction(commit.signature, "confirmed");

      // Reveal uses the committed hash and recent slot hash; no client-side
      // reward/randomness is invented here.
      const revealResponse = await api.exploration.reveal({
        user: address,
        toolMint: bowMint,
        woodMint,
        stoneMint,
      });
      const reveal = await handleTxResponse(revealResponse);
      if (!reveal.success) throw new Error(reveal.error || "Reveal не выполнен");
      flash("✅ Экспедиция подтверждена on-chain. Обновите балансы.");
    } catch (e: any) {
      flash(`❌ ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 pt-6 pb-24">
      <h1 className="text-2xl font-bold mb-4 flex items-center gap-2"><img src={UI_ICONS.expedition} alt="" className="w-7 h-7 object-contain" /> Исследование</h1>
      {explorationDisabled && <div className="mb-4"><FeatureDisabledNotice id="exploration" /></div>}

      <Card className="mb-4">
        <div className="text-center mb-4">
          <img src={toolPlate("quantum_transmitter") || ""} alt="" className="w-14 h-14 object-contain mx-auto rounded-xl" />
          <h2 className="text-parchment font-bold text-lg mt-3">Глубокое обучение</h2>
          <p className="text-straw text-sm mt-2">Запустите квантовый передатчик в глубокое обучение за редкими ресурсами</p>
        </div>

        <div className="bg-soil-800/60 rounded-xl p-4 mb-4">
          <h3 className="text-parchment font-semibold text-sm mb-3">Стоимость похода:</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-straw inline-flex items-center gap-1.5"><ResourceGlyph icon={resourceIcon("DATA")} alt="" className="w-4 h-4" /> Данные (DATA)</span><span className="text-parchment font-bold">{EXPLORATION_COST.data}</span></div>
            <div className="flex justify-between"><span className="text-straw inline-flex items-center gap-1.5"><ResourceGlyph icon={resourceIcon("CIRCUIT")} alt="" className="w-4 h-4" /> Схема (CIRCUIT)</span><span className="text-parchment font-bold">{EXPLORATION_COST.circuit}</span></div>
            <div className="flex justify-between"><span className="text-straw inline-flex items-center gap-1.5"><ResourceGlyph icon={resourceIcon("SILICON")} alt="" className="w-4 h-4" /> Кремний (SILICON)</span><span className="text-parchment font-bold">{EXPLORATION_COST.silicon}</span></div>
            <div className="flex justify-between border-t border-straw/20 pt-2 mt-2"><span className="text-wheat-500 font-semibold inline-flex items-center gap-1.5"><ResourceGlyph icon={resourceIcon("DATASET")} alt="" className="w-4 h-4" /> Датасет (MEAT)</span><span className="text-wheat-500 font-bold">{EXPLORATION_COST.dataset}</span></div>
          </div>
        </div>

        <div className="bg-gold/10 border border-gold/30 rounded-xl p-4 mb-4">
          <h3 className="text-gold font-semibold text-sm mb-2">Награда при успехе:</h3>
          <p className="text-straw text-xs">Amount WOOD и STONE определяется on-chain энтропией текущего tier.</p>
        </div>

        <div className="bg-purple-600/10 border border-purple-500/30 rounded-xl p-4 mb-4">
          <h3 className="text-purple-400 font-semibold text-sm mb-2">Требования:</h3>
          <ul className="space-y-1 text-xs text-straw">
            <li>✓ Инструмент: <span className="text-parchment">Квантовый передатчик</span></li>
            <li>✓ Ресурсы: Данные, Схема, Кремний, Датасет</li>
            <li>✓ Кулдаун и дневной лимит: определяются tier в программе</li>
          </ul>
        </div>

        {txStatus && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="text-xs px-3 py-2 rounded-xl bg-soil-800 border border-straw/20 text-parchment mb-4">
            {txStatus}
          </motion.div>
        )}

        <button
          onClick={startExploration}
          disabled={explorationDisabled || loading || !address || !bowMint}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-wheat-600 text-white font-bold text-sm disabled:opacity-40 active:scale-95 transition-transform"
        >
          {explorationDisabled ? "Временно недоступно" : loading ? "Отправляем..." : !bowMint ? "Нужен передатчик в инвентаре" : "Отправить в экспедицию"}
        </button>
      </Card>

      <Card>
        <h3 className="text-parchment font-semibold text-sm mb-3">Как это работает:</h3>
        <div className="space-y-2 text-xs text-straw">
          <p>1. <span className="text-parchment">Commit:</span> ресурсы сжигаются, hash фиксируется программой.</p>
          <p>2. <span className="text-parchment">Reveal:</span> сервер передаёт секрет после подтверждения commit.</p>
          <p>3. <span className="text-parchment">Награда:</span> программа либо минтит WOOD/STONE, либо фиксирует неуспех.</p>
        </div>
      </Card>
    </div>
  );
}
