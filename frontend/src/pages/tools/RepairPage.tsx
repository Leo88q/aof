import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useLocale } from "../../i18n/LocaleProvider";
import { repairCopy } from "../../i18n/repairCopy";
import { homeResourceNames } from "../../i18n/homeDetail";
import { toolName, toolsCopy } from "../../i18n/toolsCopy";
import { api } from "../../lib/api";
import { handleTxResponse } from "../../lib/txFlow";
import { actionErrorFeedback } from "../../lib/txResponseFeedback";
import { walletRuntimeCopy } from "../../i18n/walletRuntimeCopy";
import { useWalletStore } from "../../store/walletStore";
import { Card } from "../../components/ui/Card";
import { RARITY_META, rarityKey } from "../../lib/toolMeta";
import { toolPlate, resourceIcon, UI_ICONS, TOOL_RARITIES } from "../../lib/visualAssets";
import { ResourceGlyph } from "../../components/visual/ResourceGlyph";
import { ArtPlate } from "../../components/visual/ArtPlate";
import { useFlash } from "../../lib/marketUtils";
import { NoticeMsg } from "../../components/visual/NoticeMsg";
import { FeatureDisabledNotice } from "../../components/ui/FeatureDisabledNotice";

const MAX_DURABILITY = 20;
const D9 = 1e9;
type Quote = { address: string; mint: string; amount: number; silicon: number; circuit: number };

function validDurability(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= MAX_DURABILITY ? n : null;
}

