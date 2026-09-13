import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../../lib/api";
import { handleTxResponse } from "../../lib/txFlow";
import { useWalletStore } from "../../store/walletStore";
import { Card } from "../../components/ui/Card";
import {
  TOOL_ICONS, RARITY_LABEL, RARITY_COLOR, rarityKey,
  fmtSol, shortAddr, toNum, useFlash,
} from "../../lib/marketUtils";

export function RentalPage() {
  const { address } = useWalletStore();
  const [rentals, setRentals] = useState<any[]>([]);
  const [myTools, setMyTools] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [txStatus, flash] = useFlash();
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
    if (!address) return flash("❌ Сначала подключите кошелёк");
    const minS = toNum(l.minDuration);
    const maxS = toNum(l.maxDuration);
    let durS = Math.round(parseFloat(hours[l.mint] || "0") * 3600);
    if (!isFinite(durS) || durS <= 0) return flash("❌ Укажите срок аренды в часах");
    if (durS < minS) durS = minS;
    if (maxS > 0 && durS > maxS) durS = maxS;
    try {
      flash("Инструмент уезжает на вашу ферму…");
      const resp = await api.rental.start({ renter: address, mint: l.mint, durationSeconds: String(durS) });
      const r = await handleTxResponse(resp);
      flash(r.success ? `✅ Аренда начата: ${r.signature?.slice(0, 10)}…` : `❌ ${r.error}`);
      if (r.success) setTimeout(load, 2500);
    } catch (e: any) {
      flash(`❌ ${e.message}`);
    }
  }

  async function revoke(l: any) {
    if (!address) return flash("❌ Сначала подключите кошелёк");
    try {
      flash("Снимаем с аренды…");
      const resp = await api.rental.revoke({ owner: address, mint: l.mint });
      const r = await handleTxResponse(resp);
      flash(r.success ? `✅ Листинг аренды снят: ${r.signature?.slice(0, 10)}…` : `❌ ${r.error}`);
      if (r.success) setTimeout(load, 2500);
    } catch (e: any) {
      flash(`❌ ${e.message}`);
    }
  }

  async function endRental(l: any) {
    if (!address) return flash("❌ Сначала подключите кошелёк");
    try {
      flash("Читаем соглашение…");
      const info: any = await api.query.rental(l.mint);
      const renter = info?.agreement?.renter || info?.renter;
      if (!renter) return flash("❌ Активной аренды по этому инструменту нет");
      const resp = await api.rental.end({ caller: address, mint: l.mint, renterRefund: renter });
      const r = await handleTxResponse(resp);
      flash(r.success ? `✅ Аренда завершена: ${r.signature?.slice(0, 10)}…` : `❌ ${r.error}`);
      if (r.success) setTimeout(load, 2500);
    } catch (e: any) {
      flash(`❌ ${e.message}`);
    }
  }

  async function createRental() {
    if (!address) return flash("❌ Сначала подключите кошелёк");
    if (!selMint) return flash("❌ Выберите инструмент");
    const ownerSplitBps = Math.round(parseFloat(splitPct) * 100);
    const minS = Math.round(parseFloat(minH) * 3600);
    const maxS = Math.round(parseFloat(maxH) * 3600);
    const priceLam = Math.round(parseFloat(pricePerHour) * 1e9);
    if (!isFinite(ownerSplitBps) || ownerSplitBps < 0 || ownerSplitBps > 10000) return flash("❌ Доля владельца 0–100%");
    if (!isFinite(minS) || !isFinite(maxS) || minS <= 0 || maxS < minS) return flash("❌ Проверьте сроки (мин ≤ макс)");
    try {
      flash("Сдаём в аренду…");
      const resp = await api.rental.list({
        owner: address, mint: selMint, ownerSplitBps: String(ownerSplitBps),
        minDuration: String(minS), maxDuration: String(maxS),
        pricePerHourLamports: String(isFinite(priceLam) && priceLam > 0 ? priceLam : 0),
      });
      const r = await handleTxResponse(resp);
      flash(r.success ? `✅ Аренда открыта: ${r.signature?.slice(0, 10)}…` : `❌ ${r.error}`);
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
        <h1 className="text-2xl font-bold text-parchment">🔑 Аренда</h1>
        <button onClick={load} className="text-xs text-straw px-3 py-1.5 rounded-lg bg-soil-800 border border-straw/20">
          {loading ? "…" : "⟳ Обновить"}
        </button>
      </div>
      <p className="text-straw text-xs">
        Чужой инструмент работает на вашей ферме и делится добычей. Владелец задаёт долю, срок и цену часа.
      </p>

      {txStatus && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="text-xs px-3 py-2 rounded-xl bg-soil-800 border border-straw/20 text-parchment">
          {txStatus}
        </motion.div>
      )}

      {rentals.length === 0 && !loading && (
        <Card className="text-center py-8">
          <div className="text-4xl mb-2">🔑</div>
          <p className="text-parchment text-sm">Сдаваемых инструментов нет</p>
          <p className="text-straw text-xs mt-1">Сдайте свой инструмент — пусть приносит долю, пока простаивает</p>
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
              <Card className={`border ${mine ? "border-wheat-600/40" : "border-straw/10"}`}>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{TOOL_ICONS[l.tool?.toolType] || "🛠️"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-parchment font-semibold text-sm">{l.tool?.toolType || "Инструмент"}</span>
                      <span className={`text-xs ${RARITY_COLOR[rk] || "text-straw"}`}>{RARITY_LABEL[rk] || rk}</span>
                    </div>
                    <p className="text-straw text-xs mt-0.5">
                      {shortAddr(l.mint)} · владелец {shortAddr(l.owner)}{mine ? " (вы)" : ""}
                    </p>
                    <p className="text-xs mt-1 text-straw">
                      Доля владельца <span className="text-parchment">{(toNum(l.ownerSplitBps) / 100).toFixed(0)}%</span>
                      {" · "}срок{" "}
                      <span className="text-parchment">
                        {(toNum(l.minDuration) / 3600).toFixed(0)}–{(toNum(l.maxDuration) / 3600).toFixed(0)} ч
                      </span>
                    </p>
                    {priceH > 0 && (
                      <p className="text-xs text-wheat-500 font-semibold">{fmtSol(priceH)} ◎ / час</p>
                    )}
                  </div>
                </div>

                {mine ? (
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => endRental(l)}
                      className="flex-1 py-2 rounded-xl bg-soil-700 border border-straw/20 text-straw text-xs">
                      Завершить аренду
                    </button>
                    <button onClick={() => revoke(l)}
                      className="flex-1 py-2 rounded-xl bg-soil-700 border border-straw/20 text-straw text-xs">
                      Снять листинг
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mt-3">
                    <input
                      type="number" step="1" min="1" placeholder="Срок, ч"
                      value={hours[l.mint] || ""}
                      onChange={(e) => setHours((s) => ({ ...s, [l.mint]: e.target.value }))}
                      className="flex-1 bg-soil-800 border border-straw/20 rounded-xl px-3 py-2 text-parchment text-sm"
                    />
                    <button onClick={() => rent(l)}
                      className="px-4 py-2 rounded-xl bg-sprout-500 text-white text-sm font-medium">
                      Арендовать
                    </button>
                  </div>
                )}
              </Card>
            </motion.div>
          );
        })}
      </div>

      <Card>
        <button className="w-full flex items-center justify-between" onClick={() => setFormOpen((v) => !v)}>
          <div className="text-left">
            <div className="text-parchment font-semibold text-sm">Сдать инструмент в аренду</div>
            <div className="text-straw text-xs">Доля с добычи + цена часа (опционально)</div>
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
            <div className="grid grid-cols-2 gap-2 pt-2">
              <div>
                <p className="text-straw text-xs mb-1">Доля владельца, %</p>
                <input type="number" step="1" min="0" max="100" value={splitPct} onChange={(e) => setSplitPct(e.target.value)}
                  className="w-full bg-soil-800 border border-straw/20 rounded-xl px-3 py-2 text-parchment text-sm" />
              </div>
              <div>
                <p className="text-straw text-xs mb-1">Цена часа, ◎ (0 = бесплатно)</p>
                <input type="number" step="0.0001" min="0" value={pricePerHour} onChange={(e) => setPricePerHour(e.target.value)}
                  className="w-full bg-soil-800 border border-straw/20 rounded-xl px-3 py-2 text-parchment text-sm" />
              </div>
              <div>
                <p className="text-straw text-xs mb-1">Мин. срок, ч</p>
                <input type="number" step="1" min="1" value={minH} onChange={(e) => setMinH(e.target.value)}
                  className="w-full bg-soil-800 border border-straw/20 rounded-xl px-3 py-2 text-parchment text-sm" />
              </div>
              <div>
                <p className="text-straw text-xs mb-1">Макс. срок, ч</p>
                <input type="number" step="1" min="1" value={maxH} onChange={(e) => setMaxH(e.target.value)}
                  className="w-full bg-soil-800 border border-straw/20 rounded-xl px-3 py-2 text-parchment text-sm" />
              </div>
            </div>
            <button onClick={createRental} disabled={!selMint}
              className="w-full py-2.5 rounded-xl bg-wheat-600 text-white font-semibold text-sm disabled:opacity-40">
              Открыть аренду
            </button>
          </motion.div>
        )}
      </Card>
    </div>
  );
}
