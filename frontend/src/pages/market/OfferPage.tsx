import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../../lib/api";
import { handleTxResponse } from "../../lib/txFlow";
import { actionErrorFeedback } from "../../lib/txResponseFeedback";
import { walletRuntimeCopy } from "../../i18n/walletRuntimeCopy";
import { useWalletStore } from "../../store/walletStore";
import { useLocale } from "../../i18n/LocaleProvider";
import { offerCopy } from "../../i18n/offerCopy";
import { toolName, toolsCopy } from "../../i18n/toolsCopy";
import { Card } from "../../components/ui/Card";
import { ArtPlate } from "../../components/visual/ArtPlate";
import { toolPlate, TOOL_RARITIES, UI_ICONS, type ToolRarity } from "../../lib/visualAssets";
import {
  RARITY_COLOR, rarityKey,
  fmtSol, shortAddr, useTreasury, useFlash,
} from "../../lib/marketUtils";
import { NoticeMsg } from "../../components/visual/NoticeMsg";
import { MarketFeeNote } from "../../components/MarketFeeNote";

export function OfferPage() {
  const { language } = useLocale();
  const copy = offerCopy[language];
  const rarityLabel = (rarity: string) => {
    const index = TOOL_RARITIES.indexOf(rarity as ToolRarity);
    return index < 0 ? toolsCopy[language].card.unknownRarity : toolsCopy[language].collectionPage.rarities[index];
  };
  const { address } = useWalletStore();
  const treasury = useTreasury();
  const [myTools, setMyTools] = useState<any[]>([]);
  const [listings, setListings] = useState<any[]>([]);
  const [selOwn, setSelOwn] = useState("");
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [txStatus, flash] = useFlash(language);
  const [statusLanguage, setStatusLanguage] = useState(language);
  const notify = (message: string) => { setStatusLanguage(language); flash(message); };
  const [formOpen, setFormOpen] = useState(false);
  const [offerMint, setOfferMint] = useState("");
  const [offerPrice, setOfferPrice] = useState("0.05");

  // Свои инструменты (для входящих офферов) + листинги (цели для исходящих)
  useEffect(() => {
    if (address) {
      api.query.myTools(address)
        .then((r: any) => setMyTools(Array.isArray(r) ? r : r?.tools || []))
        .catch(() => {});
    }
    api.query.listings()
      .then((r: any) => setListings(Array.isArray(r) ? r : []))
      .catch(() => {});
  }, [address]);

  // Офферы на выбранный инструмент
  useEffect(() => {
    if (!selOwn) { setOffers([]); return; }
    setLoading(true);
    api.query.offers(selOwn)
      .then((r: any) => setOffers(Array.isArray(r) ? r : []))
      .catch(() => setOffers([]))
      .finally(() => setLoading(false));
  }, [selOwn]);

  async function accept(o: any) {
    if (!address) return notify(copy.connect);
    if (!treasury) return notify(copy.noTreasury);
    try {
      notify(copy.preparingAccept);
      const resp = await api.offer.accept({ seller: address, mint: selOwn, buyer: o.buyer, treasury });
      const r = await handleTxResponse(resp);
      notify(r.success ? `${copy.accepted}: ${r.signature?.slice(0, 10)}…` : (r.error || walletRuntimeCopy[language].unconfirmedResponse));
      if (r.success) setTimeout(() => setSelOwn((m) => m), 2500);
    } catch (e: any) {
      notify(actionErrorFeedback(e, language, walletRuntimeCopy[language].unconfirmedResponse));
    }
  }

  async function cancelOffer(o: any) {
    if (!address) return notify(copy.connect);
    try {
      notify(copy.preparingCancel);
      const resp = await api.offer.cancel({ buyer: address, mint: selOwn });
      const r = await handleTxResponse(resp);
      notify(r.success ? `${copy.cancelled}: ${r.signature?.slice(0, 10)}…` : (r.error || walletRuntimeCopy[language].unconfirmedResponse));
    } catch (e: any) {
      notify(actionErrorFeedback(e, language, walletRuntimeCopy[language].unconfirmedResponse));
    }
  }

  async function createOffer() {
    if (!address) return notify(copy.connect);
    if (!offerMint) return notify(copy.chooseTool);
    const lamports = Math.round(parseFloat(offerPrice) * 1e9);
    if (!isFinite(lamports) || lamports <= 0) return notify(copy.invalidPrice);
    try {
      notify(copy.preparingSend);
      const resp = await api.offer.create({ buyer: address, mint: offerMint, priceLamports: String(lamports) });
      const r = await handleTxResponse(resp);
      notify(r.success ? `${copy.sent}: ${r.signature?.slice(0, 10)}…` : (r.error || walletRuntimeCopy[language].unconfirmedResponse));
      if (r.success) setFormOpen(false);
    } catch (e: any) {
      notify(actionErrorFeedback(e, language, walletRuntimeCopy[language].unconfirmedResponse));
    }
  }

  return (
    <div lang={language} className="p-4 pt-6 pb-24 space-y-4 min-w-0 [overflow-wrap:anywhere]">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-parchment flex items-center gap-2">
          <img src={UI_ICONS.marketOffer} alt="" className="w-6 h-6 object-contain" />
          {copy.title}
        </h1>
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

      {/* Входящие офферы: выбор своего инструмента */}
      <Card>
        <div className="text-parchment font-semibold text-sm mb-2">{copy.incoming}</div>
        {!address && <p className="text-straw text-xs">{copy.connectTools}</p>}
        {address && myTools.length === 0 && (
          <p className="text-straw text-xs">{copy.noTools}</p>
        )}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {myTools.map((t) => {
            const rk = rarityKey(t.rarity);
            return (
              <button key={t.mint} onClick={() => setSelOwn(t.mint)}
                className={`flex-shrink-0 max-w-full flex flex-wrap items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs text-left ${selOwn === t.mint ? "border-accent-500 bg-accent-500/10 text-parchment" : "border-straw/15 bg-soil-800/60 text-straw"}`}>
                <ArtPlate src={toolPlate(t.toolType, rk)} alt={toolName(language, t.toolType)} size={36} />
                <span className="min-w-0 break-words">{toolName(language, t.toolType)}</span>
                <span className={`${RARITY_COLOR[rk] ?? "text-straw"} min-w-0 break-words`}>· {rarityLabel(rk)}</span>
              </button>
            );
          })}
        </div>

        {selOwn && (
          <div className="mt-3 space-y-2">
            {loading && <p className="text-straw text-xs">{copy.reading}</p>}
            {!loading && offers.length === 0 && (
              <div className="text-center py-4">
                <img src={UI_ICONS.inbox} alt="" className="w-8 h-8 object-contain mx-auto mb-1" />
                <p className="text-straw text-xs">{copy.noOffers}</p>
              </div>
            )}
            {offers.map((o, i) => {
              const mine = address && o.buyer === address;
              return (
                <motion.div key={o.pubkey || i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex flex-wrap items-center gap-2 px-3 py-2.5 rounded-xl bg-soil-800/70 border border-straw/10">
                  <img src={UI_ICONS.marketOffer} alt="" className="w-5 h-5 object-contain shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-parchment text-sm">
                      <span className="text-straw">{shortAddr(o.buyer)}{mine ? ` (${copy.you})` : ""}</span>{copy.proposed}
                    </p>
                    <p className="text-accent-500 font-bold">{fmtSol(o.priceLamports, language)} ◎</p>
                  </div>
                  {mine ? (
                    <button onClick={() => cancelOffer(o)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-soil-700 border border-straw/20 text-straw">
                      {copy.cancel}
                    </button>
                  ) : (
                    <button onClick={() => accept(o)}
                      className="text-xs px-4 py-1.5 rounded-lg bg-sprout-500 text-white font-medium">
                      {copy.accept}
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Исходящий оффер */}
      <Card>
        <button className="w-full flex items-center justify-between gap-2" onClick={() => setFormOpen((v) => !v)}>
          <div className="text-left min-w-0">
            <div className="text-parchment font-semibold text-sm">{copy.outgoing}</div>
            <div className="text-straw text-xs">{copy.outgoingHint}</div>
          </div>
          <span className="text-straw">{formOpen ? "−" : "+"}</span>
        </button>
        {formOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 space-y-2">
            {listings.length === 0 && (
              <p className="text-straw text-xs">{copy.noListings}</p>
            )}
            {listings.map((l, i) => (
              <button key={l.pubkey || l.mint} onClick={() => setOfferMint(l.mint)}
                className={`w-full flex flex-wrap items-center gap-2 px-3 py-2 rounded-xl border text-left ${offerMint === l.mint ? "border-accent-500 bg-accent-500/10" : "border-straw/15 bg-soil-800/60"}`}>
                <span className="flex-1 min-w-0 text-sm text-parchment break-all">{shortAddr(l.mint)}</span>
                <span className="text-straw text-xs min-w-0 break-words">{copy.asking}: {fmtSol(l.priceLamports, language)} ◎</span>
                {offerMint === l.mint && <span className="text-accent-500">✓</span>}
              </button>
            ))}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <label htmlFor="offer-price" className="text-straw text-xs min-w-0 break-words">{copy.price}</label>
              <input id="offer-price" type="number" step="0.001" min="0" value={offerPrice} onChange={(e) => setOfferPrice(e.target.value)}
                className="flex-1 min-w-0 bg-soil-800 border border-straw/20 rounded-xl px-3 py-2 text-parchment text-sm" />
            </div>
            <button onClick={createOffer} disabled={!offerMint}
              className="w-full py-2.5 rounded-xl bg-accent-600 text-white font-semibold text-sm disabled:opacity-40">
              {copy.send}
            </button>
          </motion.div>
        )}
      </Card>
    </div>
  );
}
