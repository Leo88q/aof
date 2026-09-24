import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../../lib/api";
import { handleTxResponse } from "../../lib/txFlow";
import { useWalletStore } from "../../store/walletStore";
import { Card } from "../../components/ui/Card";
import { ArtPlate } from "../../components/visual/ArtPlate";
import {
  TOOL_ICONS, RARITY_LABEL, RARITY_COLOR, rarityKey,
  fmtSol, shortAddr, useTreasury, useFlash,
} from "../../lib/marketUtils";

export function OfferPage() {
  const { address } = useWalletStore();
  const treasury = useTreasury();
  const [myTools, setMyTools] = useState<any[]>([]);
  const [listings, setListings] = useState<any[]>([]);
  const [selOwn, setSelOwn] = useState("");
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [txStatus, flash] = useFlash();
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
    if (!address) return flash("❌ Connect your wallet first");
    if (!treasury) return flash("❌ Treasury config unavailable");
    try {
      flash("Принимаем оффер…");
      const resp = await api.offer.accept({ seller: address, mint: selOwn, buyer: o.buyer, treasury });
      const r = await handleTxResponse(resp);
      flash(r.success ? `✅ Сделка состоялась: ${r.signature?.slice(0, 10)}…` : `❌ ${r.error}`);
      if (r.success) setTimeout(() => setSelOwn((m) => m), 2500);
    } catch (e: any) {
      flash(`❌ ${e.message}`);
    }
  }

  async function cancelOffer(o: any) {
    if (!address) return flash("❌ Connect your wallet first");
    try {
      flash("Отзываем оффер…");
      const resp = await api.offer.cancel({ buyer: address, mint: selOwn });
      const r = await handleTxResponse(resp);
      flash(r.success ? `✅ Оффер отозван: ${r.signature?.slice(0, 10)}…` : `❌ ${r.error}`);
    } catch (e: any) {
      flash(`❌ ${e.message}`);
    }
  }

  async function createOffer() {
    if (!address) return flash("❌ Connect your wallet first");
    if (!offerMint) return flash("❌ Выберите инструмент из листингов");
    const lamports = Math.round(parseFloat(offerPrice) * 1e9);
    if (!isFinite(lamports) || lamports <= 0) return flash("❌ Укажите цену оффера в SOL");
    try {
      flash("Отправляем предложение…");
      const resp = await api.offer.create({ buyer: address, mint: offerMint, priceLamports: String(lamports) });
      const r = await handleTxResponse(resp);
      flash(r.success ? `✅ Оффер отправлен: ${r.signature?.slice(0, 10)}…` : `❌ ${r.error}`);
      if (r.success) setFormOpen(false);
    } catch (e: any) {
      flash(`❌ ${e.message}`);
    }
  }

  return (
    <div className="p-4 pt-6 pb-24 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-parchment">🤝 Офферы</h1>
      </div>
      <p className="text-straw text-xs">
        Переговоры о цене: покупатели предлагают свою цену за ваш инструмент — вы принимаете или ждёте лучшего.
      </p>

      {txStatus && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="text-xs px-3 py-2 rounded-xl bg-soil-800 border border-straw/20 text-parchment">
          {txStatus}
        </motion.div>
      )}

      {/* Входящие офферы: выбор своего инструмента */}
      <Card>
        <div className="text-parchment font-semibold text-sm mb-2">Входящие предложения</div>
        {!address && <p className="text-straw text-xs">Подключите кошелёк, чтобы увидеть свои инструменты</p>}
        {address && myTools.length === 0 && (
          <p className="text-straw text-xs">У вас нет инструментов — офферы получать не на что</p>
        )}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {myTools.map((t) => {
            const rk = rarityKey(t.rarity);
            return (
              <button key={t.mint} onClick={() => setSelOwn(t.mint)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs ${selOwn === t.mint ? "border-wheat-500 bg-wheat-500/10 text-parchment" : "border-straw/15 bg-soil-800/60 text-straw"}`}>
                <ArtPlate src={TOOL_ICONS[t.toolType]} alt={t.toolType || "Инструмент"} size={36} />
                <span>{t.toolType}</span>
                <span className={RARITY_COLOR[rk]}>· {RARITY_LABEL[rk]}</span>
              </button>
            );
          })}
        </div>

        {selOwn && (
          <div className="mt-3 space-y-2">
            {loading && <p className="text-straw text-xs">Читаем офферы…</p>}
            {!loading && offers.length === 0 && (
              <div className="text-center py-4">
                <div className="text-3xl mb-1">💬</div>
                <p className="text-straw text-xs">Пока никто не предложил цену за этот инструмент</p>
              </div>
            )}
            {offers.map((o, i) => {
              const mine = address && o.buyer === address;
              return (
                <motion.div key={o.pubkey || i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-soil-800/70 border border-straw/10">
                  <span className="text-xl">🤝</span>
                  <div className="flex-1">
                    <p className="text-parchment text-sm">
                      <span className="text-straw">{shortAddr(o.buyer)}{mine ? " (вы)" : ""}</span> предложил
                    </p>
                    <p className="text-wheat-500 font-bold">{fmtSol(o.priceLamports)} ◎</p>
                  </div>
                  {mine ? (
                    <button onClick={() => cancelOffer(o)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-soil-700 border border-straw/20 text-straw">
                      Отозвать
                    </button>
                  ) : (
                    <button onClick={() => accept(o)}
                      className="text-xs px-4 py-1.5 rounded-lg bg-sprout-500 text-white font-medium">
                      Принять
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
        <button className="w-full flex items-center justify-between" onClick={() => setFormOpen((v) => !v)}>
          <div className="text-left">
            <div className="text-parchment font-semibold text-sm">Сделать оффер</div>
            <div className="text-straw text-xs">Предложите свою цену за инструмент с прилавка</div>
          </div>
          <span className="text-straw">{formOpen ? "−" : "+"}</span>
        </button>
        {formOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 space-y-2">
            {listings.length === 0 && (
              <p className="text-straw text-xs">Сейчас нет активных листингов — предлагать цену не за что</p>
            )}
            {listings.map((l, i) => (
              <button key={l.pubkey || l.mint} onClick={() => setOfferMint(l.mint)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-left ${offerMint === l.mint ? "border-wheat-500 bg-wheat-500/10" : "border-straw/15 bg-soil-800/60"}`}>
                <span className="flex-1 text-sm text-parchment truncate">{shortAddr(l.mint)}</span>
                <span className="text-straw text-xs">просят {fmtSol(l.priceLamports)} ◎</span>
                {offerMint === l.mint && <span className="text-wheat-500">✓</span>}
              </button>
            ))}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-straw text-xs w-24">Моя цена, ◎</span>
              <input type="number" step="0.001" min="0" value={offerPrice} onChange={(e) => setOfferPrice(e.target.value)}
                className="flex-1 bg-soil-800 border border-straw/20 rounded-xl px-3 py-2 text-parchment text-sm" />
            </div>
            <button onClick={createOffer} disabled={!offerMint}
              className="w-full py-2.5 rounded-xl bg-wheat-600 text-white font-semibold text-sm disabled:opacity-40">
              Отправить предложение
            </button>
          </motion.div>
        )}
      </Card>
    </div>
  );
}
