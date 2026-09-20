import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../../lib/api";
import { handleTxResponse } from "../../lib/txFlow";
import { useWalletStore } from "../../store/walletStore";
import { Card } from "../../components/ui/Card";
import { FeatureDisabledNotice, isMechanicDisabled } from "../../components/ui/FeatureDisabledNotice";
import { fmtNum, fmtSol, toNum, useTreasury, useFlash } from "../../lib/marketUtils";

const FIELD_LABELS: Record<string, string> = {
  roundId: "Раунд",
  ticketPriceLamports: "Price билета",
  ticketsSold: "Билетов продано",
  prizePoolLamports: "Призовой фонд",
  winnerTicket: "Выигрышный билет",
  commitHash: "Комит (sha256)",
  drawn: "Розыгрыш прошёл",
  committed: "Комит сделан",
  phase: "Фаза",
  startTs: "Начало",
  endTs: "Окончание",
};

function fmtField(key: string, v: any): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "да" : "нет";
  if (/lamports|price|prize|pool/i.test(key)) return fmtSol(v) + " ◎";
  if (/ts$|time/i.test(key)) {
    const n = toNum(v);
    return n > 0 ? new Date(n * 1000).toLocaleString("ru-RU") : String(v);
  }
  const n = Number(v?.toString?.() ?? NaN);
  if (isFinite(n)) return fmtNum(n);
  const s = String(v);
  return s.length > 20 ? s.slice(0, 8) + "…" : s;
}

