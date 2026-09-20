import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../../lib/api";
import { handleTxResponse } from "../../lib/txFlow";
import { useWalletStore } from "../../store/walletStore";
import { Card } from "../../components/ui/Card";
import { TOOL_ICON, RARITY_META, rarityKey } from "../../lib/toolMeta";
import { fmtSol, shortAddr, toNum, useTreasury, useFlash } from "../../lib/marketUtils";

const PACKS = [
  { type: "small", idx: 0, label: "Малый пак", icon: "📦", desc: "Старт фермера" },
  { type: "medium", idx: 1, label: "Средний пак", icon: "🎁", desc: "Больше редкости" },
  { type: "big", idx: 2, label: "Большой пак", icon: "🧰", desc: "Максимальный шанс" },
];
const RARITY_LABELS = ["Common", "Uncommon", "Rare", "Epic", "Legendary"];

type Stage = "idle" | "prep" | "pay" | "reveal" | "result";

export function PacksPage() {
  const { address } = useWalletStore();
  const treasury = useTreasury();
  const [configs, setConfigs] = useState<any[]>([null, null, null]);
  const [stage, setStage] = useState<Stage>("idle");
  const [result, setResult] = useState<any>(null);
  const [txStatus, flash] = useFlash();

  useEffect(() => {
    PACKS.forEach((p) => {
      api.query.packConfig(p.idx)
        .then((c: any) => setConfigs((s) => { const n = [...s]; n[p.idx] = c; return n; }))
        .catch(() => {});
    });
  }, []);

  async function openPack(p: typeof PACKS[0]) {
    if (!address) return flash("❌ Connect wallet (кнопка вверху)", 6000);
    if (!treasury) return flash("❌ Treasury config unavailable", 6000);
    setResult(null);
    try {
      setStage("prep");
      flash("Шаг 1/3 · Готовим минт инструмента…", 15000);
      const prep = await api.tools.prepMint({ owner: address });
      const rp = await handleTxResponse(prep);
      if (!rp.success || !prep.mint) {
        setStage("idle");
        return flash(`❌ ${rp.error || "минт не создан"}`, 6000);
      }
      const mint = prep.mint;

      setStage("pay");
      flash("Шаг 2/3 · Подтвердите оплату пака в кошельке…", 60000);
      const commit = await api.packs.commit({ user: address, mint, packType: p.type });
      const rc = await handleTxResponse(commit);
      if (!rc.success) {
        setStage("idle");
        return flash(`❌ Оплата: ${rc.error}`, 6000);
      }

      setStage("reveal");
      flash("Шаг 3/3 · Пак открывается…", 15000);
      await new Promise((r) => setTimeout(r, 1200));
      const reveal = await api.packs.reveal({ user: address, mint, packType: p.type });
      const rr = await handleTxResponse(reveal);
      if (!rr.success) {
        setStage("idle");
        return flash(`❌ Открытие: ${rr.error}`, 6000);
      }

      await new Promise((r) => setTimeout(r, 1800));
      const tool = await api.query.tool(mint).catch(() => null);
      setResult({ pack: p, tool, mint });
      setStage("result");
    } catch (e: any) {
      setStage("idle");
      flash(`❌ ${e.message}`, 6000);
    }
  }

  const resRk = result?.tool ? rarityKey(result.tool.rarity) : "common";

  return (
    <div className="p-4 pt-2 pb-24 space-y-4">
      <p className="text-straw text-xs">
        Пак — мешок семян: внутри инструмент случайной редкости. Веса прозрачны и лежат ончейн (честный розыгрыш комит-ревил).
      </p>

      {txStatus && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="text-xs px-3 py-2 rounded-xl bg-soil-800 border border-straw/20 text-parchment">
          {txStatus}
        </motion.div>
      )}

      <div className="grid grid-cols-1 gap-3">
        {PACKS.map((p, i) => {
          const cfg = configs[p.idx];
          return (
            <motion.div key={p.type} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}>
              <Card className="border border-straw/10">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">{p.icon}</span>
                  <div className="flex-1">
                    <p className="text-parchment font-semibold">{p.label}</p>
                    <p className="text-straw text-xs">{p.desc}</p>
                    {cfg ? (
                      <p className="text-wheat-500 font-bold mt-1">{fmtSol(cfg.priceLamports)} ◎</p>
                    ) : (
                      <p className="text-straw text-xs mt-1">цена загружается…</p>
                    )}
                  </div>
                  <button onClick={() => openPack(p)} disabled={stage !== "idle"}
                    className="px-4 py-2 rounded-xl bg-sprout-500 text-white text-sm font-semibold disabled:opacity-40">
                    Открыть
                  </button>
                </div>
                {cfg?.oddsBps && Array.isArray(cfg.oddsBps) && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {cfg.oddsBps.map((w: any, ri: number) =>
                      toNum(w) > 0 ? (
                        <span key={ri} className="text-xs px-2 py-0.5 rounded-lg bg-soil-800 border border-straw/10"
                          style={{ color: RARITY_META[RARITY_LABELS[ri].toLowerCase()]?.color }}>
                          {RARITY_LABELS[ri]} {(toNum(w) / 100).toFixed(1)}%
                        </span>
                      ) : null
                    )}
                  </div>
                )}
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Оверлей открытия */}
      <AnimatePresence>
        {(stage === "prep" || stage === "pay" || stage === "reveal") && (
          <motion.div className="fixed inset-0 bg-black/85 z-50 flex flex-col items-center justify-center p-6"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div
              animate={stage === "reveal"
                ? { rotate: [0, -10, 10, -12, 12, 0], scale: [1, 1.06, 1.12] }
                : stage === "pay"
                  ? { y: [0, -6, 0] }
                  : { rotate: [0, -3, 3, 0] }}
              transition={{ repeat: Infinity, duration: stage === "reveal" ? 0.45 : 1.2 }}
              className="text-8xl">
              {stage === "reveal" ? "✨" : "🎁"}
            </motion.div>
            <p className="text-parchment mt-4 text-sm text-center">
              {stage === "prep" ? "Готовим минт инструмента…"
                : stage === "pay" ? "Подтвердите оплату пака в кошельке"
                : "Пак трясётся… что там внутри?"}
            </p>
          </motion.div>
        )}

        {stage === "result" && result && (
          <motion.div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-6"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div initial={{ scale: 0.5, y: 40 }} animate={{ scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
              className="bg-soil-850 rounded-3xl p-8 max-w-sm w-full text-center"
              style={{ boxShadow: `0 0 60px ${RARITY_META[resRk]?.color}66` }}>
              <motion.div initial={{ scale: 0 }} animate={{ scale: [0, 1.35, 1] }} transition={{ duration: 0.6 }}
                className="text-7xl">
                {TOOL_ICON[result.tool?.toolType] || "🛠️"}
              </motion.div>
              <h3 className="text-parchment font-bold text-xl mt-4">{result.tool?.toolType || "Инструмент"}</h3>
              <p className="font-bold mt-1 text-lg" style={{ color: RARITY_META[resRk]?.color }}>
                {RARITY_META[resRk]?.label || resRk}
              </p>
              <p className="text-straw text-xs mt-2">{shortAddr(result.mint)}</p>
              <button onClick={() => { setStage("idle"); setResult(null); }}
                className="mt-6 w-full py-3 rounded-2xl bg-wheat-600 text-white font-semibold">
                Забрать в инвентарь 🧺
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
