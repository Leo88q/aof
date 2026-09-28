import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../lib/api";
import { useWalletStore } from "../store/walletStore";
import { useFlash } from "../lib/marketUtils";
import { handleTxResponse } from "../lib/txFlow";
import { UI_ICONS, resourceIcon } from "../lib/visualAssets";
import { DRUM_EXPECTED_PRIZE, DRUM_PRIZES, DRUM_SPIN_COST } from "../lib/drumTable";
import { humanizeVrfError } from "../lib/vrfErrors";
import { ResourceGlyph } from "./visual/ResourceGlyph";
import { NoticeMsg } from "./visual/NoticeMsg";

/**
 * [F-06] Drum of Luck settled by Switchboard On-Demand.
 *
 * 1. commit — one wallet signature: the spin price goes to the quest treasury
 *    and a randomness account owned by aof-quests is committed in the same
 *    instruction.
 * 2. settle — the settler reveals within seconds; the prize is paid by the
 *    reveal and read back from the DrumRevealed event (/drum/status).
 * 3. If the service is slow, the player can settle it personally; after the
 *    ~2 h reveal window the same button refunds the price.
 */
const SELF_SETTLE_AFTER_MS = 25_000;
const POLL_MS = 2_000;

type Spin =
  | { state: "pending"; startedAt: number }
  | { state: "settled"; prize: number; signature: string }
  | { state: "refunded"; amount: number };

