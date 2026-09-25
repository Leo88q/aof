import { useState } from "react";
import { motion } from "framer-motion";
import { RARITY_META, rarityKey } from "../lib/toolMeta";
import { toolPlate, UI_ICONS, resourceIcon } from "../lib/visualAssets";
import { ResourceGlyph } from "./visual/ResourceGlyph";
import { ArtPlate } from "./visual/ArtPlate";
import { NoticeMsg } from "./visual/NoticeMsg";
import { useCountdown } from "../lib/useCountdown";
import { api } from "../lib/api";
import { handleTxResponse } from "../lib/txFlow";
import { useWalletStore } from "../store/walletStore";
import { toNum } from "../lib/marketUtils";

interface ToolMiningCardProps {
  tool: any;
  onAction?: (action: string, payload: any) => Promise<any>;
  onChanged?: () => void;
}

/**
 * Живая карточка инструмента (ТЗ v3 §2.4–2.5):
 * стейк = «уехать на склад», майнинг = экстрактор, сбор = контейнер.
 * Реальные вызовы /tools/stake|start-mining|collect-mining|unstake + подпись кошелька.
 */
// Keep the feature fail-closed until the on-chain program has passed build and
// validator tests. Enable explicitly only in a verified test environment.
const MINING_ENABLED = (import.meta as any).env?.VITE_MINING_ENABLED === "true";

