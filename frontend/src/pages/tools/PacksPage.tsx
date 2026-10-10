import { useLocale } from "../../i18n/LocaleProvider";
import { packsCopy } from "../../i18n/packsCopy";
import { toolsCopy, toolName } from "../../i18n/toolsCopy";
import { TOOL_RARITIES } from "../../lib/visualAssets";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../../lib/api";
import { handleTxResponse } from "../../lib/txFlow";
import { useWalletStore } from "../../store/walletStore";
import { Card } from "../../components/ui/Card";
import { RARITY_META, rarityKey } from "../../lib/toolMeta";
import { UI_ICONS, toolPlate } from "../../lib/visualAssets";
import { ArtPlate } from "../../components/visual/ArtPlate";
import { PackPlate } from "../../components/visual/PackPlate";
import { PackReveal } from "../../components/visual/PackReveal";
import { useFlash } from "../../lib/marketUtils";
import type { PackOpenIntent } from "../../lib/transactionIntent";
import { actionErrorFeedback, LocalTxFeedbackError } from "../../lib/txResponseFeedback";
import { walletRuntimeCopy } from "../../i18n/walletRuntimeCopy";
import { NoticeMsg } from "../../components/visual/NoticeMsg";

/**
 * [F-06] Capsule openings settled by Switchboard On-Demand.
 *
 * 1. commit  — one wallet signature: the price is escrowed on-chain, the odds
 *    are snapshotted and a Switchboard randomness account owned by the game
 *    program is committed in the same transaction (the operator co-signs as
 *    the backend gate; the wallet guard checks type and price ceiling).
 * 2. settle  — the settler service reveals within seconds. If it does not,
 *    the player can settle it personally ("Раскрыть самостоятельно"): the
 *    reveal is permissionless and the oracle signature is verified on-chain.
 * 3. refund  — if the oracle never answers inside the ~2 h window, the same
 *    button returns the price (settlement and refund are never both open).
 */
const PACKS = [
  { id: "small", index: 0 },
  { id: "medium", index: 1 },
  { id: "big", index: 2 },
] as const;
const SELF_SETTLE_AFTER_MS = 25_000;

type PackConfig = { packType: string; priceLamports: string; oddsBps: number[] };
type Opening = { packCommit: string; startedAt: number; state: "pending" | "settled" | "refunded"; tool?: { toolType: string; rarity: string } };
type Pending = { mechanic: string; commit: string; phase: "waiting" | "revealable" | "refundable"; ageSlots: number };

