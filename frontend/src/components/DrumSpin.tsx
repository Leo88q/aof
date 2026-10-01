import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../lib/api";
import { useWalletStore } from "../store/walletStore";
import { useFlash } from "../lib/marketUtils";
import { handleTxResponse } from "../lib/txFlow";
import { UI_ICONS } from "../lib/visualAssets";
import { actionErrorFeedback, LocalTxFeedbackError } from "../lib/txResponseFeedback";
import { useLocale } from "../i18n/LocaleProvider";
import { drumCopy } from "../i18n/drumCopy";
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
  const { language } = useLocale();
  const copy = drumCopy[language];
  const format = (value: number) => value.toLocaleString(language);
  const { address } = useWalletStore();
  const [status, flash] = useFlash(language);
  const flashRef = useRef(flash);
  flashRef.current = flash;
  const [busy, setBusy] = useState(false);
  const [spin, setSpin] = useState<Spin | null>(null);
  const [now, setNow] = useState(Date.now());
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollGeneration = useRef(0);
  const walletRef = useRef(address);
  walletRef.current = address;
  const languageRef = useRef(language);
  languageRef.current = language;
  const explain = (error: unknown) => {
    const currentLanguage = languageRef.current;
    // A reply to an action begun in another locale must not resurrect its old
    // localized message; the outcome stays uncertain in the active language.
    return currentLanguage === language
      ? actionErrorFeedback(error, currentLanguage, drumCopy[currentLanguage].uncertain)
      : drumCopy[currentLanguage].uncertain;
  };

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // A spin left pending by a previous visit (closed tab, lost connection).
  // Stop old-wallet polling; a late response must never appear as this wallet's prize.
  useEffect(() => {
    let active = true;
    setSpin(null);
    ++pollGeneration.current;
    if (poll.current) clearInterval(poll.current);
    if (address) api.drum.status(address)
      .then((s: any) => { if (active && s?.state === "pending") watch(Date.now() - SELF_SETTLE_AFTER_MS); })
      .catch(() => undefined);
    return () => { active = false; ++pollGeneration.current; if (poll.current) clearInterval(poll.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  function watch(startedAt = Date.now()) {
    if (!address) return;
    if (poll.current) clearInterval(poll.current);
    const generation = ++pollGeneration.current;
    setSpin({ state: "pending", startedAt });
    poll.current = setInterval(async () => {
      try {
        const s: any = await api.drum.status(address);
        if (walletRef.current !== address || pollGeneration.current !== generation) return;
        const currentLanguage = languageRef.current;
        const currentCopy = drumCopy[currentLanguage];
        if (s?.state === "settled" && Number.isFinite(s.prize) && s.prize >= 0 && typeof s.signature === 'string') {
          if (poll.current) clearInterval(poll.current);
          setSpin({ state: "settled", prize: s.prize, signature: s.signature });
          flashRef.current(currentCopy.revealed(s.prize.toLocaleString(currentLanguage)), 8000);
        } else if (s?.state === "refunded" && Number.isFinite(s.amount) && s.amount >= 0) {
          if (poll.current) clearInterval(poll.current);
          setSpin({ state: "refunded", amount: s.amount });
          flashRef.current(currentCopy.refunded(s.amount.toLocaleString(currentLanguage)), 8000);
        }
      } catch {
        /* keep polling: the RPC may lag the confirmation */
      }
    }, POLL_MS);
  }

  async function selfSettle() {
    if (!address) return;
    setBusy(true);
    try {
      const resp: any = await api.drum.reveal({ user: address });
      if (walletRef.current !== address) return;
      const r = await handleTxResponse(resp);
      if (walletRef.current !== address) return;
      if (!r.success) throw new LocalTxFeedbackError(r.error || copy.uncertain);
      flashRef.current(resp.phase === "refundable" ? drumCopy[languageRef.current].refundSent : drumCopy[languageRef.current].selfRevealed, 6000);
      watch(spin?.state === "pending" ? spin.startedAt : Date.now());
    } catch (e: any) {
      flashRef.current(explain(e), 8000);
    } finally {
      setBusy(false);
    }
  }

  const pending = spin?.state === "pending";
  const canSelfSettle = pending && now - spin.startedAt >= SELF_SETTLE_AFTER_MS;
  // Historical commit events contain raw atomic amounts; mint/decimals are not verified.
  const rewardIcon = UI_ICONS.rewardStar;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3 bg-soil-800 p-4 rounded-xl border border-straw/10">
        <div>
          <h3 className="text-parchment font-semibold flex items-center gap-2">
            <img src={UI_ICONS.drum} alt="" className="w-5 h-5 object-contain" />
            {copy.title}
          </h3>
          <p className="text-straw text-xs">{copy.unavailable}</p>
        </div>

      </div>

      {status && <div className="text-center text-straw text-sm"><NoticeMsg text={status} /></div>}

      <div className="relative flex flex-col items-center justify-center py-8 bg-gradient-to-b from-soil-800 to-soil-900 rounded-2xl border-2 border-accent-600/30">
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
                <div className="text-parchment font-bold text-sm">+{format(spin.prize)} {copy.rawUnits}</div>
              </motion.div>
            ) : spin?.state === "refunded" ? (
              <div className="text-center text-parchment text-sm font-bold inline-flex items-center gap-1.5">
                <img src={UI_ICONS.noticeSuccess} alt="" className="w-4 h-4 object-contain" />
                {format(spin.amount)} {copy.rawUnits}
              </div>
            ) : (
              <ResourceGlyph icon={UI_ICONS.rewardDaily} alt="" className="w-16 h-16" />
            )}
          </div>
        </motion.div>

        <button disabled className="mt-8 max-w-full whitespace-normal text-center px-8 py-3 rounded-2xl bg-soil-700 text-straw font-bold text-lg opacity-60 cursor-not-allowed">
          {copy.unavailable}
        </button>

        {canSelfSettle && (
          <button
            onClick={selfSettle}
            disabled={busy}
            className="mt-3 max-w-full whitespace-normal text-center px-4 py-2 rounded-xl border border-straw/30 text-parchment text-sm disabled:opacity-50"
          >
            {copy.reveal}
          </button>
        )}
      </div>

      <p className="text-center text-straw text-xs">
        {copy.oracle}
      </p>
    </div>
  );
}
