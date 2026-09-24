import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../../lib/api";
import { PlayerRating } from "../../components/PlayerRating";
import { handleTxResponse } from "../../lib/txFlow";
import { useWalletStore } from "../../store/walletStore";
import { Card } from "../../components/ui/Card";
import { DepthChart } from "../../components/charts/DepthChart";
import {
  ALL_TRADE_RESOURCES, fmtSol, shortAddr, toNum, useTreasury, useFlash,
} from "../../lib/marketUtils";
import { loadMints } from "../../lib/mints";

// Ресурсы — SPL 9 decimals: 1 единица = 1e9 базовых
const fmtRes = (v: any) => (toNum(v) / 1e9).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

export function OrderbookPage() {
  const { address } = useWalletStore();
  const treasury = useTreasury();
  const [res, setRes] = useState(ALL_TRADE_RESOURCES[0]);
  const [resources, setResources] = useState(ALL_TRADE_RESOURCES.filter((r) => r.mint));
  const [book, setBook] = useState<{ buy: any[]; sell: any[] }>({ buy: [], sell: [] });
  const [loading, setLoading] = useState(false);
  const [txStatus, flash] = useFlash();
  const [formOpen, setFormOpen] = useState<null | "buy" | "sell">(null);
  const [pricePerUnit, setPricePerUnit] = useState("0.0001");
  const [amount, setAmount] = useState("100");

  const load = useCallback(async (mint: string) => {
    setLoading(true);
    try {
      const b: any = await api.query.orderbook(mint);
      setBook({ buy: b?.buy || [], sell: b?.sell || [] });
    } catch (e) {
      console.error("orderbook:", e);
      setBook({ buy: [], sell: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMints().then((mints) => {
      const loaded = ALL_TRADE_RESOURCES
        .map((resource) => ({ ...resource, mint: mints[resource.key as keyof typeof mints] || "" }))
        .filter((resource) => resource.mint);
      setResources(loaded);
      if (loaded.length > 0) setRes((current) => loaded.find((r) => r.key === current.key) || loaded[0]);
    });
  }, []);

  useEffect(() => {
    if (res.mint) load(res.mint);
    else setBook({ buy: [], sell: [] });
  }, [res, load]);

  // Спрос (покупка) — семечки 🌱, предложение (продажа) — корзины 🧺 (предметный язык ТЗ §0)
  const bids = useMemo(
    () => [...book.buy].sort((a, b) => toNum(b.priceLamportsPerUnit) - toNum(a.priceLamportsPerUnit)),
    [book]
  );
  const asks = useMemo(
    () => [...book.sell].sort((a, b) => toNum(a.priceLamportsPerUnit) - toNum(b.priceLamportsPerUnit)),
    [book]
  );
  const depth = useMemo(() => ({
    bids: bids.map((o) => ({ price: toNum(o.priceLamportsPerUnit) / 1e9, amount: toNum(o.amountRemaining) / 1e9 })),
    asks: asks.map((o) => ({ price: toNum(o.priceLamportsPerUnit) / 1e9, amount: toNum(o.amountRemaining) / 1e9 })),
  }), [bids, asks]);

  async function place(side: "buy" | "sell") {
    if (!address) return flash("❌ Connect your wallet first");
    if (!res.mint) return flash("❌ Mint ресурсов ещё не инициализирован");
    const priceLam = Math.round(parseFloat(pricePerUnit) * 1e9);
    const amt = Math.round(parseFloat(amount) * 1e9);
    if (!isFinite(priceLam) || priceLam <= 0) return flash("❌ Укажите цену за единицу в SOL");
    if (!isFinite(amt) || amt <= 0) return flash("❌ Укажите количество единиц");
    try {
      flash(side === "buy" ? "Размещаем покупку…" : "Размещаем продажу…");
      const body = {
        maker: address, mint: res.mint, kind: res.kind,
        priceLamportsPerUnit: String(priceLam), amount: String(amt),
      };
      const resp = side === "buy" ? await api.orderbook.placeBuy(body) : await api.orderbook.placeSell(body);
      const r = await handleTxResponse(resp);
      flash(r.success ? `✅ Ордер размещён: ${r.signature?.slice(0, 10)}…` : `❌ ${r.error}`);
      if (r.success) {
        setFormOpen(null);
        setTimeout(() => load(res.mint), 2500);
      }
    } catch (e: any) {
      flash(`❌ ${e.message}`);
    }
  }

  async function cancel(o: any) {
    if (!address) return flash("❌ Connect your wallet first");
    try {
      flash("Отменяем ордер…");
      const resp = o.isBuy
        ? await api.orderbook.cancelBuy({ maker: address, mint: res.mint })
        : await api.orderbook.cancelSell({ maker: address, mint: res.mint });
      const r = await handleTxResponse(resp);
      flash(r.success ? `✅ Ордер отменён: ${r.signature?.slice(0, 10)}…` : `❌ ${r.error}`);
      if (r.success) setTimeout(() => load(res.mint), 2500);
    } catch (e: any) {
      flash(`❌ ${e.message}`);
    }
  }

  // Permissionless-матчинг: если лучший спрос ≥ лучшего предложения — сводим
  async function match() {
    if (!address) return flash("❌ Connect your wallet first");
    if (!treasury) return flash("❌ Treasury config unavailable");
    const bb = bids[0];
    const ba = asks[0];
    if (!bb || !ba) return flash("❌ Нет пары встречных ордеров");
    if (toNum(bb.priceLamportsPerUnit) < toNum(ba.priceLamportsPerUnit))
      return flash("❌ Цены не пересекаются — сведения нет");
    try {
      flash("Сводим ордера…");
      const resp = await api.orderbook.match({
        caller: address, mint: res.mint,
        buyMaker: bb.maker, sellMaker: ba.maker, treasury,
      });
      const r = await handleTxResponse(resp);
      flash(r.success ? `✅ Сведено: ${r.signature?.slice(0, 10)}…` : `❌ ${r.error}`);
      if (r.success) setTimeout(() => load(res.mint), 2500);
    } catch (e: any) {
      flash(`❌ ${e.message}`);
    }
  }

  const bestBid = bids[0];
  const bestAsk = asks[0];
  const crossable = bestBid && bestAsk && toNum(bestBid.priceLamportsPerUnit) >= toNum(bestAsk.priceLamportsPerUnit);

  return (
    <div className="p-4 pt-6 pb-24 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-parchment">📊 Ордербук</h1>
        <button onClick={() => load(res.mint)} className="text-xs text-straw px-3 py-1.5 rounded-lg bg-soil-800 border border-straw/20">
          {loading ? "…" : "⟳ Refresh"}
        </button>
      </div>
      <p className="text-straw text-xs">
        Биржа ресурсов: лимитные ордера на базовые ресурсы, камни, гемы и материалы.
        Нейрон 🌱 — хотят купить, контейнер 📦 — продают компоненты.
      </p>

      {/* Dropdown для выбора ресурса */}
      <div className="mb-4">
        <label className="block text-straw text-xs mb-2">Выберите ресурс для торговли:</label>
        <select
          value={res.key}
          onChange={(e) => {
            const selected = ALL_TRADE_RESOURCES.find(r => r.key === e.target.value);
            if (selected) setRes(selected);
          }}
          className="w-full bg-soil-800 text-parchment text-sm rounded-xl border border-straw/20 px-4 py-3 focus:border-wheat-500 focus:outline-none transition"
        >
          {resources.map((r) => (
            <option key={r.key} value={r.key}>
              {r.icon} {r.label}
            </option>
          ))}
        </select>
        <div className="mt-2 text-xs text-straw">
          {resources.length === 0
            ? "Ресурсные mint-ы не инициализированы — торговля отключена."
            : <>Выбрано: <span className="text-parchment font-bold">{res.icon} {res.label}</span></>}
        </div>
      </div>

      {txStatus && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="text-xs px-3 py-2 rounded-xl bg-soil-800 border border-straw/20 text-parchment">
          {txStatus}
        </motion.div>
      )}

      {/* Спред и матчинг */}
      <Card>
        <div className="flex items-center justify-between text-sm">
          <div>
            <p className="text-straw text-xs">Покупка (лучшая)</p>
            <p className="text-sprout-500 font-bold">{bestBid ? `${fmtSol(bestBid.priceLamportsPerUnit)} ◎` : "—"}</p>
          </div>
          <div className="text-center">
            <p className="text-straw text-xs">{res.icon} {res.label}</p>
            {crossable ? (
              <button onClick={match} className="mt-1 text-xs px-3 py-1.5 rounded-lg bg-wheat-600 text-white font-semibold animate-pulse">
                ⚡ Свести
              </button>
            ) : (
              <p className="text-straw text-xs mt-1">нет сведения</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-straw text-xs">Продажа (лучшая)</p>
            <p className="text-wheat-500 font-bold">{bestAsk ? `${fmtSol(bestAsk.priceLamportsPerUnit)} ◎` : "—"}</p>
          </div>
        </div>
      </Card>

      {/* Глубина рынка */}
      <Card>
        <div className="text-parchment font-semibold text-sm mb-2">Глубина рынка</div>
        {bids.length === 0 && asks.length === 0 ? (
          <p className="text-straw text-xs text-center py-4">Стакан пуст — разместите первый ордер</p>
        ) : (
          <DepthChart bids={depth.bids} asks={depth.asks} />
        )}
      </Card>

      {/* Стакан */}
      <Card>
        <div className="text-parchment font-semibold text-sm mb-2">Заявки</div>
        <div className="space-y-1">
          {[...asks].reverse().map((o, i) => {
            const mine = address && o.maker === address;
            return (
              <div key={o.pubkey || i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-wheat-600/10 text-xs">
                <span>🧺</span>
                <span className="text-straw">{shortAddr(o.maker)}{mine ? " (вы)" : ""}</span>
                <span className="flex-1" />
                <span className="text-parchment">{fmtRes(o.amountRemaining)} ед.</span>
                <span className="text-wheat-500 font-semibold w-24 text-right">{fmtSol(o.priceLamportsPerUnit)} ◎</span>
                {mine && <button onClick={() => cancel(o)} className="text-straw px-1">✕</button>}
              </div>
            );
          })}
          {asks.length > 0 && bids.length > 0 && (
            <div className="text-center text-straw text-xs py-1">— спред —</div>
          )}
          {bids.map((o, i) => {
            const mine = address && o.maker === address;
            return (
              <div key={o.pubkey || i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-sprout-500/10 text-xs">
                <span>🌱</span>
                <span className="text-straw">{shortAddr(o.maker)}{mine ? " (вы)" : ""}</span>
                <span className="flex-1" />
                <span className="text-parchment">{fmtRes(o.amountRemaining)} ед.</span>
                <span className="text-sprout-500 font-semibold w-24 text-right">{fmtSol(o.priceLamportsPerUnit)} ◎</span>
                {mine && <button onClick={() => cancel(o)} className="text-straw px-1">✕</button>}
              </div>
            );
          })}
          {asks.length === 0 && bids.length === 0 && (
            <p className="text-straw text-xs text-center py-4">Заявок пока нет</p>
          )}
        </div>
      </Card>

      {/* Формы размещения */}
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => setFormOpen(formOpen === "buy" ? null : "buy")}
          className={`py-2.5 rounded-xl text-sm font-semibold border ${formOpen === "buy" ? "bg-sprout-500 text-white border-sprout-500" : "bg-soil-800 text-sprout-500 border-sprout-500/30"}`}>
          🌱 Buy {res.label}
        </button>
        <button onClick={() => setFormOpen(formOpen === "sell" ? null : "sell")}
          className={`py-2.5 rounded-xl text-sm font-semibold border ${formOpen === "sell" ? "bg-wheat-600 text-white border-wheat-600" : "bg-soil-800 text-wheat-500 border-wheat-600/30"}`}>
          🧺 Sell {res.label}
        </button>
      </div>

      {formOpen && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <div className="text-parchment font-semibold text-sm mb-2">
              {formOpen === "buy" ? "Лимитный ордер на покупку" : "Лимитный ордер на продажу"}
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-straw text-xs w-28">Price/ед., ◎</span>
              <input type="number" step="0.000001" min="0" value={pricePerUnit} onChange={(e) => setPricePerUnit(e.target.value)}
                className="flex-1 bg-soil-800 border border-straw/20 rounded-xl px-3 py-2 text-parchment text-sm" />
            </div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-straw text-xs w-28">Кол-во, ед.</span>
              <input type="number" step="1" min="0" value={amount} onChange={(e) => setAmount(e.target.value)}
                className="flex-1 bg-soil-800 border border-straw/20 rounded-xl px-3 py-2 text-parchment text-sm" />
            </div>
            {formOpen === "sell" && (
              <p className="text-straw text-xs mb-2">При размещении токены блокируются в хранилище ордера.</p>
            )}
            <button onClick={() => place(formOpen)}
              className={`w-full py-2.5 rounded-xl text-white font-semibold text-sm ${formOpen === "buy" ? "bg-sprout-500" : "bg-wheat-600"}`}>
              Разместить ордер
            </button>
          </Card>
        </motion.div>
      )}

    </div>
  );
}