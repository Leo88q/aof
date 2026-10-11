import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../../lib/api";
import { handleTxResponse } from "../../lib/txFlow";
import { actionErrorFeedback } from "../../lib/txResponseFeedback";
import { walletRuntimeCopy } from "../../i18n/walletRuntimeCopy";
import { useWalletStore } from "../../store/walletStore";
import { useLocale } from "../../i18n/LocaleProvider";
import { rentalCopy } from "../../i18n/rentalCopy";
import { toolName, toolsCopy } from "../../i18n/toolsCopy";
import { Card } from "../../components/ui/Card";
import { ArtPlate } from "../../components/visual/ArtPlate";
import { toolPlate, TOOL_RARITIES, UI_ICONS, type ToolRarity } from "../../lib/visualAssets";
import { ResourceGlyph } from "../../components/visual/ResourceGlyph";
import {
  RARITY_COLOR, rarityKey,
  fmtSol, shortAddr, toNum, useFlash,
} from "../../lib/marketUtils";
import { NoticeMsg } from "../../components/visual/NoticeMsg";
import { MarketFeeNote } from "../../components/MarketFeeNote";

export function RentalPage() {
  const { language } = useLocale();
  const copy = rentalCopy[language];
  const rarityLabel = (rarity: string) => {
    const index = TOOL_RARITIES.indexOf(rarity as ToolRarity);
    return index < 0 ? toolsCopy[language].card.unknownRarity : toolsCopy[language].collectionPage.rarities[index];
  };
  const { address } = useWalletStore();
  const [rentals, setRentals] = useState<any[]>([]);
  const [myTools, setMyTools] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [txStatus, flash] = useFlash(language);
  const [statusLanguage, setStatusLanguage] = useState(language);
  const notify = (message: string) => { setStatusLanguage(language); flash(message); };
  const [hours, setHours] = useState<Record<string, string>>({});
  const [formOpen, setFormOpen] = useState(false);
  const [selMint, setSelMint] = useState("");
  const [splitPct, setSplitPct] = useState("30");
  const [minH, setMinH] = useState("24");
  const [maxH, setMaxH] = useState("720");
  const [pricePerHour, setPricePerHour] = useState("0.001");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const ls: any = await api.query.rentals();
      const arr: any[] = Array.isArray(ls) ? ls : [];
      const withMeta = await Promise.all(
        arr.map(async (l) => ({ ...l, tool: await api.query.tool(l.mint).catch(() => null) }))
      );
      setRentals(withMeta);
    } catch (e) {
      console.error("rentals:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!address) return;
    api.query.myTools(address)
      .then((r: any) => {
        const a: any[] = Array.isArray(r) ? r : r?.tools || [];
        setMyTools(a.filter((t) => !t.staked && !t.isMining));
      })
      .catch(() => {});
  }, [address]);

  async function rent(l: any) {
    if (!address) return notify(copy.connect);
    const minS = toNum(l.minDuration);
    const maxS = toNum(l.maxDuration);
    let durS = Math.round(parseFloat(hours[l.mint] || "0") * 3600);
    if (!isFinite(durS) || durS <= 0) return notify(copy.durationRequired);
    if (durS < minS) durS = minS;
    if (maxS > 0 && durS > maxS) durS = maxS;
    try {
      notify(copy.preparingRent);
      const resp = await api.rental.start({ renter: address, mint: l.mint, durationSeconds: String(durS) });
      const r = await handleTxResponse(resp);
      notify(r.success ? `${copy.rented}: ${r.signature?.slice(0, 10)}…` : (r.error || walletRuntimeCopy[language].unconfirmedResponse));
      if (r.success) setTimeout(load, 2500);
    } catch (e: any) {
      notify(actionErrorFeedback(e, language, walletRuntimeCopy[language].unconfirmedResponse));
    }
  }

  async function revoke(l: any) {
    if (!address) return notify(copy.connect);
    try {
      notify(copy.preparingRemove);
      const resp = await api.rental.revoke({ owner: address, mint: l.mint });
      const r = await handleTxResponse(resp);
      notify(r.success ? `${copy.removed}: ${r.signature?.slice(0, 10)}…` : (r.error || walletRuntimeCopy[language].unconfirmedResponse));
      if (r.success) setTimeout(load, 2500);
    } catch (e: any) {
      notify(actionErrorFeedback(e, language, walletRuntimeCopy[language].unconfirmedResponse));
    }
  }

  async function endRental(l: any) {
    if (!address) return notify(copy.connect);
    try {
      notify(copy.readingAgreement);
      const info: any = await api.query.rental(l.mint);
      const renter = info?.agreement?.renter || info?.renter;
      if (!renter) return notify(copy.agreementUnknown);
      const resp = await api.rental.end({ caller: address, mint: l.mint, renterRefund: renter });
      const r = await handleTxResponse(resp);
      notify(r.success ? `${copy.ended}: ${r.signature?.slice(0, 10)}…` : (r.error || walletRuntimeCopy[language].unconfirmedResponse));
      if (r.success) setTimeout(load, 2500);
    } catch (e: any) {
      notify(actionErrorFeedback(e, language, walletRuntimeCopy[language].unconfirmedResponse));
    }
  }

  async function createRental() {
    if (!address) return notify(copy.connect);
    if (!selMint) return notify(copy.selectTool);
    const ownerSplitBps = Math.round(parseFloat(splitPct) * 100);
    const minS = Math.round(parseFloat(minH) * 3600);
    const maxS = Math.round(parseFloat(maxH) * 3600);
    const priceLam = Math.round(parseFloat(pricePerHour) * 1e9);
    if (!isFinite(ownerSplitBps) || ownerSplitBps < 0 || ownerSplitBps > 10000) return notify(copy.shareInvalid);
    if (!isFinite(minS) || !isFinite(maxS) || minS <= 0 || maxS < minS) return notify(copy.termInvalid);
    try {
      notify(copy.preparingList);
      const resp = await api.rental.list({
        owner: address, mint: selMint, ownerSplitBps: String(ownerSplitBps),
        minDuration: String(minS), maxDuration: String(maxS),
        pricePerHourLamports: String(isFinite(priceLam) && priceLam > 0 ? priceLam : 0),
      });
      const r = await handleTxResponse(resp);
      notify(r.success ? `${copy.listed}: ${r.signature?.slice(0, 10)}…` : (r.error || walletRuntimeCopy[language].unconfirmedResponse));
      if (r.success) {
        setFormOpen(false);
        setSelMint("");
        setTimeout(load, 2500);
      }
    } catch (e: any) {
      notify(actionErrorFeedback(e, language, walletRuntimeCopy[language].unconfirmedResponse));
    }
  }

  return (
    <div lang={language} className="p-4 pt-6 pb-24 space-y-4 min-w-0 [overflow-wrap:anywhere]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-parchment flex items-center gap-2"><ResourceGlyph icon={UI_ICONS.rental} alt="" className="w-7 h-7" />{copy.title}</h1>
        <button onClick={load} className="text-xs text-straw px-3 py-1.5 rounded-lg bg-soil-800 border border-straw/20">
          {loading ? "…" : copy.refresh}
        </button>
      </div>
      <p className="text-straw text-xs">
        {copy.intro}
      </p>
      <MarketFeeNote />

      {txStatus && statusLanguage === language && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="text-xs px-3 py-2 rounded-xl bg-soil-800 border border-straw/20 text-parchment">
          <NoticeMsg text={txStatus} />
        </motion.div>
      )}

      {rentals.length === 0 && !loading && (
        <Card className="text-center py-8">
          <div className="mb-2"><ResourceGlyph icon={UI_ICONS.rental} alt="" className="w-12 h-12 mx-auto" /></div>
          <p className="text-parchment text-sm">{copy.noRentals}</p>
          <p className="text-straw text-xs mt-1">{copy.noRentalsHint}</p>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3">
        {rentals.map((l, i) => {
          const rk = rarityKey(l.tool?.rarity);
          const mine = address && l.owner === address;
          const priceH = toNum(l.pricePerHourLamports);
          return (
            <motion.div key={l.pubkey || l.mint} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}>
              <Card className={`border ${mine ? "border-accent-600/40" : "border-straw/10"}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <ArtPlate src={toolPlate(l.tool?.toolType, rk)} alt={toolName(language, l.tool?.toolType)} size={56} />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-parchment font-semibold text-sm">{toolName(language, l.tool?.toolType)}</span>
                      <span className={`text-xs ${RARITY_COLOR[rk] || "text-straw"}`}>{rarityLabel(rk)}</span>
                    </div>
                    <p className="text-straw text-xs mt-0.5">
                      {shortAddr(l.mint)} · {copy.owner} {shortAddr(l.owner)}{mine ? ` (${copy.you})` : ""}
                    </p>
                    <p className="text-xs mt-1 text-straw">
                      {copy.ownerShare} <span className="text-parchment">{(toNum(l.ownerSplitBps) / 100).toFixed(0)}%</span>
                      {" · "}{copy.term}{" "}
                      <span className="text-parchment">
                        {(toNum(l.minDuration) / 3600).toFixed(0)}–{(toNum(l.maxDuration) / 3600).toFixed(0)} {copy.hour}
                      </span>
                    </p>
                    {priceH > 0 && (
                      <p className="text-xs text-accent-500 font-semibold">{fmtSol(priceH, language)} ◎ {copy.perHour}</p>
                    )}
                  </div>
                </div>

                {mine ? (
                  <div className="flex flex-wrap gap-2 mt-3">
                    <button onClick={() => endRental(l)}
                      className="flex-1 min-w-0 py-2 rounded-xl bg-soil-700 border border-straw/20 text-straw text-xs">
                      {copy.finish}
                    </button>
                    <button onClick={() => revoke(l)}
                      className="flex-1 min-w-0 py-2 rounded-xl bg-soil-700 border border-straw/20 text-straw text-xs">
                      {copy.remove}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <input
                      type="number" step="1" min="1" placeholder={copy.duration} aria-label={copy.duration}
                      value={hours[l.mint] || ""}
                      onChange={(e) => setHours((s) => ({ ...s, [l.mint]: e.target.value }))}
                      className="flex-1 min-w-0 bg-soil-800 border border-straw/20 rounded-xl px-3 py-2 text-parchment text-sm"
                    />
                    <button onClick={() => rent(l)}
                      className="px-4 py-2 rounded-xl bg-sprout-500 text-white text-sm font-medium">
                      {copy.rent}
                    </button>
                  </div>
                )}
              </Card>
            </motion.div>
          );
        })}
      </div>

      <Card>
        <button className="w-full flex items-center justify-between gap-2" onClick={() => setFormOpen((v) => !v)}>
          <div className="text-left min-w-0">
            <div className="text-parchment font-semibold text-sm">{copy.listTitle}</div>
            <div className="text-straw text-xs">{copy.listHint}</div>
          </div>
          <span className="text-straw">{formOpen ? "−" : "+"}</span>
        </button>
        {formOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 space-y-2">
            {!address && <p className="text-straw text-xs">{copy.connectTools}</p>}
            {address && myTools.length === 0 && (
              <p className="text-straw text-xs">{copy.noTools}</p>
            )}
            {myTools.map((t) => {
              const rk = rarityKey(t.rarity);
              return (
                <button key={t.mint} onClick={() => setSelMint(t.mint)}
                  className={`w-full flex flex-wrap items-center gap-2 px-3 py-2 rounded-xl border text-left ${selMint === t.mint ? "border-accent-500 bg-accent-500/10" : "border-straw/15 bg-soil-800/60"}`}>
                  <ArtPlate src={toolPlate(t.toolType, rk)} alt={toolName(language, t.toolType)} size={36} />
                  <span className="flex-1 min-w-0 text-sm text-parchment break-words">
                    {toolName(language, t.toolType)} <span className={`text-xs ${RARITY_COLOR[rk] ?? "text-straw"}`}>({rarityLabel(rk)})</span>
                  </span>
                  {selMint === t.mint && <span className="text-accent-500">✓</span>}
                </button>
              );
            })}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
              <div>
                <label htmlFor="rental-share" className="block text-straw text-xs mb-1">{copy.share}</label>
                <input id="rental-share" type="number" step="1" min="0" max="100" value={splitPct} onChange={(e) => setSplitPct(e.target.value)}
                  className="w-full bg-soil-800 border border-straw/20 rounded-xl px-3 py-2 text-parchment text-sm" />
              </div>
              <div>
                <label htmlFor="rental-price" className="block text-straw text-xs mb-1">{copy.price}</label>
                <input id="rental-price" type="number" step="0.0001" min="0" value={pricePerHour} onChange={(e) => setPricePerHour(e.target.value)}
                  className="w-full bg-soil-800 border border-straw/20 rounded-xl px-3 py-2 text-parchment text-sm" />
              </div>
              <div>
                <label htmlFor="rental-min" className="block text-straw text-xs mb-1">{copy.min}</label>
                <input id="rental-min" type="number" step="1" min="1" value={minH} onChange={(e) => setMinH(e.target.value)}
                  className="w-full bg-soil-800 border border-straw/20 rounded-xl px-3 py-2 text-parchment text-sm" />
              </div>
              <div>
                <label htmlFor="rental-max" className="block text-straw text-xs mb-1">{copy.max}</label>
                <input id="rental-max" type="number" step="1" min="1" value={maxH} onChange={(e) => setMaxH(e.target.value)}
                  className="w-full bg-soil-800 border border-straw/20 rounded-xl px-3 py-2 text-parchment text-sm" />
              </div>
            </div>
            <button onClick={createRental} disabled={!selMint}
              className="w-full py-2.5 rounded-xl bg-accent-600 text-white font-semibold text-sm disabled:opacity-40">
              {copy.list}
            </button>
          </motion.div>
        )}
      </Card>
    </div>
  );
}
