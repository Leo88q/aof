import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useLocale } from "../../i18n/LocaleProvider";
import { useNav } from "../../nav/NavContext";
import { NavHeader } from "../../components/NavHeader";
import { PacksPage } from "./PacksPage";
import { craftCopy } from "../../i18n/craftCopy";
import { homeResourceNames } from "../../i18n/homeDetail";
import { toolName, toolsCopy } from "../../i18n/toolsCopy";
import { api } from "../../lib/api";
import { handleTxResponse } from "../../lib/txFlow";
import { actionErrorFeedback } from "../../lib/txResponseFeedback";
import { walletRuntimeCopy } from "../../i18n/walletRuntimeCopy";
import { useWalletStore } from "../../store/walletStore";
import { Card } from "../../components/ui/Card";
import { RARITY_META, rarityKey } from "../../lib/toolMeta";
import { CRAFT_RESOURCES, readCraftBalances, readCraftMints, readCraftQuote, type CraftAmounts, type CraftMints } from "../../lib/craftReadings";
import { formatAmount, formatResourceShortage } from "../../lib/resourceShortageMessage";
import { resourceIcon, UI_ICONS, toolPlate, TOOL_RARITIES } from "../../lib/visualAssets";
import { ResourceGlyph } from "../../components/visual/ResourceGlyph";
import { ArtPlate } from "../../components/visual/ArtPlate";
import { shortAddr, useFlash } from "../../lib/marketUtils";
import { NoticeMsg } from "../../components/visual/NoticeMsg";