export function DrumSpin() {
  const { address } = useWalletStore();
  const [status, flash] = useFlash();
  const [busy, setBusy] = useState(false);
  const [spin, setSpin] = useState<Spin | null>(null);
  const [now, setNow] = useState(Date.now());
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(t); if (poll.current) clearInterval(poll.current); };
  }, []);

  // A spin left pending by a previous visit (closed tab, lost connection).
  useEffect(() => {
    if (!address) return;
    api.drum.status(address)
      .then((s: any) => { if (s?.state === "pending") watch(Date.now() - SELF_SETTLE_AFTER_MS); })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  function watch(startedAt = Date.now()) {
    if (!address) return;
    if (poll.current) clearInterval(poll.current);
    setSpin({ state: "pending", startedAt });
    poll.current = setInterval(async () => {
      try {
        const s: any = await api.drum.status(address);
        if (s?.state === "settled") {
          if (poll.current) clearInterval(poll.current);
          setSpin({ state: "settled", prize: Number(s.prize), signature: s.signature });
          flash(`🎉 Выигрыш: ${s.prize} MIND. Результат подтверждён в блокчейне.`, 8000);
        } else if (s?.state === "refunded") {
          if (poll.current) clearInterval(poll.current);
          setSpin({ state: "refunded", amount: Number(s.amount) });
          flash(`↩️ Оракул не ответил вовремя: ${s.amount} MIND возвращены.`, 8000);
        }
      } catch {
        /* keep polling: the RPC may lag the confirmation */
      }
    }, POLL_MS);
  }

  async function handleSpin() {
    if (!address) return flash("❌ Подключите кошелёк");
    if (busy) return;
    setBusy(true);
    try {
      const commitResponse = await api.drum.commit({ user: address });
      const commit = await handleTxResponse(commitResponse);
      if (!commit.success) throw new Error(commit.error || "Спин не выполнен");
      flash("✅ Спин оплачен. Оракул Switchboard определяет приз…", 8000);
      watch();
    } catch (e: any) {
      flash(`❌ ${humanizeVrfError(String(e?.message || e))}`, 8000);
    } finally {
      setBusy(false);
    }
  }

  async function selfSettle() {
    if (!address) return;
    setBusy(true);
    try {
      const resp: any = await api.drum.reveal({ user: address });
      const r = await handleTxResponse(resp);
      if (!r.success) throw new Error(r.error || "Действие не выполнено");
      flash(resp.phase === "refundable" ? "✅ Возврат отправлен" : "✅ Приз раскрыт вашим подтверждением", 6000);
      watch(spin?.state === "pending" ? spin.startedAt : Date.now());
    } catch (e: any) {
      flash(`❌ ${humanizeVrfError(String(e?.message || e))}`, 8000);
    } finally {
      setBusy(false);
    }
  }

  const pending = spin?.state === "pending";
  const canSelfSettle = pending && now - spin.startedAt >= SELF_SETTLE_AFTER_MS;
  // Канон реестра ресурсов — MIND; «mascot» остался только в именах инструкций aof-quests.
  const rewardIcon = resourceIcon("MIND") || UI_ICONS.rewardStar;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-soil-800 p-4 rounded-xl border border-straw/10">
        <div>
          <h3 className="text-parchment font-semibold flex items-center gap-2">
            <img src={UI_ICONS.drum} alt="" className="w-5 h-5 object-contain" />
            Барабан удачи
          </h3>
          <p className="text-straw text-xs">Спин стоит {DRUM_SPIN_COST} MIND. Баланс проверяет программа.</p>
        </div>
        <div className="text-3xl font-bold text-gold">{DRUM_SPIN_COST}</div>
      </div>

      {status && <div className="text-center text-straw text-sm"><NoticeMsg text={status} /></div>}

      <div className="relative flex flex-col items-center justify-center py-8 bg-gradient-to-b from-soil-800 to-soil-900 rounded-2xl border-2 border-wheat-600/30">
        <ResourceGlyph icon={UI_ICONS.rewardTrophy} alt="" className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-8 h-8 drop-shadow-lg" />

        <motion.div
          className="w-48 h-48 rounded-full bg-soil-700 border-4 border-gold/50 flex items-center justify-center overflow-hidden relative"
          animate={pending ? { rotate: 360 } : { rotate: 0 }}
          transition={pending ? { duration: 1.5, ease: "linear", repeat: Infinity } : { duration: 0.5 }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            {pending ? (
              <ResourceGlyph icon={UI_ICONS.drum} alt="" className="w-16 h-16 animate-pulse" />
            ) : spin?.state === "settled" ? (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-center">
                <img src={rewardIcon} alt="" className="w-14 h-14 mx-auto mb-2 object-contain" />
                <div className="text-parchment font-bold text-sm">+{spin.prize} MIND</div>
              </motion.div>
            ) : spin?.state === "refunded" ? (
              <div className="text-center text-parchment text-sm font-bold inline-flex items-center gap-1.5">
                <img src={UI_ICONS.noticeSuccess} alt="" className="w-4 h-4 object-contain" />
                {spin.amount} MIND
              </div>
            ) : (
              <ResourceGlyph icon={UI_ICONS.rewardDaily} alt="" className="w-16 h-16" />
            )}
          </div>
        </motion.div>

        <button
          onClick={handleSpin}
          disabled={busy || pending || !address}
          className="mt-8 px-8 py-3 rounded-2xl bg-gradient-to-r from-gold to-wheat-600 text-soil-950 font-bold text-lg shadow-lg shadow-gold/20 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? "Оракул определяет приз…" : <span className="inline-flex items-center gap-1.5"><ResourceGlyph icon={UI_ICONS.drum} alt="" className="w-5 h-5" /> Крутить барабан</span>}
        </button>

        {canSelfSettle && (
          <button
            onClick={selfSettle}
            disabled={busy}
            className="mt-3 px-4 py-2 rounded-xl border border-straw/30 text-parchment text-sm disabled:opacity-50"
          >
            Раскрыть самостоятельно
          </button>
        )}
      </div>

      <div className="bg-soil-800 p-4 rounded-xl border border-straw/10">
        <h3 className="text-parchment font-semibold mb-3 text-center">Возможные призы</h3>
        <div className="grid grid-cols-2 gap-3">
          {DRUM_PRIZES.map((prize) => (
            <div key={prize.amount} className="flex items-center gap-3 p-2 bg-soil-700/50 rounded-lg">
              <img src={rewardIcon} alt="" className="w-7 h-7 object-contain" />
              <div>
                <div className="text-parchment text-sm font-medium">{prize.amount} MIND</div>
                <div className="text-straw text-xs">{(prize.weightBps / 100).toLocaleString("ru-RU")}% шанс</div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-straw text-xs mt-3 text-center">
          В среднем {DRUM_EXPECTED_PRIZE.toLocaleString("ru-RU")} MIND за спин ({Math.round((DRUM_EXPECTED_PRIZE / DRUM_SPIN_COST) * 100)}% возврата).
        </p>
      </div>

      <p className="text-center text-straw text-xs">
        Приз определяет оракул Switchboard On-Demand. Аккаунт случайности принадлежит программе aof-quests,
        поэтому ни игра, ни игрок не могут перебросить или скрыть результат. Значение оракула публикуется в событии DrumRevealed.
      </p>
    </div>
  );
}