export function RepairPage() {
  const { language } = useLocale();
  const copy = repairCopy[language];
  const { address } = useWalletStore();
  const walletRef = useRef(address);
  walletRef.current = address;
  // null = no verified result (loading or read failure); [] = verified empty inventory.
  const [tools, setTools] = useState<any[] | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [toolsLoading, setToolsLoading] = useState(false);
  const toolsRequest = useRef(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [mints, setMints] = useState({ wood: "", stone: "" });
  const [amount, setAmount] = useState(1);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [receipt, setReceipt] = useState<{ address: string; silicon: number; circuit: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [txStatus, flash] = useFlash(language);
  // /tools/repair checks Config's woodMint/stoneMint; do not rely on an
  // unrelated material registry or let a failed Config read enable repair.
  const [repairState, setRepairState] = useState<"checking" | "ready" | "disabled" | "unknown">("checking");

  useEffect(() => {
    let active = true;
    const unset = (v: any) =>
      !v || typeof v !== "string" || v === "11111111111111111111111111111111" || /^1+$/.test(v);
    api.query.config()
      .then((c: any) => {
        if (!active) return;
        setMints({ wood: c?.woodMint || "", stone: c?.stoneMint || "" });
        setRepairState(unset(c?.woodMint) || unset(c?.stoneMint) ? "disabled" : "ready");
      })
      .catch(() => { if (active) setRepairState("unknown"); });
    return () => { active = false; };
  }, []);

  const loadTools = useCallback(async () => {
    const request = ++toolsRequest.current;
    if (!address) { setTools(null); setLoadedFor(null); setToolsLoading(false); return; }
    setToolsLoading(true);
    try {
      const r: any = await api.query.myTools(address);
      const a: any[] = Array.isArray(r) ? r : r?.tools;
      if (!Array.isArray(a)) throw new Error("Invalid tools response");
      if (request !== toolsRequest.current) return;
      setTools(a);
      setLoadedFor(address);
      setSelected(s => a.some(t => t.mint === s) ? s : (a[0]?.mint ?? null));
    } catch {
      if (request === toolsRequest.current) { setTools(null); setLoadedFor(null); }
    } finally {
      if (request === toolsRequest.current) setToolsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    loadTools();
    return () => { toolsRequest.current++; };
  }, [loadTools]);

  const knownTools = address && loadedFor === address && !toolsLoading ? tools : null;
  const tool = (knownTools ?? []).find((t) => t.mint === selected);
  const durability = tool ? validDurability(tool.durability) : null;
  const maxRepair = durability === null ? 0 : MAX_DURABILITY - durability;
  const amt = Math.min(amount, maxRepair);
  const critical = durability !== null && durability <= 5;

  // Quote belongs to a specific wallet, mint and repair amount. Stale answers
  // must not briefly show another tool's cost or unlock the transaction.
  useEffect(() => {
    let active = true;
    if (repairState !== "ready" || !address || !tool || amt <= 0) {
      setQuote(null);
      setQuoteLoading(false);
      return;
    }
    setQuote(null);
    setQuoteLoading(true);
    api.tools.repairQuote({ mint: tool.mint, amount: amt })
      .then((q: any) => {
        if (!active) return;
        const silicon = Number(q?.silicon);
        const circuit = Number(q?.circuit);
        // Backend returns base units and the quoted amount. Zero or missing
        // costs are not a free repair: the on-chain operation still burns both.
        setQuote(Number(q?.amount) === amt && Number.isSafeInteger(silicon) && silicon > 0 &&
          Number.isSafeInteger(circuit) && circuit > 0
          ? { address, mint: tool.mint, amount: amt, silicon, circuit } : null);
      })
      .catch(() => { if (active) setQuote(null); })
      .finally(() => { if (active) setQuoteLoading(false); });
    return () => { active = false; };
  }, [repairState, address, tool?.mint, amt]);
  const quoteForSelection = quote?.address === address && quote?.mint === tool?.mint && quote?.amount === amt ? quote : null;
  const format = (value: number) => value.toLocaleString(language, { maximumFractionDigits: 4 });
  const rarityLabel = (rarity: unknown) => {
    const rk = rarityKey(rarity);
    const i = TOOL_RARITIES.indexOf(rk as typeof TOOL_RARITIES[number]);
    return i >= 0 ? toolsCopy[language].collectionPage.rarities[i] : toolsCopy[language].card.unknownRarity;
  };

  async function doRepair() {
    if (busy) return;
    if (repairState !== "ready") return flash(`❌ ${copy.disabled}`);
    if (!address) return flash(`❌ ${copy.connect}`);
    if (!tool) return flash(`❌ ${copy.choose}`);
    if (!mints.stone || !mints.wood) return flash(`❌ ${copy.mintsMissing}`);
    if (amt <= 0) return flash(`❌ ${copy.full}`);
    if (!quoteForSelection) return flash(`❌ ${copy.quoteUnavailable}`);
    const confirmedQuote = quoteForSelection;
    setBusy(true);
    try {
      flash(copy.repairing);
      // POST /repair accepts user, mint and amount. The program reads both
      // resource mint addresses from Config and burns them atomically.
      const resp = await api.tools.repair({ user: address, mint: tool.mint, amount: amt });
      const r = await handleTxResponse(resp);
      if (walletRef.current !== address) return;
      if (r.success) {
        flash(`${copy.repaired} (+${amt})${r.signature ? `: ${r.signature.slice(0, 10)}…` : ''}`);
        setReceipt({ address, silicon: confirmedQuote.silicon, circuit: confirmedQuote.circuit });
        window.dispatchEvent(new CustomEvent("aof:refresh"));
        setTimeout(loadTools, 2500);
      } else {
        flash(r.error || copy.failed);
      }
    } catch (e: any) {
      if (walletRef.current === address) flash(actionErrorFeedback(e, language, walletRuntimeCopy[language].unconfirmedResponse));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div lang={language} className="p-4 pt-2 pb-24 space-y-4 min-w-0">
      <p className="text-straw text-xs">{copy.intro}</p>

      {txStatus && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="text-xs px-3 py-2 rounded-xl bg-soil-800 border border-straw/20 text-parchment">
          <NoticeMsg text={txStatus} />
        </motion.div>
      )}

      {receipt?.address === address && (
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
          className="text-xs px-3 py-2 rounded-xl bg-gold/10 border border-gold/40 text-gold font-semibold">
          {copy.debited}: {format(receipt.silicon / D9)} <ResourceGlyph icon={resourceIcon("SILICON")} alt="" className="inline-block w-3.5 h-3.5" /> + {format(receipt.circuit / D9)} <ResourceGlyph icon={resourceIcon("CIRCUIT")} alt="" className="inline-block w-3.5 h-3.5" />
        </motion.div>
      )}

      {repairState === "disabled" && <FeatureDisabledNotice id="tools_repair" />}
      {repairState === "unknown" && (
        <Card className="border border-gold-500/30 bg-soil-850">
          <p className="text-gold-400 text-xs">{copy.readinessUnknown}</p>
        </Card>
      )}

      {!address && (
        <Card className="text-center py-8">
          <div className="mb-2"><ResourceGlyph icon={UI_ICONS.inbox} alt="" className="w-12 h-12 inline-block" /></div>
          <p className="text-parchment text-sm">{copy.connect}</p>
        </Card>
      )}

      {address && knownTools === null && (
        <Card className="text-center py-8">
          <div className="mb-2"><ResourceGlyph icon={UI_ICONS.adminGear} alt="" className="w-12 h-12 inline-block" /></div>
          <p className="text-parchment text-sm">{toolsLoading || loadedFor !== address && tools !== null ? copy.loadingTools : copy.toolsUnavailable}</p>
        </Card>
      )}

      {address && knownTools !== null && knownTools.length === 0 && (
        <Card className="text-center py-8">
          <div className="mb-2"><ResourceGlyph icon={UI_ICONS.adminGear} alt="" className="w-12 h-12 inline-block" /></div>
          <p className="text-parchment text-sm">{copy.noTools}</p>
        </Card>
      )}

      {knownTools !== null && knownTools.length > 0 && (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {knownTools.map((t) => {
              const rk = rarityKey(t.rarity);
              return (
                <button key={t.mint} type="button" onClick={() => { setSelected(t.mint); setReceipt(null); }}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs ${selected === t.mint ? "border-wheat-500 bg-wheat-500/10 text-parchment" : "border-straw/15 bg-soil-800/60 text-straw"}`}>
                  <ArtPlate src={toolPlate(t.toolType, rk)} alt="" size={28} />
                  <span style={{ color: RARITY_META[rk]?.color }}>{toolName(language, t.toolType)} · {rarityLabel(t.rarity)}</span>
                  <span>· {validDurability(t.durability) ?? '—'}/{MAX_DURABILITY}</span>
                </button>
              );
            })}
          </div>

          {tool && (
            <Card>
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  <ArtPlate src={toolPlate(tool.toolType, rarityKey(tool.rarity))} alt="" size={72} />
                  {critical && <span className="absolute -top-1 -right-2 text-lg"><ResourceGlyph icon={UI_ICONS.noticeError} alt="" className="w-5 h-5" /></span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-parchment font-semibold break-words" style={{ color: RARITY_META[rarityKey(tool.rarity)]?.color }}>
                    {rarityLabel(tool.rarity)} · {toolName(language, tool.toolType)}
                  </p>
                  <p className="text-straw text-xs">
                    {durability === null ? copy.durabilityUnknown : `${copy.durability} ${durability} / ${MAX_DURABILITY}`}
                    {critical && <span className="text-wheat-500 font-semibold">{copy.critical}</span>}
                  </p>
                </div>
              </div>

              <div className="mt-4 h-3 rounded-full bg-soil-800 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ width: `${durability === null ? 0 : (durability / MAX_DURABILITY) * 100}%`, background: critical ? "#E2685F" : durability !== null && durability <= 10 ? "#E0708A" : "#5FD3A8" }}
                  animate={{ opacity: critical ? [1, 0.45, 1] : [1, 0.8, 1] }}
                  transition={{ repeat: Infinity, duration: critical ? 0.6 : 1.6 }}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 mt-4">
                <span className="text-straw text-xs">{copy.restore.replace('{max}', String(maxRepair))}</span>
                <div className="flex items-center gap-3">
                  <button type="button" aria-label={copy.decrease} onClick={() => setAmount((a) => Math.max(1, a - 1))} disabled={maxRepair === 0 || busy}
                    className="w-9 h-9 rounded-xl bg-soil-700 border border-straw/20 text-parchment text-lg disabled:opacity-40">−</button>
                  <span className="text-parchment font-bold w-8 text-center">{amt}</span>
                  <button type="button" aria-label={copy.increase} onClick={() => setAmount((a) => Math.min(Math.max(1, maxRepair), a + 1))} disabled={maxRepair === 0 || busy}
                    className="w-9 h-9 rounded-xl bg-soil-700 border border-straw/20 text-parchment text-lg disabled:opacity-40">+</button>
                </div>
              </div>

              <div className="mt-4 rounded-xl bg-soil-800/70 border border-straw/15 p-3">
                <p className="text-straw text-[10px] uppercase tracking-wide mb-2">{copy.cost}</p>
                {quoteForSelection ? (
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div>
                      <p className="text-parchment font-bold text-sm tabular-nums">{format(quoteForSelection.silicon / D9)}</p>
                      <p className="text-straw text-[10px] inline-flex items-center gap-1"><ResourceGlyph icon={resourceIcon("SILICON") || ""} alt="" className="w-3.5 h-3.5" /> {homeResourceNames[language].silicon}</p>
                    </div>
                    <div>
                      <p className="text-parchment font-bold text-sm tabular-nums">{format(quoteForSelection.circuit / D9)}</p>
                      <p className="text-straw text-[10px] inline-flex items-center gap-1"><ResourceGlyph icon={resourceIcon("CIRCUIT") || ""} alt="" className="w-3.5 h-3.5" /> {homeResourceNames[language].circuit}</p>
                    </div>
                  </div>
                ) : <p role="status" className="text-straw text-xs text-center">{durability === null ? copy.durabilityUnknown : maxRepair === 0 ? copy.full : repairState === "checking" ? copy.checking : repairState !== "ready" ? copy.disabled : quoteLoading ? copy.quoteLoading : copy.quoteUnavailable}</p>}
              </div>

              <button type="button" onClick={doRepair} disabled={repairState !== "ready" || !mints.stone || maxRepair === 0 || durability === null || !quoteForSelection || busy}
                className="w-full mt-4 py-2.5 rounded-xl bg-wheat-600 text-white font-semibold text-sm disabled:opacity-40">
                {repairState === "ready"
                  ? copy.repair.replace('{amount}', String(amt))
                  : repairState === "checking" ? copy.checking : copy.disabled}
              </button>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
