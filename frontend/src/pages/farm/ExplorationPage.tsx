import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card } from "../../components/ui/Card";
import { useWalletStore } from "../../store/walletStore";
import { api } from "../../lib/api";
import { useFlash } from "../../lib/marketUtils";
import { handleTxResponse } from "../../lib/txFlow";
import { UI_ICONS, resourceIcon, toolPlate } from "../../lib/visualAssets";
import { ArtPlate } from "../../components/visual/ArtPlate";
import { ResourceGlyph } from "../../components/visual/ResourceGlyph";
import { humanizeVrfError } from "../../lib/vrfErrors";
import { NoticeMsg } from "../../components/visual/NoticeMsg";

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

  // [F-06] Settled by Switchboard On-Demand: commit here (one signature),
  // the settler reveals within seconds; the player can settle it personally.
  const [commitAddr, setCommitAddr] = useState<string | null>(null);

  async function waitForSettlement(commit: string): Promise<"settled" | "pending"> {
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 2_000));
      const s: any = await api.exploration.status(commit).catch(() => null);
      if (s && s.state !== "pending") return "settled";
    }
    return "pending";
  }

  async function startExploration() {
    if (!address) return flash("❌ Подключите кошелёк");
    if (!bowMint) return flash("Квантовый передатчик не найден в инвентаре");

    setLoading(true);
    flash("Отправляем экспедицию в сеть…");
    try {
      const commitResponse: any = await api.exploration.startCommit({ user: address, toolMint: bowMint });
      const commit = await handleTxResponse(commitResponse);
      if (!commit.success) throw new Error(commit.error || "Экспедиция не запущена");
      setCommitAddr(commitResponse.explorationCommit);
      flash("Экспедиция в пути: ждём раскрытия оракула…", 45_000);
      const state = await waitForSettlement(commitResponse.explorationCommit);
      flash(state === "settled"
        ? "✅ Экспедиция завершена в сети. Обновите балансы."
        : "⏳ Оракул ещё не раскрыл результат — можно раскрыть самостоятельно.", 8000);
    } catch (e: any) {
      flash(`${humanizeVrfError(String(e?.message || e))}`);
    } finally {
      setLoading(false);
    }
  }

  async function selfSettle() {
    if (!address || !commitAddr) return;
    setLoading(true);
    try {
      const resp: any = await api.exploration.reveal({ user: address, explorationCommit: commitAddr });
      const r = await handleTxResponse(resp);
      flash(r.success ? "Результат раскрыт вашей транзакцией" : `${r.error}`);
    } catch (e: any) {
      flash(`${humanizeVrfError(String(e?.message || e))}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 pt-6 pb-24">
      <h1 className="text-2xl font-bold mb-4 flex items-center gap-2"><img src={UI_ICONS.expedition} alt="" className="w-7 h-7 object-contain" /> Исследование</h1>

      <Card className="mb-4">
        <div className="text-center mb-4">
          <ArtPlate src={toolPlate("quantum_transmitter")} alt="" size={56} className="mx-auto" />
          <h2 className="text-parchment font-bold text-lg mt-3">Глубокое обучение</h2>
          <p className="text-straw text-sm mt-2">Запустите квантовый передатчик в глубокое обучение за редкими ресурсами</p>
        </div>

        <div className="bg-soil-800/60 rounded-xl p-4 mb-4">
          <h3 className="text-parchment font-semibold text-sm mb-3">Стоимость похода:</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-straw inline-flex items-center gap-1.5"><ResourceGlyph icon={resourceIcon("DATA")} alt="" className="w-4 h-4" /> Данные (DATA)</span><span className="text-parchment font-bold">{EXPLORATION_COST.data}</span></div>
            <div className="flex justify-between"><span className="text-straw inline-flex items-center gap-1.5"><ResourceGlyph icon={resourceIcon("CIRCUIT")} alt="" className="w-4 h-4" /> Схема (CIRCUIT)</span><span className="text-parchment font-bold">{EXPLORATION_COST.circuit}</span></div>
            <div className="flex justify-between"><span className="text-straw inline-flex items-center gap-1.5"><ResourceGlyph icon={resourceIcon("SILICON")} alt="" className="w-4 h-4" /> Кремний (SILICON)</span><span className="text-parchment font-bold">{EXPLORATION_COST.silicon}</span></div>
            <div className="flex justify-between border-t border-straw/20 pt-2 mt-2"><span className="text-wheat-500 font-semibold inline-flex items-center gap-1.5"><ResourceGlyph icon={resourceIcon("DATASET")} alt="" className="w-4 h-4" /> Датасет (DATASET)</span><span className="text-wheat-500 font-bold">{EXPLORATION_COST.dataset}</span></div>
          </div>
        </div>

        <div className="bg-gold/10 border border-gold/30 rounded-xl p-4 mb-4">
          <h3 className="text-gold font-semibold text-sm mb-2">Награда при успехе:</h3>
          <p className="text-straw text-xs">Успех и количество Схем/Кремния (CIRCUIT/SILICON) определяет оракул Switchboard по tier, зафиксированному при старте.</p>
        </div>

        <div className="bg-nf-purple/10 border border-nf-purple/30 rounded-xl p-4 mb-4">
          <h3 className="text-nf-purple font-semibold text-sm mb-2">Требования:</h3>
          <ul className="space-y-1 text-xs text-straw">
            <li>✓ Инструмент: <span className="text-parchment">Квантовый передатчик</span></li>
            <li>✓ Ресурсы: Данные, Схема, Кремний, Датасет</li>
            <li>✓ Кулдаун и дневной лимит: определяются tier в программе</li>
          </ul>
        </div>

        {txStatus && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="text-xs px-3 py-2 rounded-xl bg-soil-800 border border-straw/20 text-parchment mb-4">
            <NoticeMsg text={txStatus} />
          </motion.div>
        )}

        <button
          onClick={startExploration}
          disabled={loading || !address || !bowMint}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-nf-purple to-wheat-600 text-white font-bold text-sm disabled:opacity-40 active:scale-95 transition-transform"
        >
          {loading ? "Отправляем..." : !bowMint ? "Нужен передатчик в инвентаре" : "Отправить в экспедицию"}
        </button>
        {commitAddr && !loading && (
          <button
            onClick={selfSettle}
            className="w-full mt-2 py-2 rounded-2xl bg-soil-800 border border-straw/20 text-parchment text-xs"
          >
            Раскрыть (или вернуть) последнюю экспедицию самостоятельно
          </button>
        )}
      </Card>

      <Card>
        <h3 className="text-parchment font-semibold text-sm mb-3">Как это работает:</h3>
        <div className="space-y-2 text-xs text-straw">
          <p>1. <span className="text-parchment">Commit:</span> ресурсы сжигаются, hash фиксируется программой.</p>
          <p>2. <span className="text-parchment">Reveal:</span> сервер передаёт секрет после подтверждения commit.</p>
          <p>3. <span className="text-parchment">Награда:</span> программа либо минтит Схемы/Кремний (CIRCUIT/SILICON), либо фиксирует неуспех.</p>
        </div>
      </Card>
    </div>
  );
}
