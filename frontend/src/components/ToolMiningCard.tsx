import { useState } from "react";
import { useLocale } from "../i18n/LocaleProvider";
import { toolsCopy, toolName } from "../i18n/toolsCopy";
import { motion } from "framer-motion";
import { RARITY_META, rarityKey } from "../lib/toolMeta";
import { toolPlate, UI_ICONS, resourceIcon, TOOL_RARITIES } from "../lib/visualAssets";
import { ResourceGlyph } from "./visual/ResourceGlyph";
import { ArtPlate } from "./visual/ArtPlate";
import { NoticeMsg } from "./visual/NoticeMsg";
import { useCountdown } from "../lib/useCountdown";
import { api } from "../lib/api";
import { handleTxResponse } from "../lib/txFlow";
import { actionErrorFeedback } from "../lib/txResponseFeedback";
import { walletRuntimeCopy } from "../i18n/walletRuntimeCopy";
import { useWalletStore } from "../store/walletStore";
import { toNum } from "../lib/marketUtils";
import { readMiningEnabled, useMiningAvailability } from "../lib/useMiningAvailability";

interface ToolMiningCardProps {
  tool: any;
  onChanged?: () => void;
}

/**
 * Живая карточка инструмента (ТЗ v3 §2.4–2.5):
 * стейк = «уехать на склад», майнинг = экстрактор, сбор = контейнер.
 * Реальные вызовы /tools/stake|start-mining|collect-mining|unstake + подпись кошелька.
 */