export function ToolMiningCard({ tool, onChanged }: ToolMiningCardProps) {
  const { address } = useWalletStore();
  const rk = rarityKey(tool.rarity);
  const meta = RARITY_META[rk] || RARITY_META.common;
  const icon = toolPlate(tool.toolType, rk) || UI_ICONS.adminGear;

  const [hours, setHours] = useState(4);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const miningEnd = tool.isMining ? toNum(tool.miningEnd) : 0;
  const { label, done } = useCountdown(miningEnd || null);

  const flashMsg = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 6000);
  };

  async function run(kind: "stake" | "start" | "collect" | "unstake") {
    if ((kind === "start" || kind === "collect") && !MINING_ENABLED) {
      return flashMsg("⏸️ Добыча отключена до проверки on-chain в тестовой сети");
    }
    if (!address) return flashMsg("❌ Connect wallet (кнопка вверху)");
    setBusy(true);
    try {
      let resp: any;
      if (kind === "stake") {
        flashMsg("Инструмент уходит на склад…");
        resp = await api.tools.stake({ user: address, mint: tool.mint, lockSeconds: String(86400) });
      } else if (kind === "unstake") {
        flashMsg("Инструмент возвращается…");
        resp = await api.tools.unstake({ user: address, mint: tool.mint });
      } else if (kind === "start") {
        flashMsg("Экстрактор запущен…");
        resp = await api.tools.startMining({ user: address, mint: tool.mint, hours });
      } else {
        flashMsg("Открываем контейнер…");
        resp = await api.tools.collectMining({ user: address, mint: tool.mint });
      }
      const r = await handleTxResponse(resp);
      flashMsg(r.success ? `✅ Done: ${r.signature?.slice(0, 10)}…` : `❌ ${r.error}`);
      if (r.success) {
        window.dispatchEvent(new CustomEvent("aof:refresh"));
        setTimeout(() => onChanged?.(), 2500);
      }
    } catch (e: any) {
      flashMsg(`❌ ${e?.response?.data?.error || e.message}`);
    } finally {
      setBusy(false);
    }
  }

  const durability = Number(tool.durability || 0);
  const durabilityPct = Math.max(0, Math.min(100, (durability / 20) * 100));
  const maxHours = Math.max(1, Math.min(20, durability));

  const state =
    durabilityPct > 75
      ? { icon: (resourceIcon("neuron") || ""), label: "Рост", color: "#6bbf59" }
      : durabilityPct > 40
      ? { icon: UI_ICONS.adminGear, label: "Норма", color: "#00D4FF" }
      : durabilityPct > 15
      ? { icon: (resourceIcon("silicon") || ""), label: "Износ", color: "#b0653a" }
      : { icon: UI_ICONS.noticeError, label: "Сломан", color: "#c2703d" };

  // Прогресс экстрактора: оставшееся время от общего срока текущей добычи
  const totalSec = Math.max(1, toNum(tool.lastMinedHours) * 3600 || hours * 3600);
  const remainSec = Math.max(0, miningEnd - Date.now() / 1000);
  const progress = tool.isMining ? Math.max(0, Math.min(1, 1 - remainSec / totalSec)) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className={`rounded-2xl bg-soil-850/80 border p-3 mb-3 ${tool.isMining && done ? "border-gold/60" : "border-straw/10"}`}
    >
      {/* Header with NFT image */}
      <div className="flex items-start gap-3">
        <ArtPlate src={icon} alt={tool.toolType || "Инструмент"} size={84} />
        <div className="flex-1 min-w-0 pt-1">
          <div className="text-parchment font-semibold text-sm yb-text-glow-violet">{tool.toolType || "Инструмент"}</div>
          <div className="text-xs font-medium mt-0.5" style={{ color: meta.color }}>{meta.label}</div>
          <div className="text-straw text-xs mt-1 font-mono opacity-60">{tool.mint?.slice(0, 4)}…{tool.mint?.slice(-4)}</div>
          <div className="mt-2 text-right">
            <div className="text-sm" style={{ color: state.color }}>{state.label}</div>
          </div>
        </div>
      </div>

      {/* Durability */}
      <div className="flex justify-between text-xs text-straw mt-3 mb-1">
        <span>Durability — {state.label}</span>
        <span>{durability} / 20</span>
      </div>
      <div className="h-2 rounded-full bg-soil-800 overflow-hidden">
        <motion.div className="h-full rounded-full" initial={{ width: 0 }}
          animate={{ width: `${durabilityPct}%` }} transition={{ duration: 0.6 }}
          style={{ background: state.color }} />
      </div>

      {/* Зона действий */}
      {!tool.staked && !tool.isMining && (
        <div className="mt-3">
          <button onClick={() => run("stake")} disabled={busy}
            className="w-full py-2.5 rounded-xl bg-wheat-600 text-white font-semibold text-sm disabled:opacity-40">
            На склад (стейк)
          </button>
          <p className="text-straw text-xs mt-1.5 text-center">Добыча работает только из серверной стойки</p>
        </div>
      )}

      {tool.staked && !tool.isMining && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-straw text-xs">Часы добычи (прочность −1 за час)</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setHours((h) => Math.max(1, h - 1))}
                className="w-8 h-8 rounded-lg bg-soil-700 border border-straw/20 text-parchment">−</button>
              <span className="text-parchment font-bold w-7 text-center">{hours}ч</span>
              <button onClick={() => setHours((h) => Math.min(maxHours, h + 1))}
                className="w-8 h-8 rounded-lg bg-soil-700 border border-straw/20 text-parchment">+</button>
            </div>
          </div>
          <button onClick={() => run("start")} disabled={!MINING_ENABLED || busy || durability < 1}
            className="w-full py-2.5 rounded-xl bg-soil-800 text-straw font-semibold text-sm disabled:opacity-60 cursor-not-allowed">
            {MINING_ENABLED ? "Начать добычу" : "⏸️ Добыча отключена до проверки on-chain"}
          </button>
          <button onClick={() => run("unstake")} disabled={busy || durability < 20}
            className="w-full py-2 rounded-xl bg-soil-700 border border-straw/20 text-straw text-xs disabled:opacity-40">
            ↩️ Вернуть в инвентарь {durability < 20 && "(нужна прочность 20)"}
          </button>
        </div>
      )}

      {tool.isMining && (
        <div className="mt-3">
          {done ? (
            <motion.button onClick={() => run("collect")} disabled={!MINING_ENABLED || busy}
              animate={MINING_ENABLED ? { scale: [1, 1.03, 1] } : undefined}
              transition={{ repeat: Infinity, duration: 1.4 }}
              className="w-full py-2.5 rounded-xl bg-soil-800 text-straw font-bold text-sm disabled:opacity-60 cursor-not-allowed">
              {MINING_ENABLED ? "Забрать добычу" : "⏸️ Сбор отключён до проверки on-chain"}
            </motion.button>
          ) : (
            <div>
              <div className="flex justify-between text-xs text-straw mb-1">
                <span className="inline-flex items-center gap-1"><ResourceGlyph icon={toolPlate("silicon_extractor") || ""} alt="" className="w-4 h-4" /> Экстрактор в забое…</span>
                <span>{label}</span>
              </div>
              <div className="relative h-3 rounded-full bg-soil-800 overflow-hidden">
                <div className="absolute inset-y-0 left-0 rounded-full bg-wheat-600/40"
                  style={{ width: `${progress * 100}%` }} />
                <span className="absolute text-xs" style={{ left: `calc(${progress * 100}% - 8px)`, top: -3 }}><ResourceGlyph icon={UI_ICONS.inbox} alt="" className="w-4 h-4" /></span>
              </div>
            </div>
          )}
        </div>
      )}

      {msg && <p className="text-xs text-parchment mt-2 text-center"><NoticeMsg text={msg} /></p>}
    </motion.div>
  );
}
