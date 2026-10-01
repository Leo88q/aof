import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../../lib/api';
import { handleTxResponse } from '../../lib/txFlow';
import type { SeasonPassInitIntent } from '../../lib/transactionIntent';
import { useVipStatus } from '../../lib/useVipStatus';
import { readActiveSeason } from '../../lib/currentSeasonReadings';
import { chooseVipTheme, readVipTheme, type VipTheme } from '../../lib/vipTheme';
import { useLocale } from '../../i18n/LocaleProvider';
import { seasonPassCopy } from '../../i18n/seasonPassCopy';
import { Card } from '../../components/ui/Card';
import { UI_ICONS } from '../../lib/visualAssets';
import { useTreasury, useFlash } from '../../lib/marketUtils';
import { fetchSeasonPassQuote, lamportsToSol, type SeasonPassQuote } from '../../lib/seasonPassQuote';
import { NoticeMsg } from '../../components/visual/NoticeMsg';

// No paid offer before both reward tracks and enforceable VIP benefits pass devnet.
const PAID_PASS_READY = false;
// The on-chain instruction charges 150_000_000 lamports (0.15 SOL).
const PASS_PRICE_LAMPORTS = '150000000' as const;

export function SeasonPassPage() {
  const { language } = useLocale();
  const c = seasonPassCopy[language];
  const treasury = useTreasury();
  const { user, reading, seasonId, refresh } = useVipStatus();
  const snapshot = reading?.kind === 'ready' ? reading.snapshot : null;
  const [txStatus, flash] = useFlash(language);
  const [busy, setBusy] = useState(false);
  // Once a transaction has been sent, don't invite a second payment even if
  // confirmation timed out or the RPC still shows an older pass state.
  const [paymentBlockedFor, setPaymentBlockedFor] = useState<string | null>(null);
  const pendingKey = user && seasonId !== null ? `${user}:${seasonId}` : null;
  const paymentBlocked = pendingKey !== null && paymentBlockedFor === pendingKey;
  const [theme, setTheme] = useState<VipTheme>('copper');
  // Live-котировка сетевых расходов: пропуск стоит 0 игровых токенов, но rent
  // аккаунта и комиссию сети платит игрок — цифры показываем до подписи.
  const [quote, setQuote] = useState<SeasonPassQuote | null>(null);
  const [quoteFailed, setQuoteFailed] = useState(false);
  useEffect(() => {
    setTheme(readVipTheme(user, seasonId ?? -1, snapshot?.isVip === true) ?? 'copper');
  }, [user, seasonId, snapshot?.isVip]);
  const canBuy = Boolean(PAID_PASS_READY && seasonId !== null && user && treasury && snapshot?.seasonActive && !snapshot.passPremium &&
    !busy && !paymentBlocked);

  async function buy() {
    if (!canBuy || !user || !treasury || seasonId === null) return;
    setBusy(true);
    try {
      // Recheck immediately before requesting a payment transaction.
      const current = readActiveSeason(await api.season.current());
      if (!current || current.seasonId !== seasonId) { flash(c.unavailable); refresh(); return; }
      const verified = (await import('../../lib/vipReadings')).readVipSnapshot(
        await api.season.vipStatus(user, seasonId), user, seasonId);
      if (!verified || !verified.seasonActive || verified.passPremium || user !== reading?.owner ||
          reading.seasonId !== seasonId) {
        flash(c.unavailable);
        refresh();
        return;
      }
      flash(c.preparing);
      const resp = await api.season.passPurchase({ user, seasonId, treasury });
      // Verify the only wallet-signed instruction, its destination and season PDA.
      const result = await handleTxResponse(resp, {
        kind: 'seasonPass', user, treasury, seasonId, priceLamports: PASS_PRICE_LAMPORTS,
      });
      if (result.success || result.signature) {
        setPaymentBlockedFor(`${user}:${seasonId}`);
        flash(result.success ? c.submitted : c.pending);
        refresh();
      } else flash(c.failed);
    } catch {
      flash(c.failed);
    } finally {
      setBusy(false);
    }
  }

  // Пропуска ещё нет — игрок создаёт его сам, своей транзакцией и за свой rent.
  // Оператор не платит за аккаунт игрока; «бесплатно» здесь означает только
  // нулевую цену пропуска в игровых токенах, сетевые расходы несёт игрок.
  const canInitPass = Boolean(seasonId !== null && user && reading?.owner === user &&
    snapshot?.seasonActive && !snapshot.pass && !busy);
  const showInitPass = Boolean(snapshot?.seasonActive && !snapshot.pass && user && reading?.owner === user);

  useEffect(() => {
    if (!showInitPass) { setQuote(null); setQuoteFailed(false); return; }
    let alive = true;
    setQuoteFailed(false);
    fetchSeasonPassQuote()
      .then((q) => { if (alive) setQuote(q); })
      .catch(() => { if (alive) { setQuote(null); setQuoteFailed(true); } });
    return () => { alive = false; };
  }, [showInitPass]);

  async function initPass() {
    if (!canInitPass || !user || seasonId === null) return;
    setBusy(true);
    try {
      flash(c.preparing);
      const resp = await api.season.passInit({ player: user, seasonId });
      const intent: SeasonPassInitIntent = { kind: 'seasonPassInit', user, seasonId };
      const result = await handleTxResponse(resp, intent);
      flash(result.success ? c.submitted : result.signature ? c.pending : c.failed);
      refresh();
    } catch {
      flash(c.failed);
    } finally {
      setBusy(false);
    }
  }

  const status = !user ? c.connect : !reading || reading.kind === 'loading' ? c.verifying
    : reading.kind === 'error' || !snapshot ? c.unavailable
    : snapshot.isVip ? c.active : snapshot.passPremium ? c.expired
    : !snapshot.seasonActive ? c.notActive : c.notOwned;
  return (
    <div className="p-4 pt-2 pb-24 space-y-4 min-w-0 [overflow-wrap:anywhere]">
      <p className="text-straw text-xs">{c.intro}</p>
      {txStatus && <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
        className="text-xs px-3 py-2 rounded-xl bg-soil-800 border border-straw/20 text-parchment">
        <NoticeMsg text={txStatus} />
      </motion.div>}
      <Card className="bg-gradient-to-r from-wheat-600/20 to-soil-850 border border-wheat-600/30">
        <div className="flex items-center gap-3 min-w-0">
          <img src={UI_ICONS.seasonPass} alt="" className="w-12 h-12 object-contain shrink-0" />
          <div className="flex-1 min-w-0">
            <h2 className="text-parchment font-bold text-lg">{c.title} · {c.season} {seasonId ?? "—"}</h2>
            <p className="text-straw text-xs" role="status">{status}</p>
          </div>
          {snapshot?.isVip && <span className="text-xs px-3 py-1 rounded-full bg-gold text-soil-950 font-bold shrink-0">VIP</span>}
        </div>
      </Card>
      <p className="text-straw text-xs" role="note">{c.unverified}</p>
      {snapshot?.isVip && user && reading?.owner === user && <Card>
        <h3 className="text-parchment font-semibold text-sm mb-2">{c.themeTitle}</h3>
        <p className="text-straw text-xs mb-3">{c.themeNote}</p>
        <div className="flex gap-2" role="group" aria-label={c.themeTitle}>
          {(['copper', 'orchid'] as const).map(option =>
            <button type="button" key={option} aria-pressed={theme === option}
              className="px-3 py-2 rounded-xl border border-straw/30 text-parchment text-sm aria-pressed:border-gold flex items-center gap-2"
              onClick={() => {
                if (chooseVipTheme(user, seasonId ?? -1, snapshot.isVip, option)) setTheme(option);
              }}><img src={option === 'copper' ? UI_ICONS.vipCopper : UI_ICONS.vipOrchid}
                alt="" className="w-9 h-9 rounded-md object-cover" />{c[option]}</button>)}
        </div>
      </Card>}
      {snapshot?.pass && <Card>
        <h3 className="text-parchment font-semibold text-sm mb-2">{c.progress}</h3>
        <div className="grid grid-cols-2 gap-2">
          {[[c.season, seasonId ?? "—"], [c.xp, snapshot.pass.xp], [c.claimed, snapshot.pass.claimedRewards],
            [c.track, snapshot.passPremium ? c.paid : c.free]].map(([label, value]) =>
            <div key={label} className="px-3 py-2 rounded-xl bg-soil-800/70 border border-straw/10 min-w-0">
              <p className="text-straw text-xs">{label}</p><p className="text-parchment text-sm font-medium">{value}</p>
            </div>)}
        </div>
      </Card>}
      {snapshot?.seasonActive && !snapshot.pass && user && reading?.owner === user && <>
        <p className="text-straw text-xs" role="note">{c.initPassNote}</p>
        {quote && <div className="text-straw text-xs space-y-1" role="note" aria-label={c.quoteTitle}>
          <p>{c.quoteTitle}</p>
          <p>{c.quoteRent(lamportsToSol(quote.rentLamports), String(quote.rentLamports))}</p>
          <p>{c.quoteFee(lamportsToSol(quote.baseFeeLamports), String(quote.baseFeeLamports),
            quote.priorityMicroLamports === null ? '—' : String(quote.priorityMicroLamports))}</p>
        </div>}
        {quoteFailed && <p className="text-straw text-xs" role="note">{c.quoteUnavailable}</p>}
        <button type="button" onClick={initPass} disabled={!canInitPass}
          className="w-full py-3.5 px-3 rounded-2xl bg-soil-800 border border-gold/40 text-parchment font-bold text-sm disabled:opacity-40 [overflow-wrap:anywhere]">
          {c.initPass}
        </button>
      </>}
      {snapshot?.seasonActive && !snapshot.passPremium && !paymentBlocked && <>
        {!treasury && <p className="text-straw text-xs" role="status">{c.missingTreasury}</p>}
        <button type="button" onClick={buy} disabled={!canBuy}
          className="w-full py-3.5 px-3 rounded-2xl bg-gold text-soil-950 font-bold text-sm disabled:opacity-40 [overflow-wrap:anywhere]">
          {c.purchase}
        </button>
      </>}
      {snapshot?.seasonActive && !snapshot.passPremium && paymentBlocked &&
        <p className="text-center text-straw text-xs" role="status">{c.pending}</p>}
    </div>
  );
}