export function ToolMiningCard({ tool, onChanged }: ToolMiningCardProps) {
  const MINING_ENABLED = useMiningAvailability();
  const { language } = useLocale();
  const copy = toolsCopy[language].card;
  const name = toolName(language, tool.toolType);
  const { address } = useWalletStore();
  const rk = rarityKey(tool.rarity);
  const meta = RARITY_META[rk] || RARITY_META.common;
  const rarityIndex = TOOL_RARITIES.findIndex((rarity) => rarity === rk);
  const rarityLabel = rarityIndex < 0 ? copy.unknownRarity : toolsCopy[language].collectionPage.rarities[rarityIndex];
  const icon = toolPlate(tool.toolType, rk) || UI_ICONS.adminGear;

  const [hours, setHours] = useState(4);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ language: typeof language; text: string } | null>(null);

  const miningEnd = tool.isMining ? toNum(tool.miningEnd) : 0;
  const hasMiningEnd = Number.isFinite(miningEnd) && miningEnd > 0;
  const { label, done } = useCountdown(hasMiningEnd ? miningEnd : null);
  const canCollect = tool.isMining && hasMiningEnd && done;

  const flashMsg = (m: string) => {
    setMsg({ language, text: m });
    setTimeout(() => setMsg(null), 6000);
  };

  async function run(kind: "stake" | "start" | "collect" | "unstake") {
    if ((kind === "start" || kind === "collect") && (!MINING_ENABLED || !await readMiningEnabled())) {
      return flashMsg(`⏸️ ${copy.disabledMining}`);
    }
    if (!address) return flashMsg(`❌ ${copy.connectWallet}`);
    setBusy(true);
    try {
      let resp: any;
      if (kind === "stake") {
        flashMsg(copy.staking);
        resp = await api.tools.stake({ user: address, mint: tool.mint, lockSeconds: String(86400) });
      } else if (kind === "unstake") {
        flashMsg(copy.unstaking);
        resp = await api.tools.unstake({ user: address, mint: tool.mint });
      } else if (kind === "start") {
        flashMsg(copy.starting);
        resp = await api.tools.startMining({ user: address, mint: tool.mint, hours: selectedHours });
      } else {
        flashMsg(copy.opening);
        resp = await api.tools.collectMining({ user: address, mint: tool.mint });
      }
      const r = await handleTxResponse(resp);
      flashMsg(r.success ? (r.signature ? `${copy.done}: ${r.signature.slice(0, 10)}…` : copy.done) : (r.error || copy.failed));
      if (r.success) {
        window.dispatchEvent(new CustomEvent("aof:refresh"));
        setTimeout(() => onChanged?.(), 2500);
      }
    } catch (e: any) {
      flashMsg(actionErrorFeedback(e, language, walletRuntimeCopy[language].unconfirmedResponse));
    } finally {
      setBusy(false);
    }
  }

  const rawDurability = tool.durability;
  const durability = rawDurability === null || rawDurability === undefined || !Number.isFinite(Number(rawDurability))
    ? null : Number(rawDurability);
  const durabilityPct = durability === null ? null : Math.max(0, Math.min(100, (durability / 20) * 100));
  const maxHours = Math.max(1, Math.min(20, durability ?? 1));
  const selectedHours = Math.max(1, Math.min(hours, maxHours));

  const state = durabilityPct === null
    ? { icon: UI_ICONS.adminGear, label: copy.unknown, color: "#9AA7B4" }
    : durabilityPct > 75
      ? { icon: (resourceIcon("neuron") || ""), label: copy.healthy, color: "#5FD3A8" }
      : durabilityPct > 40
      ? { icon: UI_ICONS.adminGear, label: copy.normal, color: "#5FC9DA" }
      : durabilityPct > 15
      ? { icon: (resourceIcon("silicon") || ""), label: copy.worn, color: "#E2685F" }
      : { icon: UI_ICONS.noticeError, label: copy.broken, color: "#E2685F" };

  // Прогресс экстрактора: оставшееся время от общего срока текущей добычи
  const totalSec = Math.max(1, toNum(tool.lastMinedHours) * 3600 || hours * 3600);
  const remainSec = Math.max(0, miningEnd - Date.now() / 1000);
  const progress = tool.isMining && hasMiningEnd ? Math.max(0, Math.min(1, 1 - remainSec / totalSec)) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      lang={language}
      className={`rounded-2xl bg-soil-850/80 border p-3 mb-3 ${canCollect ? "border-gold/60" : "border-straw/10"}`}
    >
      {/* Header with NFT image */}
      <div className="flex items-start gap-3">
        <ArtPlate src={icon} alt="" size={84} />
        <div className="flex-1 min-w-0 pt-1">
          <div className="text-parchment font-semibold text-sm">{name}</div>
          <div className="text-xs font-medium mt-0.5" style={{ color: meta.color }}>{rarityLabel}</div>
          <div className="text-straw text-xs mt-1 font-mono opacity-60">{tool.mint?.slice(0, 4)}…{tool.mint?.slice(-4)}</div>
          <div className="mt-2 text-right">
            <div className="text-sm" style={{ color: state.color }}>{state.label}</div>
          </div>
        </div>
      </div>

      {!MINING_ENABLED && (
        <p role="status" className="text-xs text-straw mt-2 break-words">{copy.disabledMining}</p>
      )}

      {/* Durability */}
      <div className="flex flex-wrap justify-between gap-1 text-xs text-straw mt-3 mb-1">
        <span>{copy.durability} — {state.label}</span>
        <span>{durability ?? '—'} / 20</span>
      </div>
      <div className="h-2 rounded-full bg-soil-800 overflow-hidden">
        <motion.div className="h-full rounded-full" initial={{ width: 0 }}
          animate={{ width: `${durabilityPct ?? 0}%` }} transition={{ duration: 0.6 }}
          style={{ background: state.color }} />
      </div>

      {/* Зона действий */}
      {!tool.staked && !tool.isMining && (
        <div className="mt-3">
          <button onClick={() => run("stake")} disabled={busy}
            className="w-full py-2.5 rounded-xl bg-wheat-600 text-white font-semibold text-sm disabled:opacity-40">
            {copy.stake}
          </button>
          <p className="text-straw text-xs mt-1.5 text-center">{copy.stakeHint}</p>
        </div>
      )}

      {tool.staked && !tool.isMining && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-straw text-xs">{copy.miningHours}</span>
            <div className="flex items-center gap-2">
              <button type="button" aria-label={copy.decrease} onClick={() => setHours((h) => Math.max(1, h - 1))}
                className="w-8 h-8 rounded-lg bg-soil-700 border border-straw/20 text-parchment">−</button>
              <span className="text-parchment font-bold min-w-12 text-center whitespace-nowrap">{selectedHours}{copy.hourAbbrev}</span>
              <button type="button" aria-label={copy.increase} onClick={() => setHours((h) => Math.min(maxHours, h + 1))}
                className="w-8 h-8 rounded-lg bg-soil-700 border border-straw/20 text-parchment">+</button>
            </div>
          </div>
          <button onClick={() => run("start")} disabled={!MINING_ENABLED || busy || durability === null || durability < 1}
            className="w-full py-2.5 rounded-xl bg-soil-800 text-straw font-semibold text-sm disabled:opacity-60 cursor-not-allowed">
            {MINING_ENABLED ? copy.start : copy.startDisabled}
          </button>
          <button onClick={() => run("unstake")} disabled={busy || durability === null || durability < 20}
            className="w-full py-2 rounded-xl bg-soil-700 border border-straw/20 text-straw text-xs disabled:opacity-40">
            {copy.unstake} {(durability === null || durability < 20) && `(${copy.needsFullDurability})`}
          </button>
        </div>
      )}

      {tool.isMining && (
        <div className="mt-3">
          {canCollect ? (
            <motion.button onClick={() => run("collect")} disabled={!MINING_ENABLED || busy}
              animate={MINING_ENABLED ? { scale: [1, 1.03, 1] } : undefined}
              transition={{ repeat: Infinity, duration: 1.4 }}
              className="w-full py-2.5 rounded-xl bg-soil-800 text-straw font-bold text-sm disabled:opacity-60 cursor-not-allowed">
              {MINING_ENABLED ? copy.collect : copy.collectDisabled}
            </motion.button>
          ) : (
            <div>
              <div className="flex flex-wrap justify-between gap-1 text-xs text-straw mb-1">
                <span className="inline-flex items-center gap-1"><ResourceGlyph icon={toolPlate("silicon_extractor") || ""} alt="" className="w-4 h-4" /> {copy.extracting}</span>
                <span>{hasMiningEnd ? label : copy.timerUnknown}</span>
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

      {msg?.language === language && <p className="text-xs text-parchment mt-2 text-center"><NoticeMsg text={msg.text} /></p>}
    </motion.div>
  );
}
