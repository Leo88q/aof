import { positiveU64, solToLamports, lamportsToSol } from "../../lib/amounts";
import type { MarketplaceBuyIntent } from "../../lib/transactionIntent";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../../lib/api";
import { handleTxResponse } from "../../lib/txFlow";
import { useWalletStore } from "../../store/walletStore";
import { Card } from "../../components/ui/Card";
import { ArtPlate } from "../../components/visual/ArtPlate";
import { toolPlate, UI_ICONS } from "../../lib/visualAssets";
import { ResourceGlyph } from "../../components/visual/ResourceGlyph";
import {
  RARITY_LABEL, RARITY_COLOR, rarityKey,
  shortAddr, useTreasury, useFlash,
} from "../../lib/marketUtils";

export function ListingPage() {
  const { address } = useWalletStore();
  const treasury = useTreasury();
  const [listings, setListings] = useState<any[]>([]);
  const [myTools, setMyTools] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [txStatus, flash] = useFlash();
  const [formOpen, setFormOpen] = useState(false);
  const [selMint, setSelMint] = useState("");
  const [priceSol, setPriceSol] = useState("0.1");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const ls: any = await api.query.listings();
      const arr: any[] = Array.isArray(ls) ? ls : [];
      // Мета инструмента к каждому лоту (тип + редкость для карточки-прилавка)
      const withMeta = await Promise.all(
        arr.map(async (l) => ({ ...l, tool: await api.query.tool(l.mint).catch(() => null) }))
      );
      setListings(withMeta);
    } catch (e) {
      console.error("listings:", e);
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

  async function buy(l: any) {
    if (!address) return flash("❌ Connect your wallet first (кнопка вверху)");
    if (!treasury) return flash("❌ Treasury config unavailable");
    try {
      flash("Готовим покупку…");
      const intent: MarketplaceBuyIntent = Object.freeze({
        kind: "marketplaceBuy", buyer: address, seller: l.seller, treasury, mint: l.mint,
        maxPriceLamports: positiveU64(l.priceLamports),
        expiresAt: String(Math.floor(Date.now() / 1000) + 120),
      });
      const { kind: _kind, ...request } = intent;
      const resp = await api.marketplace.buy(request);
      const r = await handleTxResponse(resp, intent);
      flash(r.success ? `✅ Инструмент ваш: ${r.signature?.slice(0, 10)}…` : `❌ ${r.error}`);
      if (r.success) {
        window.dispatchEvent(new CustomEvent("aof:refresh"));
        setTimeout(load, 2500);
      }
    } catch (e: any) {
      flash(`❌ ${e.message}`);
    }
  }

  async function cancel(l: any) {
    if (!address) return flash("❌ Connect your wallet first");
    try {
      flash("Снимаем с продажи…");
      const resp = await api.marketplace.cancel({ seller: address, mint: l.mint });
      const r = await handleTxResponse(resp);
      flash(r.success ? `✅ Лот снят: ${r.signature?.slice(0, 10)}…` : `❌ ${r.error}`);
      if (r.success) {
        window.dispatchEvent(new CustomEvent("aof:refresh"));
        setTimeout(load, 2500);
      }
    } catch (e: any) {
      flash(`❌ ${e.message}`);
    }
  }

  async function createListing() {
    if (!address) return flash("❌ Connect your wallet first");
    if (!selMint) return flash("❌ Выберите инструмент");
    try {
      const lamports = solToLamports(priceSol);
      flash("Выставляем на прилавок…");
      const resp = await api.marketplace.list({ seller: address, mint: selMint, priceLamports: String(lamports) });
      const r = await handleTxResponse(resp);
      flash(r.success ? `✅ Лот создан: ${r.signature?.slice(0, 10)}…` : `❌ ${r.error}`);
      if (r.success) {
        setFormOpen(false);
        setSelMint("");
        setTimeout(load, 2500);
      }
    } catch (e: any) {
      flash(`❌ ${e.message}`);
    }
  }

  return (
    <div className="p-4 pt-6 pb-24 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-parchment">🏷️ Листинг</h1>
        <button onClick={load} className="text-xs text-straw px-3 py-1.5 rounded-lg bg-soil-800 border border-straw/20">
          {loading ? "…" : "⟳ Refresh"}
        </button>
      </div>
      <p className="text-straw text-xs">
        Прилавки рынка NeuroForge: фиксированная цена в SOL, покупка в один тап.
      </p>

      {txStatus && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="text-xs px-3 py-2 rounded-xl bg-soil-800 border border-straw/20 text-parchment">
          {txStatus}
        </motion.div>
      )}

      {listings.length === 0 && !loading && (
        <Card className="text-center py-8">
          <div className="mb-2"><ResourceGlyph icon={UI_ICONS.marketListing} alt="" className="w-12 h-12 mx-auto" /></div>
          <p className="text-parchment text-sm">Прилавки пусты</p>
          <p className="text-straw text-xs mt-1">Выставьте свой инструмент — он найдёт покупателя</p>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3">
        {listings.map((l, i) => {
          const rk = rarityKey(l.tool?.rarity);
          const mine = address && l.seller === address;
          return (
            <motion.div key={l.pubkey || l.mint} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}>
              <Card className={`border ${mine ? "border-wheat-600/40" : "border-straw/10"}`}>
                <div className="flex items-center gap-3">
                  <ArtPlate src={toolPlate(l.tool?.toolType, rk)} alt={l.tool?.toolType || "Инструмент"} size={56} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-parchment font-semibold text-sm">{l.tool?.toolType || "Инструмент"}</span>
                      <span className={`text-xs ${RARITY_COLOR[rk] || "text-straw"}`}>{RARITY_LABEL[rk] || rk}</span>
                    </div>
                    <p className="text-straw text-xs mt-0.5">
                      {shortAddr(l.mint)} · продавец {shortAddr(l.seller)}{mine ? " (вы)" : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-wheat-500 font-bold">{lamportsToSol(l.priceLamports)} ◎</div>
                    {mine ? (
                      <button onClick={() => cancel(l)}
                        className="mt-1 text-xs px-3 py-1 rounded-lg bg-soil-700 border border-straw/20 text-straw">
                        Снять
                      </button>
                    ) : (
                      <button onClick={() => buy(l)}
                        className="mt-1 text-xs px-4 py-1 rounded-lg bg-sprout-500 text-white font-medium">
                        Buy
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <Card>
        <button className="w-full flex items-center justify-between" onClick={() => setFormOpen((v) => !v)}>
          <div className="text-left">
            <div className="text-parchment font-semibold text-sm">Выставить инструмент</div>
            <div className="text-straw text-xs">Фиксированная цена в SOL</div>
          </div>
          <span className="text-straw">{formOpen ? "−" : "+"}</span>
        </button>
        {formOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 space-y-2">
            {!address && <p className="text-straw text-xs">Подключите кошелёк, чтобы увидеть свои инструменты</p>}
            {address && myTools.length === 0 && (
              <p className="text-straw text-xs">Нет свободных инструментов (все в стейке/майнинге или отсутствуют)</p>
            )}
            {myTools.map((t) => {
              const rk = rarityKey(t.rarity);
              return (
                <button key={t.mint} onClick={() => setSelMint(t.mint)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-left ${selMint === t.mint ? "border-wheat-500 bg-wheat-500/10" : "border-straw/15 bg-soil-800/60"}`}>
                  <ArtPlate src={toolPlate(t.toolType, rk)} alt={t.toolType || "Инструмент"} size={36} />
                  <span className="flex-1 text-sm text-parchment">
                    {t.toolType} <span className={`text-xs ${RARITY_COLOR[rk]}`}>({RARITY_LABEL[rk]})</span>
                  </span>
                  {selMint === t.mint && <span className="text-wheat-500">✓</span>}
                </button>
              );
            })}
            <div className="flex items-center gap-2 pt-2">
              <span className="text-straw text-xs w-20">Price, ◎</span>
              <input type="number" step="0.001" min="0" value={priceSol} onChange={(e) => setPriceSol(e.target.value)}
                className="flex-1 bg-soil-800 border border-straw/20 rounded-xl px-3 py-2 text-parchment text-sm" />
            </div>
            <button onClick={createListing} disabled={!selMint}
              className="w-full py-2.5 rounded-xl bg-wheat-600 text-white font-semibold text-sm disabled:opacity-40">
              Выставить на прилавок
            </button>
          </motion.div>
        )}
      </Card>
    </div>
  );
}