export function LotteryPage() {
  const { address } = useWalletStore();
  const treasury = useTreasury();
  const [roundId, setRoundId] = useState("1");
  const [round, setRound] = useState<any>(null);
  const [roundErr, setRoundErr] = useState<string | null>(null);
  const [myTickets, setMyTickets] = useState<any[]>([]);
  const [ticketNum, setTicketNum] = useState("");
  const [claimNum, setClaimNum] = useState("");
  const [spinning, setSpinning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [txStatus, flash] = useFlash();

  const load = useCallback(async (rid: string) => {
    setLoading(true);
    setRoundErr(null);
    try {
      const r: any = await api.query.lotteryRound(rid);
      setRound(r);
    } catch (e: any) {
      setRound(null);
      setRoundErr(e?.message || "Раунд не найден");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(roundId); }, [roundId, load]);

  useEffect(() => {
    if (!address) { setMyTickets([]); return; }
    api.query.myTickets(roundId, address)
      .then((r: any) => setMyTickets(Array.isArray(r) ? r : r?.tickets || []))
      .catch(() => setMyTickets([]));
  }, [roundId, address]);

  // Подсказка номера следующего билета по числу проданных
  useEffect(() => {
    const sold = round?.ticketsSold;
    if (sold !== undefined && sold !== null) setTicketNum(String(toNum(sold)));
  }, [round]);

  async function initRound() {
    try {
      flash("Создаём раунд…");
      const resp = await api.lottery.roundInit({ roundId });
      const r = await handleTxResponse(resp);
      flash(r.success ? `✅ Раунд ${roundId} создан: ${r.signature?.slice(0, 10)}…` : `❌ ${r.error}`);
      if (r.success) setTimeout(() => load(roundId), 2000);
    } catch (e: any) {
      flash(`❌ ${e.message}`);
    }
  }

  const ticketsDisabled = isMechanicDisabled("lottery");

  async function buyTicket() {
    if (ticketsDisabled) return flash("Покупка билетов временно отключена (fail-closed): транзакция не отправлена", 6000);
    if (!address) return flash("❌ Connect your wallet first");
    if (!treasury) return flash("❌ Treasury config unavailable");
    const n = ticketNum.trim();
    if (!n || isNaN(Number(n))) return flash("❌ Укажите номер билета");
    try {
      flash("Сажаем семечко-билет…");
      const resp = await api.lottery.ticketBuy({ buyer: address, roundId, ticketNumber: n, treasury });
      const r = await handleTxResponse(resp);
      flash(r.success ? `✅ Билет №${n} ваш: ${r.signature?.slice(0, 10)}…` : `❌ ${r.error}`);
      if (r.success) setTimeout(() => { load(roundId); }, 2000);
    } catch (e: any) {
      flash(`❌ ${e.message}`);
    }
  }

  async function draw() {
    try {
      setSpinning(true);
      flash("Фаза 1: комит хеша (честный розыгрыш)…", 8000);
      const c = await api.lottery.drawCommit({ roundId });
      const rc = await handleTxResponse(c);
      if (!rc.success) {
        setSpinning(false);
        return flash(`❌ Комит: ${rc.error}`);
      }
      flash("Фаза 2: барабан крутится, раскрываем секрет…", 8000);
      await new Promise((r) => setTimeout(r, 3000));
      const rv = await api.lottery.drawReveal({ roundId });
      const rr = await handleTxResponse(rv);
      setSpinning(false);
      flash(rr.success ? `✅ Розыгрыш прошёл: ${rr.signature?.slice(0, 10)}…` : `❌ Ревил: ${rr.error}`);
      if (rr.success) setTimeout(() => load(roundId), 2000);
    } catch (e: any) {
      setSpinning(false);
      flash(`❌ ${e.message}`);
    }
  }

  async function claim() {
    if (!address) return flash("❌ Connect your wallet first");
    const n = claimNum.trim();
    if (!n || isNaN(Number(n))) return flash("❌ Укажите номер выигрышного билета");
    try {
      flash("Забираем приз…");
      const resp = await api.lottery.claim({ winner: address, roundId, ticketNumber: n });
      const r = await handleTxResponse(resp);
      flash(r.success ? `✅ Приз забран: ${r.signature?.slice(0, 10)}…` : `❌ ${r.error}`);
      if (r.success) setTimeout(() => load(roundId), 2000);
    } catch (e: any) {
      flash(`❌ ${e.message}`);
    }
  }

  const roundEntries = round
    ? Object.entries(round).filter(([k]) => !["bump"].includes(k))
    : [];

  return (
    <div className="p-4 pt-6 pb-24 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-parchment">🎰 Лотерея</h1>
        <button onClick={() => load(roundId)} className="text-xs text-straw px-3 py-1.5 rounded-lg bg-soil-800 border border-straw/20">
          {loading ? "…" : "⟳ Refresh"}
        </button>
      </div>
      {ticketsDisabled && <FeatureDisabledNotice id="lottery" />}
      <p className="text-straw text-xs">
        Барабан Урожая: билеты — пакетики семян, розыгрыш честный (комит-ревил хеша), приз — пул раунда.
      </p>

      {txStatus && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="text-xs px-3 py-2 rounded-xl bg-soil-800 border border-straw/20 text-parchment">
          {txStatus}
        </motion.div>
      )}

      {/* Выбор раунда */}
      <div className="flex items-center gap-2">
        <span className="text-straw text-xs">Раунд</span>
        <input type="number" min="1" step="1" value={roundId}
          onChange={(e) => setRoundId(e.target.value)}
          className="w-24 bg-soil-800 border border-straw/20 rounded-xl px-3 py-2 text-parchment text-sm" />
      </div>

      {/* Барабан */}
      <Card className="text-center py-6">
        <motion.div
          animate={{ rotate: spinning ? 360 : 0 }}
          transition={spinning ? { repeat: Infinity, duration: 0.5, ease: "linear" } : { duration: 0.4 }}
          className="text-6xl inline-block"
        >
          🌾
        </motion.div>
        <p className="text-parchment font-semibold mt-2">{spinning ? "Барабан крутится…" : "Барабан Урожая"}</p>
        <p className="text-straw text-xs mt-1">
          {round?.winnerTicket !== undefined && toNum(round.winnerTicket) >= 0 && round?.drawn
            ? `Выигрышный билет: №${fmtNum(round.winnerTicket)}`
            : "Крутите барабан после продажи билетов"}
        </p>
      </Card>

      {/* Состояние раунда */}
      <Card>
        <div className="text-parchment font-semibold text-sm mb-2">Раунд {roundId}</div>
        {!round && roundErr && (
          <div className="text-center py-3">
            <div className="text-3xl mb-1">🌱</div>
            <p className="text-straw text-xs mb-3">Раунд ещё не создан</p>
            <button onClick={initRound} className="px-4 py-2 rounded-xl bg-wheat-600 text-white text-sm font-semibold">
              Создать раунд {roundId}
            </button>
          </div>
        )}
        {round && (
          <div className="grid grid-cols-2 gap-2">
            {roundEntries.map(([k, v]) => (
              <div key={k} className="px-3 py-2 rounded-xl bg-soil-800/70 border border-straw/10">
                <p className="text-straw text-xs">{FIELD_LABELS[k] || k}</p>
                <p className="text-parchment text-sm font-medium break-all">{fmtField(k, v)}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Покупка билета */}
      <Card>
        <div className="text-parchment font-semibold text-sm mb-2">Buy билет</div>
        {round?.ticketPriceLamports !== undefined && (
          <p className="text-straw text-xs mb-2">Price: <span className="text-wheat-500 font-semibold">{fmtSol(round.ticketPriceLamports)} ◎</span></p>
        )}
        <div className="flex items-center gap-2">
          <input type="number" min="0" step="1" placeholder="Номер билета" value={ticketNum}
            onChange={(e) => setTicketNum(e.target.value)}
            className="flex-1 bg-soil-800 border border-straw/20 rounded-xl px-3 py-2 text-parchment text-sm" />
          <button onClick={buyTicket} disabled={ticketsDisabled} className="px-4 py-2 rounded-xl bg-sprout-500 text-white text-sm font-medium disabled:opacity-40">
            🌱 Buy
          </button>
        </div>

        {myTickets.length > 0 && (
          <div className="mt-3">
            <p className="text-straw text-xs mb-1.5">Ваши билеты:</p>
            <div className="flex flex-wrap gap-1.5">
              {myTickets.map((t: any, i) => (
                <span key={i} className="px-2.5 py-1 rounded-lg bg-wheat-500/15 border border-wheat-500/30 text-wheat-500 text-xs font-semibold">
                  🎫 №{fmtNum(t.ticketNumber ?? t)}
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Розыгрыш */}
      <Card>
        <div className="text-parchment font-semibold text-sm mb-1">Розыгрыш (комит-ревил)</div>
        <p className="text-straw text-xs mb-3">
          Фаза 1 фиксирует хеш секрета ончейн, фаза 2 раскрывает его и определяет победителя — подтасовать задним числом нельзя.
        </p>
        <button onClick={draw} disabled={spinning}
          className="w-full py-2.5 rounded-xl bg-wheat-600 text-white font-semibold text-sm disabled:opacity-50">
          {spinning ? "Барабан крутится…" : "🎰 Крутить барабан"}
        </button>
      </Card>

      {/* Клейм */}
      <Card>
        <div className="text-parchment font-semibold text-sm mb-2">Забрать приз</div>
        <div className="flex items-center gap-2">
          <input type="number" min="0" step="1" placeholder="Номер выигрышного билета" value={claimNum}
            onChange={(e) => setClaimNum(e.target.value)}
            className="flex-1 bg-soil-800 border border-straw/20 rounded-xl px-3 py-2 text-parchment text-sm" />
          <button onClick={claim} className="px-4 py-2 rounded-xl bg-sprout-500 text-white text-sm font-medium">
            Забрать
          </button>
        </div>
      </Card>
    </div>
  );
}
