import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { api } from "../../lib/api";
import { handleTxResponse } from "../../lib/txFlow";
import { useWalletStore } from "../../store/walletStore";
import { Card } from "../../components/ui/Card";
import {
  TOOL_ICONS, RARITY_LABEL, RARITY_COLOR, rarityKey,
  fmtSol, shortAddr, timeLeftStr, toNum, useNow, useTreasury, useFlash,
} from "../../lib/marketUtils";

const SYSTEM_KEY = "11111111111111111111111111111111";

export function AuctionPage() {
  const { address } = useWalletStore();
  const treasury = useTreasury();
  const now = useNow(1000);
  const [auctions, setAuctions] = useState<any[]>([]);
  const [myTools, setMyTools] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [txStatus, flash] = useFlash();
  const [bids, setBids] = useState<Record<string, string>>({});
  const [formOpen, setFormOpen] = useState(false);
  const [selMint, setSelMint] = useState("");
  const [minBidSol, setMinBidSol] = useState("0.05");
  const [durationH, setDurationH] = useState("24");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list: any = await api.query.auctions();
      const arr: any[] = Array.isArray(list) ? list : [];
      const withMeta = await Promise.all(
        arr.map(async (a) => ({ ...a, tool: await api.query.tool(a.mint).catch(() => null) }))
      );
      setAuctions(withMeta);
    } catch (e) {
      console.error("auctions:", e);
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

  async function bid(a: any) {
    if (!address) return flash("❌ Connect your wallet first");
    const lamports = Math.round(parseFloat(bids[a.mint] || "0") * 1e9);
    if (!isFinite(lamports) || lamports <= 0) return flash("❌ Укажите сумму ставки в SOL");
    try {
      // Возврат предыдущей ставки: предыдущий bidder, а если ставок ещё не было — продавец
      const prev = a.highestBidder && a.highestBidder !== SYSTEM_KEY ? a.highestBidder : a.seller;
      flash("Ставим ставку…");
      const resp = await api.auction.bid({ bidder: address, mint: a.mint, amount: String(lamports), previousBidder: prev });
      const r = await handleTxResponse(resp);
      flash(r.success ? `✅ Ставка принята: ${r.signature?.slice(0, 10)}…` : `❌ ${r.error}`);
      if (r.success) setTimeout(load, 2500);
    } catch (e: any) {
      flash(`❌ ${e.message}`);
    }
  }

  async function settle(a: any) {
    if (!address) return flash("❌ Connect your wallet first");
    if (!treasury) return flash("❌ Treasury config unavailable");
    const winner = a.highestBidder;
    if (!winner || winner === SYSTEM_KEY) return flash("❌ Ставок не было — завершать нечего");
    try {
      const winnerToken = getAssociatedTokenAddressSync(
        new PublicKey(a.mint), new PublicKey(winner), true
      ).toBase58();
      flash("Завершаем аукцион…");
      const resp = await api.auction.settle({
        caller: address, mint: a.mint, seller: a.seller, treasury, winnerToken,
      });
      const r = await handleTxResponse(resp);
      flash(r.success ? `✅ Аукцион завершён: ${r.signature?.slice(0, 10)}…` : `❌ ${r.error}`);
      if (r.success) setTimeout(load, 2500);
    } catch (e: any) {
      flash(`❌ ${e.message}`);
    }
  }

  async function createAuction() {
    if (!address) return flash("❌ Connect your wallet first");
    if (!selMint) return flash("❌ Выберите инструмент");
    const minBid = Math.round(parseFloat(minBidSol) * 1e9);
    const dur = Math.round(parseFloat(durationH) * 3600);
    if (!isFinite(minBid) || minBid <= 0) return flash("❌ Укажите минимальную ставку");
    if (!isFinite(dur) || dur <= 0) return flash("❌ Укажите длительность");
    try {
      flash("Создаём аукцион…");
      const resp = await api.auction.create({
        seller: address, mint: selMint, minBid: String(minBid), durationSeconds: String(dur),
      });
      const r = await handleTxResponse(resp);
      flash(r.success ? `✅ Аукцион создан: ${r.signature?.slice(0, 10)}…` : `❌ ${r.error}`);
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
        <h1 className="text-2xl font-bold text-parchment">🔨 Аукцион</h1>
        <button onClick={load} className="text-xs text-straw px-3 py-1.5 rounded-lg bg-soil-800 border border-straw/20">
          {loading ? "…" : "⟳ Refresh"}
        </button>
      </div>
      <p className="text-straw text-xs">
        Кто больше — того и инструмент. Последние 5 минут таймер «горит» — не проспи молоток.
      </p>

      {txStatus && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="text-xs px-3 py-2 rounded-xl bg-soil-800 border border-straw/20 text-parchment">
          {txStatus}
        </motion.div>
      )}

      {auctions.length === 0 && !loading && (
        <Card className="text-center py-8">
          <div className="text-4xl mb-2">🔨</div>
          <p className="text-parchment text-sm">Активных аукционов нет</p>
          <p className="text-straw text-xs mt-1">Создайте первый — молоток ждёт</p>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3">
        {auctions.map((a, i) => {
          const rk = rarityKey(a.tool?.rarity);
          const endsMs = toNum(a.endsAt) * 1000;
          const ended = endsMs <= now;
          const lastFiveMin = !ended && endsMs - now < 5 * 60 * 1000;
          const topBid = toNum(a.highestBid);
          return (
            <motion.div key={a.pubkey || a.mint} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}>
              <Card className={`border ${lastFiveMin ? "border-wheat-500 animate-pulse" : "border-straw/10"}`}>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{TOOL_ICONS[a.tool?.toolType] || "🛠️"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-parchment font-semibold text-sm">{a.tool?.toolType || "Инструмент"}</span>
                      <span className={`text-xs ${RARITY_COLOR[rk] || "text-straw"}`}>{RARITY_LABEL[rk] || rk}</span>
                    </div>
                    <p className="text-straw text-xs mt-0.5">
                      {shortAddr(a.mint)} · продавец {shortAddr(a.seller)}
                    </p>
                    <p className="text-xs mt-1">
                      {topBid > 0 ? (
                        <span className="text-wheat-500 font-bold">Ставка: {fmtSol(topBid)} ◎</span>
                      ) : (
                        <span className="text-straw">Ставок ещё нет · мин. {fmtSol(a.minBid)} ◎</span>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className={`text-xs font-semibold ${ended ? "text-straw" : lastFiveMin ? "text-wheat-500" : "text-parchment"}`}>
                      {ended ? "⏹ " : "⏳ "}{timeLeftStr(toNum(a.endsAt))}
                    </div>
                  </div>
                </div>

                {!ended && (
                  <div className="flex items-center gap-2 mt-3">
                    <input
                      type="number" step="0.001" min="0" placeholder="Ставка, ◎"
                      value={bids[a.mint] || ""}
                      onChange={(e) => setBids((s) => ({ ...s, [a.mint]: e.target.value }))}
                      className="flex-1 bg-soil-800 border border-straw/20 rounded-xl px-3 py-2 text-parchment text-sm"
                    />
                    <button onClick={() => bid(a)}
                      className="px-4 py-2 rounded-xl bg-sprout-500 text-white text-sm font-medium">
                      Ставка
                    </button>
                  </div>
                )}

                {ended && (
                  <button onClick={() => settle(a)}
                    className="mt-3 w-full py-2 rounded-xl bg-wheat-600 text-white text-sm font-semibold">
                    🔨 Завершить и передать победителю
                  </button>
                )}
              </Card>
            </motion.div>
          );
        })}
      </div>

      <Card>
        <button className="w-full flex items-center justify-between" onClick={() => setFormOpen((v) => !v)}>
          <div className="text-left">
            <div className="text-parchment font-semibold text-sm">Создать аукцион</div>
            <div className="text-straw text-xs">Минимальная ставка + длительность</div>
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
                  <span className="text-xl">{TOOL_ICONS[t.toolType] || "🛠️"}</span>
                  <span className="flex-1 text-sm text-parchment">
                    {t.toolType} <span className={`text-xs ${RARITY_COLOR[rk]}`}>({RARITY_LABEL[rk]})</span>
                  </span>
                  {selMint === t.mint && <span className="text-wheat-500">✓</span>}
                </button>
              );
            })}
            <div className="flex items-center gap-2 pt-2">
              <span className="text-straw text-xs w-28">Мин. ставка, ◎</span>
              <input type="number" step="0.001" min="0" value={minBidSol} onChange={(e) => setMinBidSol(e.target.value)}
                className="flex-1 bg-soil-800 border border-straw/20 rounded-xl px-3 py-2 text-parchment text-sm" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-straw text-xs w-28">Длительность, ч</span>
              <input type="number" step="1" min="1" value={durationH} onChange={(e) => setDurationH(e.target.value)}
                className="flex-1 bg-soil-800 border border-straw/20 rounded-xl px-3 py-2 text-parchment text-sm" />
            </div>
            <button onClick={createAuction} disabled={!selMint}
              className="w-full py-2.5 rounded-xl bg-wheat-600 text-white font-semibold text-sm disabled:opacity-40">
              Создать аукцион
            </button>
          </motion.div>
        )}
      </Card>
    </div>
  );
}