export function PacksPage() {
  const { language } = useLocale();
  const copy = packsCopy[language];
  const rarities = toolsCopy[language].collectionPage.rarities;
  const { address } = useWalletStore();
  const [configs, setConfigs] = useState<Record<string, PackConfig> | null>(null);
  const [configFailed, setConfigFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [opening, setOpening] = useState<Opening | null>(null);
  const [showReveal, setShowReveal] = useState(false);
  // Размер последней открытой капсулы: витрина должна показывать ту капсулу,
  // которую игрок действительно открыл, а не условную иконку.
  const [lastPack, setLastPack] = useState<"small" | "medium" | "big" | null>(null);
  const [pending, setPending] = useState<Pending[] | null>(null);
  const [pendingAddress, setPendingAddress] = useState<string | null>(null);
  const [pendingFailed, setPendingFailed] = useState(false);
  const pendingRequestId = useRef(0);
  const pollGeneration = useRef(0);
  const [now, setNow] = useState(Date.now());
  const [txStatus, flash] = useFlash(language);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);
  const walletRef = useRef(address);
  walletRef.current = address;

  useEffect(() => {
    let cancelled = false;
    api.packs.configs()
      .then((r: any) => {
        if (!Array.isArray(r?.packs)) throw new Error("Unexpected pack configuration");
        // Config contains five odds; Legendary (index 4) is zero by contract.
        // Never quote a NaN price or invented odds for a malformed response.
        if (!r.packs.every((p: PackConfig) =>
          ["small", "medium", "big"].includes(p.packType) &&
          typeof p.priceLamports === "string" && /^[1-9]\d*$/.test(p.priceLamports) &&
          Number.isSafeInteger(Number(p.priceLamports)) &&
          Array.isArray(p.oddsBps) && p.oddsBps.length === 5 &&
          p.oddsBps.every((bps: number) => Number.isInteger(bps) && bps >= 0 && bps <= 10_000) &&
          p.oddsBps.reduce((sum: number, bps: number) => sum + bps, 0) === 10_000 &&
          p.oddsBps[4] === 0)) throw new Error("Invalid pack configuration");
        if (!cancelled) { setConfigs(Object.fromEntries(r.packs.map((p: PackConfig) => [p.packType, p]))); setConfigFailed(false); }
      })
      .catch(() => { if (!cancelled) { setConfigs(null); setConfigFailed(true); } });
    return () => { cancelled = true; };
  }, []);

  const loadPending = useCallback(() => {
    const request = ++pendingRequestId.current;
    if (!address) { setPending([]); setPendingAddress(null); setPendingFailed(false); return; }
    setPending(null);
    setPendingFailed(false);
    api.vrf.pending(address)
      .then((r: any) => {
        if (!Array.isArray(r?.pending)) throw new Error("Unexpected pending openings");
        const openings = r.pending.filter((p: Pending) => p.mechanic === "pack");
        if (!openings.every((p: Pending) => typeof p.commit === "string" && p.commit.length > 0 &&
          (p.phase === "waiting" || p.phase === "revealable" || p.phase === "refundable") &&
          Number.isFinite(p.ageSlots))) throw new Error("Invalid pending opening");
        if (request === pendingRequestId.current) {
          setPending(openings);
          setPendingAddress(address);
        }
      })
      .catch(() => {
        if (request === pendingRequestId.current) { setPending(null); setPendingAddress(address); setPendingFailed(true); }
      });
  }, [address]);

  useEffect(() => {
    loadPending();
    return () => { pendingRequestId.current++; };
  }, [loadPending]);
  useEffect(() => {
    ++pollGeneration.current;
    if (poll.current) { clearInterval(poll.current); poll.current = null; }
    setOpening(null);
    setLastPack(null);
  }, [address]);
  const visiblePending = address && pendingAddress === address ? pending : null;
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(t); ++pollGeneration.current; if (poll.current) clearInterval(poll.current); };
  }, []);

  function watch(packCommit: string) {
    const generation = ++pollGeneration.current;
    if (poll.current) clearInterval(poll.current);
    const startedAt = Date.now();
    setOpening({ packCommit, startedAt, state: "pending" });
    poll.current = setInterval(async () => {
      try {
        const s: any = await api.packs.status(packCommit);
        if (generation !== pollGeneration.current) return;
        if (s?.state === "settled" || s?.state === "refunded") {
          if (poll.current) clearInterval(poll.current);
          setOpening({ packCommit, startedAt, state: s.state, tool: s.tool });
          loadPending();
        }
      } catch {
        /* keep polling: the RPC may lag the confirmation */
      }
    }, 2_000);
  }

  async function open(pack: (typeof PACKS)[number]) {
    if (!address) return flash(`❌ ${copy.connect}`);
    const cfg = configs?.[pack.id];
    if (!cfg) return flash(`❌ ${configFailed ? copy.configError : configs === null ? copy.configLoading : copy.unconfigured}`);
    setBusy(pack.id);
    try {
      flash(copy.preparing, 8000);
      const intent: PackOpenIntent = { kind: "packOpen", user: address, packType: pack.index, maxPriceLamports: cfg.priceLamports };
      const resp: any = await api.packs.commit({ user: address, packType: pack.id, maxPriceLamports: cfg.priceLamports });
      const r = await handleTxResponse(resp, intent);
      if (walletRef.current !== address) return;
      if (!r.success) throw new LocalTxFeedbackError(r.error || walletRuntimeCopy[language].unconfirmedResponse);
      if (typeof resp.packCommit !== "string" || !resp.packCommit) {
        flash(copy.commitUnknown, 8000);
        loadPending();
      } else {
        flash(`✅ ${copy.paid}`, 8000);
        watch(resp.packCommit);
      }
    } catch (e: any) {
      if (walletRef.current === address) {
        flash(actionErrorFeedback(e, language, walletRuntimeCopy[language].unconfirmedResponse), 8000);
      }
    } finally {
      setBusy(null);
    }
  }

  async function selfSettle(packCommit: string) {
    if (!address) return flash(`❌ ${copy.connect}`);
    setBusy(packCommit);
    try {
      const resp: any = await api.packs.reveal({ user: address, packCommit });
      const r = await handleTxResponse(resp);
      if (walletRef.current !== address) return;
      if (!r.success) throw new LocalTxFeedbackError(r.error || walletRuntimeCopy[language].unconfirmedResponse);
      flash(resp.phase === "refundable" ? copy.refundSent : copy.revealed, 6000);
      watch(packCommit);
    } catch (e: any) {
      if (walletRef.current === address) {
        flash(actionErrorFeedback(e, language, walletRuntimeCopy[language].unconfirmedResponse), 8000);
      }
    } finally {
      setBusy(null);
    }
  }

  const waitingMs = opening?.state === "pending" ? now - opening.startedAt : 0;
  const openingKey = opening ? `${opening.state}:${opening.packCommit}` : "";
  useEffect(() => {
    if (openingKey) setShowReveal(true);
  }, [openingKey]);
  const formatPercent = (bps: number) => (bps / 100).toLocaleString(language, { maximumFractionDigits: 2 });

  return (
    <div lang={language} className="p-4 pt-6 pb-24 space-y-4 min-w-0">
      <h1 className="text-2xl font-bold text-parchment flex items-center gap-2">
        <img src={UI_ICONS.packs} alt="" className="w-7 h-7 object-contain" /> {copy.title}
      </h1>
      <p className="text-straw text-xs">
        {copy.intro}
      </p>

      {txStatus && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="text-xs px-3 py-2 rounded-xl bg-soil-800 border border-straw/20 text-parchment">
          <NoticeMsg text={txStatus} />
        </motion.div>
      )}

      <PackReveal
        open={!!opening && showReveal}
        caption={opening?.state === "pending" ? `${copy.waiting} ${Math.floor(waitingMs / 1000)} ${copy.seconds}` : opening?.state === "settled" && opening.tool ? toolName(language, opening.tool.toolType) : opening?.state === "refunded" ? copy.refunded : opening?.state === "settled" ? copy.settledUnknown : ""}
      >
        {opening?.state === "pending" && waitingMs > SELF_SETTLE_AFTER_MS && (
          <button type="button" onClick={() => selfSettle(opening.packCommit)} disabled={busy === opening.packCommit}
            className="pack-reveal__action">
            {copy.revealSelf}
          </button>
        )}
        <button type="button" onClick={() => setShowReveal(false)} className="pack-reveal__hide">{copy.hideReveal}</button>
      </PackReveal>
      {opening && (
        <Card className="text-center py-5">
          {opening.state === "pending" && (
            <>
              {/* Витрина размера, пока оракул считает: раньше здесь дрожала
                  одна и та же иконка, и по картинке нельзя было понять,
                  какую капсулу открываешь. */}
              {lastPack && (
                <motion.div className="w-20 mx-auto"
                  animate={{ rotate: [0, -4, 4, 0] }} transition={{ repeat: Infinity, duration: 1.6 }}>
                  <PackPlate packId={lastPack} size="100%" alt="" />
                </motion.div>
              )}
              <p className="text-parchment font-semibold mt-3">{copy.waiting} {Math.floor(waitingMs / 1000)} {copy.seconds}</p>
              {waitingMs > SELF_SETTLE_AFTER_MS && (
                <button onClick={() => selfSettle(opening.packCommit)} disabled={busy === opening.packCommit}
                  className="mt-3 px-4 py-2 rounded-xl bg-accent-600 text-white text-sm font-semibold disabled:opacity-50">
                  {copy.revealSelf}
                </button>
              )}
            </>
          )}
          {opening.state === "settled" && opening.tool && (
            <>
              {/* Картина ставится на плитку того же цвета, что её фон, — иначе
                  вокруг арта видна рамка другого оттенка. */}
              <div className="w-24 mx-auto">
                <ArtPlate src={toolPlate(opening.tool.toolType, rarityKey(opening.tool.rarity)) || UI_ICONS.packs} alt="" size="100%" />
              </div>
              <p className="font-bold mt-3" style={{ color: RARITY_META[rarityKey(opening.tool.rarity)]?.color }}>
                {rarities[TOOL_RARITIES.indexOf(rarityKey(opening.tool.rarity) as typeof TOOL_RARITIES[number])] || toolsCopy[language].card.unknownRarity}
              </p>
              <p className="text-parchment text-sm">{toolName(language, opening.tool.toolType)}</p>
            </>
          )}
          {opening.state === "settled" && !opening.tool && <p className="text-parchment text-sm">{copy.settledUnknown}</p>}
          {opening.state === "refunded" && (
            <>
              {/* Возврат: капсула показана раскрытой и пустой — честная
                  картинка вместо прежней строки текста без визуала. */}
              {lastPack && <div className="w-20 mx-auto"><PackPlate packId={lastPack} state="opened" size="100%" alt="" /></div>}
              <p className="text-parchment text-sm mt-3">{copy.refunded}</p>
            </>
          )}
        </Card>
      )}

      <div className="grid gap-3">
        {PACKS.map((pack) => {
          const cfg = configs?.[pack.id];
          return (
            <Card key={pack.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  {/* Витрина размера: до 2026-09-30 карточек капсул не было —
                      только строка цены и кнопка, без картинки и описания. */}
                  <span className="shrink-0">
                    <PackPlate packId={pack.id} size={72} alt={copy.illustration} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-parchment font-bold">{copy[pack.id]}</p>
                    <p className="text-straw text-[11px] leading-relaxed mt-1">{copy.about[pack.id]}</p>
                    <p className="text-straw text-xs mt-1">{cfg ? `${(Number(cfg.priceLamports) / 1e9).toLocaleString(language, { maximumFractionDigits: 4 })} ◎` : configFailed ? copy.configError : configs === null ? copy.configLoading : copy.unconfigured}</p>
                  </div>
                </div>
                <button onClick={() => { setLastPack(pack.id); open(pack); }} disabled={!cfg || !address || busy !== null}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-nf-purple to-accent-600 text-white text-sm font-bold disabled:opacity-40">
                  {busy === pack.id ? "…" : copy.open}
                </button>
              </div>
              {cfg && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 mt-3 text-center text-[11px] min-w-0">
                  {cfg.oddsBps.slice(0, 4).map((bps, i) => (
                    <div key={i} className="rounded-lg bg-soil-800/60 py-1">
                      <p className="text-straw">{rarities[i]}</p>
                      <p className="text-parchment font-semibold">{formatPercent(bps)}%</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {address && pendingAddress === address && pendingFailed && (
        <Card><p role="status" className="text-straw text-xs">{copy.pendingError}</p></Card>
      )}
      {address && (pendingAddress !== address || pending === null && !pendingFailed) && !pendingFailed && (
        <Card><p role="status" className="text-straw text-xs">{copy.pendingLoading}</p></Card>
      )}
      {visiblePending !== null && visiblePending.length > 0 && (
        <Card>
          <p className="text-parchment font-semibold text-sm mb-2">{copy.pendingTitle}</p>
          {visiblePending.map((p) => (
            <div key={p.commit} className="flex flex-wrap items-center justify-between gap-2 text-xs py-1 min-w-0">
              <span className="text-straw">{p.commit.slice(0, 8)}… · {p.phase === "refundable" ? copy.refundable : p.phase === "waiting" ? copy.seedPending : `${p.ageSlots} ${copy.waitingSlots}`}</span>
              <button onClick={() => selfSettle(p.commit)} disabled={busy === p.commit || p.phase === "waiting"}
                className="px-3 py-1 rounded-lg bg-soil-800 border border-straw/20 text-parchment disabled:opacity-40">
                {p.phase === "refundable" ? copy.refund : copy.reveal}
              </button>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