export function CraftPage() {
  const { language } = useLocale();
  const copy = craftCopy[language];
  const { push } = useNav();
  const { address } = useWalletStore();
  const walletRef = useRef(address);
  walletRef.current = address;
  const running = useRef(false);
  // Null means no confirmed read; [] means the inventory is genuinely empty.
  const [tools, setTools] = useState<any[] | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [toolsLoading, setToolsLoading] = useState(false);
  const toolsRequest = useRef(0);
  const [selMint, setSelMint] = useState("");
  const [newMint, setNewMint] = useState("");
  const [mintFor, setMintFor] = useState<string | null>(null);
  const [resMints, setResMints] = useState<CraftMints | null>(null);
  const [mintsStatus, setMintsStatus] = useState<"loading" | "ready" | "error">("loading");
  const [balances, setBalances] = useState<CraftAmounts | null>(null);
  const [balanceFor, setBalanceFor] = useState<string | null>(null);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const balanceRequest = useRef(0);
  const [craftQuote, setCraftQuote] = useState<{ rarity: string; costs: CraftAmounts } | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [craftReceipt, setCraftReceipt] = useState<{ address: string; costs: CraftAmounts } | null>(null);
  const [busyPrep, setBusyPrep] = useState(false);
  const [busyCraft, setBusyCraft] = useState(false);
  const [txStatus, flash] = useFlash(language);

  const loadTools = useCallback(async () => {
    const request = ++toolsRequest.current;
    if (!address) { setTools(null); setLoadedFor(null); setToolsLoading(false); return; }
    setToolsLoading(true);
    try {
      const r: any = await api.query.myTools(address);
      const items: any[] = Array.isArray(r) ? r : r?.tools;
      if (!Array.isArray(items)) throw new Error("Invalid tools response");
      if (request !== toolsRequest.current) return;
      const available = items.filter((t) => !t.staked && !t.isMining);
      setTools(available);
      setLoadedFor(address);
      setSelMint(s => available.some(t => t.mint === s) ? s : "");
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

  // /query/material-mints validates Config, MaterialMints and every SPL mint
  // against the chain before returning HTTP 200. Use its canonical uppercase
  // names; the old local CIRCUIT/SILICON/DATA map was always empty on this API.
  useEffect(() => {
    let active = true;
    api.query.materialMints()
      .then((r: unknown) => {
        if (!active) return;
        const parsed = readCraftMints(r);
        setResMints(parsed);
        setMintsStatus(parsed ? "ready" : "error");
      })
      .catch(() => { if (active) { setResMints(null); setMintsStatus("error"); } });
    return () => { active = false; };
  }, []);

  const loadBalances = useCallback(async () => {
    const request = ++balanceRequest.current;
    if (!address || !resMints) { setBalances(null); setBalanceFor(null); setBalancesLoading(false); return; }
    setBalancesLoading(true);
    setBalances(null);
    try {
      const raw: unknown = await api.query.balances(address);
      const values = readCraftBalances(raw);
      if (walletRef.current !== address || request !== balanceRequest.current) return;
      setBalances(values);
      setBalanceFor(address);
    } catch {
      if (walletRef.current === address && request === balanceRequest.current) { setBalances(null); setBalanceFor(address); }
    } finally {
      if (walletRef.current === address && request === balanceRequest.current) setBalancesLoading(false);
    }
  }, [address, resMints]);
  useEffect(() => {
    loadBalances();
    return () => { balanceRequest.current++; };
  }, [loadBalances]);

  const knownTools = address && loadedFor === address && !toolsLoading ? tools : null;
  const src = (knownTools ?? []).find((t) => t.mint === selMint);
  const srcRk = src ? rarityKey(src.rarity) : "";
  const srcIdx = TOOL_RARITIES.findIndex((rarity) => rarity === srcRk);
  const targetRk = srcIdx >= 0 && srcIdx < TOOL_RARITIES.length - 1 ? TOOL_RARITIES[srcIdx + 1] : null;
  const rarityLabel = (rk: string) => {
    const i = TOOL_RARITIES.findIndex((rarity) => rarity === rk);
    return i < 0 ? toolsCopy[language].card.unknownRarity : toolsCopy[language].collectionPage.rarities[i];
  };
  const activeBalances = address && balanceFor === address && !balancesLoading ? balances : null;
  const preparedMint = address && mintFor === address ? newMint : "";

  // The quote response contains {circuit,silicon,data,neuron,power,mind},
  // historical resource field aliases are never used for quote inputs.
  useEffect(() => {
    let active = true;
    if (!targetRk) { setCraftQuote(null); setQuoteLoading(false); return; }
    setCraftQuote(null);
    setQuoteLoading(true);
    api.tools.craftQuote({ rarity: targetRk })
      .then((raw: unknown) => {
        if (!active) return;
        const costs = readCraftQuote(raw);
        setCraftQuote(costs ? { rarity: targetRk, costs } : null);
      })
      .catch(() => { if (active) setCraftQuote(null); })
      .finally(() => { if (active) setQuoteLoading(false); });
    return () => { active = false; };
  }, [targetRk]);
  const quoteForTarget = craftQuote?.rarity === targetRk && !quoteLoading ? craftQuote.costs : null;
  const sufficient = !!quoteForTarget && !!activeBalances && CRAFT_RESOURCES.every(({ key }) => activeBalances[key] >= quoteForTarget[key]);
  const canPrepare = !!address && !!src && !!targetRk && !!resMints && sufficient && !busyPrep && !busyCraft;
  const format = (n: number) => n.toLocaleString(language, { maximumFractionDigits: 9 });
  const resourceName = (key: keyof CraftAmounts) => homeResourceNames[language][key];

  async function prepMint() {
    if (running.current || !canPrepare || !address) return;
    running.current = true;
    setBusyPrep(true);
    flash(copy.preparing, 8000);
    try {
      const resp: any = await api.tools.prepMint({ owner: address });
      const r = await handleTxResponse(resp);
      if (walletRef.current !== address) return;
      if (r.success && typeof resp.mint === "string" && resp.mint) {
        setNewMint(resp.mint);
        setMintFor(address);
        flash(`${copy.mintPrepared}: ${shortAddr(resp.mint)}`);
      } else {
        flash(r.error || copy.mintMissing);
      }
    } catch (e: any) {
      if (walletRef.current === address) flash(actionErrorFeedback(e, language, walletRuntimeCopy[language].unconfirmedResponse));
    } finally {
      running.current = false;
      setBusyPrep(false);
    }
  }

  async function doCraft() {
    if (running.current || !address || !src || !targetRk || !preparedMint || !resMints || !quoteForTarget || !activeBalances || !sufficient) return;
    running.current = true;
    setBusyCraft(true);
    const costs = quoteForTarget;
    try {
      // Costs follow the global minted count. Re-check the canonical quote
      // and this wallet's balances immediately before asking for a signature.
      const [freshQuoteRaw, freshBalancesRaw] = await Promise.all([
        api.tools.craftQuote({ rarity: targetRk }), api.query.balances(address),
      ]);
      if (walletRef.current !== address) return;
      const latest = readCraftQuote(freshQuoteRaw);
      const latestBalances = readCraftBalances(freshBalancesRaw);
      if (!latest) { setCraftQuote(null); flash(copy.quoteUnavailable); return; }
      if (!latestBalances) { setBalances(null); setBalanceFor(address); flash(copy.balancesUnavailable); return; }
      if (CRAFT_RESOURCES.some(({ key }) => latest[key] !== costs[key])) {
        setCraftQuote({ rarity: targetRk, costs: latest });
        setBalances(latestBalances);
        setBalanceFor(address);
        flash(copy.quoteChanged);
        return;
      }
      if (CRAFT_RESOURCES.some(({ key }) => latestBalances[key] < latest[key])) {
        setBalances(latestBalances);
        setBalanceFor(address);
        flash(formatResourceShortage(language, CRAFT_RESOURCES.filter(({ key }) => latestBalances[key] < latest[key]).map(({ key, chain }) => ({
          resource: chain, have: formatAmount(latestBalances[key]) ?? '', need: formatAmount(latest[key]) ?? '',
        }))));
        return;
      }
      flash(copy.forging);
      const resp = await api.tools.craft({
        user: address,
        prevMint: src.mint,
        newMint: preparedMint,
        toolType: src.toolType,
        rarity: targetRk,
        circuitMint: resMints.circuit,
        siliconMint: resMints.silicon,
        dataMint: resMints.data,
        neuronMint: resMints.neuron,
        powerMint: resMints.power,
        mindMint: resMints.mind,
        // SKR is not configured; the backend binds the compatibility slot to DATA.
      });
      const r = await handleTxResponse(resp);
      if (walletRef.current !== address) return;
      if (r.success) {
        flash(`${copy.forged} · ${rarityLabel(targetRk)}${r.signature ? `: ${r.signature.slice(0, 10)}…` : ''}`);
        setCraftReceipt({ address, costs });
        window.dispatchEvent(new CustomEvent("aof:refresh"));
        setNewMint("");
        setSelMint("");
        loadBalances();
        setTimeout(loadTools, 2500);
      } else {
        flash(r.error || copy.failed);
      }
    } catch (e: any) {
      if (walletRef.current === address) flash(actionErrorFeedback(e, language, walletRuntimeCopy[language].unconfirmedResponse));
    } finally {
      running.current = false;
      setBusyCraft(false);
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

      <Card>
        <h3 className="text-parchment font-semibold mb-3">{copy.select}</h3>
        {!address || knownTools === null || knownTools.length === 0 ? (
          <div className="grid gap-2">
            <p role="status" className="text-straw text-xs text-center py-4">
              {!address ? copy.connect : knownTools === null
                ? toolsLoading || loadedFor !== address && tools !== null ? copy.toolsLoading : copy.toolsUnavailable
                : copy.noTools}
            </p>
            {address && knownTools !== null && knownTools.length === 0 && (
              <button type="button" className="btn btn-primary" onClick={() => push("tools", "packs", (<><NavHeader headerId="capsules" tabKey="tools" /><PacksPage /></>))}>{copy.openCapsules}</button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {knownTools.map((t) => {
              const rk = rarityKey(t.rarity);
              const i = TOOL_RARITIES.findIndex((rarity) => rarity === rk);
              const isMax = i < 0 || i === TOOL_RARITIES.length - 1;
              const isSelected = t.mint === selMint;
              return (
                <button key={t.mint} type="button" onClick={() => { setSelMint(t.mint); setCraftReceipt(null); }}
                  disabled={isMax || busyPrep || busyCraft}
                  className={`p-3 rounded-xl border-2 text-left min-w-0 transition-all ${isSelected ? "border-gold bg-gold/10" : "border-straw/10 bg-soil-800/60"} ${isMax ? "opacity-50 cursor-not-allowed" : "active:scale-95"}`}>
                  <div className="flex items-center gap-2 mb-1 min-w-0">
                    <ArtPlate src={toolPlate(t.toolType, rk)} alt="" size={40} />
                    <div className="flex-1 min-w-0 break-words">
                      <p className="text-parchment text-xs font-medium">{toolName(language, t.toolType)}</p>
                      <p className="text-[10px]" style={{ color: RARITY_META[rk]?.color }}>{rarityLabel(rk)}</p>
                    </div>
                  </div>
                  {isMax && <p className="text-[10px] text-straw">{i < 0 ? copy.unknownRarity : copy.maxRarity}</p>}
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {src && targetRk && (
        <Card>
          <h3 className="text-parchment font-semibold mb-3 break-words">
            {copy.prepareFor.replace('{rarity}', rarityLabel(targetRk))}
          </h3>
          {preparedMint ? (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-sprout-500/10 border border-sprout-500/30 min-w-0">
              <img src={UI_ICONS.noticeSuccess} alt="" className="w-6 h-6 object-contain shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-parchment text-xs font-medium">{copy.mintReady}</p>
                <p className="text-straw text-[10px]">{shortAddr(preparedMint)}</p>
              </div>
              <button type="button" onClick={() => setNewMint("")} disabled={busyCraft} aria-label={copy.clearMint} title={copy.clearMint}
                className="text-xs text-straw hover:text-parchment disabled:opacity-40">↺</button>
            </div>
          ) : (
            <button type="button" onClick={prepMint} disabled={!canPrepare}
              className="w-full py-3 rounded-2xl bg-accent-600 text-soil-950 font-semibold active:scale-95 transition-transform disabled:opacity-50">
              {busyPrep ? copy.preparing : copy.prepare}
            </button>
          )}
          {!resMints && <p role="status" className="text-straw text-xs mt-2">{mintsStatus === "loading" ? copy.mintsLoading : copy.mintsUnavailable}</p>}
          {resMints && !activeBalances && <p role="status" className="text-straw text-xs mt-2">{balancesLoading || balanceFor !== address ? copy.balancesLoading : copy.balancesUnavailable}</p>}
          {!quoteForTarget && <p role="status" className="text-straw text-xs mt-2">{quoteLoading ? copy.quoteLoading : copy.quoteUnavailable}</p>}
          {quoteForTarget && activeBalances && !sufficient && <p className="text-straw text-xs mt-2 [overflow-wrap:anywhere]">{formatResourceShortage(language, CRAFT_RESOURCES.filter(({ key }) => activeBalances[key] < quoteForTarget[key]).map(({ key, chain }) => ({
            resource: chain, have: formatAmount(activeBalances[key]) ?? '', need: formatAmount(quoteForTarget[key]) ?? '',
          })))}</p>}
        </Card>
      )}

      {src && targetRk && preparedMint && (
        <Card>
          <h3 className="text-parchment font-semibold mb-3">{copy.price}</h3>
          {quoteForTarget ? (
            <div className="space-y-2">
              {CRAFT_RESOURCES.map(({ key }) => {
                const needed = quoteForTarget[key];
                const have = activeBalances?.[key] ?? null;
                const pct = have === null ? 0 : needed > 0 ? Math.min(100, (have / needed) * 100) : 100;
                return (
                  <div key={key} className="p-3 rounded-xl bg-soil-800/60 border border-straw/10">
                    <div className="flex flex-wrap justify-between items-center gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <ResourceGlyph icon={resourceIcon(key.toUpperCase()) || ""} alt="" className="w-5 h-5 shrink-0" />
                        <span className="text-xs font-medium text-parchment break-words">{resourceName(key)}</span>
                      </div>
                      <div className="text-right text-xs text-parchment tabular-nums">{copy.required}: {format(needed)} / {copy.available}: {have === null ? '—' : format(have)}</div>
                    </div>
                    <div className="h-1.5 bg-soil-700 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.5 }}
                        className={`h-full rounded-full ${have === null || have < needed ? "bg-ember-500" : "bg-sprout-500"}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <p role="status" className="text-straw text-xs">{quoteLoading ? copy.quoteLoading : copy.quoteUnavailable}</p>}

          <div className="p-3 rounded-xl bg-soil-800/60 border border-straw/10 mt-3">
            <p className="text-straw text-[10px]">{copy.skrNote}</p>
          </div>
          <button type="button" onClick={doCraft} disabled={!preparedMint || !resMints || !quoteForTarget || !activeBalances || !sufficient || busyCraft || busyPrep}
            className="w-full mt-4 py-3 rounded-2xl bg-gradient-to-r from-gold to-accent-600 text-soil-950 font-bold active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed">
            {copy.forge.replace('{rarity}', rarityLabel(targetRk))}
          </button>
        </Card>
      )}

      {craftReceipt?.address === address && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="p-3 rounded-xl bg-sprout-500/10 border border-sprout-500/30 text-xs text-parchment">
          <p className="font-semibold mb-1 inline-flex items-center gap-1.5"><img src={UI_ICONS.noticeSuccess} alt="" className="w-4 h-4 object-contain" /> {copy.lastQuote}</p>
          <p className="text-straw">{CRAFT_RESOURCES.map(({ key }) => `${resourceName(key)} ${format(craftReceipt.costs[key])}`).join(' · ')}</p>
        </motion.div>
      )}
    </div>
  );
}
