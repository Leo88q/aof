import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../../lib/api';
import { handleTxResponse } from '../../lib/txFlow';
import type { PayerCostQuote, SeasonPassInitIntent, SeasonXpClaimIntent } from '../../lib/transactionIntent';
import { formatLamportsAsSol } from '../../lib/formatLamports';
import { useVipStatus } from '../../lib/useVipStatus';
import { readActiveSeason } from '../../lib/currentSeasonReadings';
import { chooseVipTheme, readVipTheme, type VipTheme } from '../../lib/vipTheme';
import { useLocale } from '../../i18n/LocaleProvider';
import { seasonPassCopy } from '../../i18n/seasonPassCopy';
import { Card } from '../../components/ui/Card';
import { UI_ICONS } from '../../lib/visualAssets';
import { useTreasury, useFlash } from '../../lib/marketUtils';
import { NoticeMsg } from '../../components/visual/NoticeMsg';

// No paid offer before both reward tracks and enforceable VIP benefits pass devnet.
const PAID_PASS_READY = false;
// The on-chain instruction charges 150_000_000 lamports (0.15 SOL).
const PASS_PRICE_LAMPORTS = '150000000' as const;
type PreparedSeasonPassInit = { user: string; seasonId: number; response: { tx: string; quote: PayerCostQuote } };
type PendingXpClaim = {
  id: string; player: string; seasonId: number; amount: number; campaignId: string;
  nonce: number; expirySlot: string; canClaim: boolean;
};
type PreparedXpClaim = { user: string; seasonId: number; claim: PendingXpClaim; response: any };

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
  const [passInitBlockedFor, setPassInitBlockedFor] = useState<string | null>(null);
  const pendingKey = user && seasonId !== null ? `${user}:${seasonId}` : null;
  const paymentBlocked = pendingKey !== null && paymentBlockedFor === pendingKey;
  const passInitBlocked = pendingKey !== null && passInitBlockedFor === pendingKey;
  const [theme, setTheme] = useState<VipTheme>('copper');
  const [preparedPassInit, setPreparedPassInit] = useState<PreparedSeasonPassInit | null>(null);
  const [passInitStatus, setPassInitStatus] = useState<'idle' | 'preparing' | 'prepared' | 'failed' | 'pending' | 'success'>('idle');
  const [xpClaims, setXpClaims] = useState<PendingXpClaim[]>([]);
  const [xpClaimsLoading, setXpClaimsLoading] = useState(false);
  const [xpClaimsFailed, setXpClaimsFailed] = useState(false);
  const [preparedXpClaim, setPreparedXpClaim] = useState<PreparedXpClaim | null>(null);
  const [xpClaimStatus, setXpClaimStatus] = useState<string | null>(null);
  const [xpClaimBlockedFor, setXpClaimBlockedFor] = useState<string | null>(null);
  const currentUser = useRef(user);
  currentUser.current = user;
  const currentSeasonId = useRef(seasonId);
  currentSeasonId.current = seasonId;
  useEffect(() => {
    let current = true;
    setXpClaims([]);
    setPreparedXpClaim(null);
    setXpClaimStatus(null);
    setXpClaimBlockedFor(null);
    setXpClaimsFailed(false);
    if (!user || seasonId === null || reading?.owner !== user) {
      setXpClaimsLoading(false);
      return () => { current = false; };
    }
    setXpClaimsLoading(true);
    api.season.xpClaims(user, seasonId).then((result) => {
      if (!current) return;
      setXpClaims(Array.isArray(result?.claims) ? result.claims as PendingXpClaim[] : []);
    }).catch(() => {
      if (current) setXpClaimsFailed(true);
    }).finally(() => {
      if (current) setXpClaimsLoading(false);
    });
    return () => { current = false; };
  }, [user, seasonId, reading?.owner]);
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

  // An absent pass gets a transaction-bound quote first; confirmation and the
  // wallet transaction signature are a separate user action.
  const canInitPass = Boolean(seasonId !== null && user && reading?.owner === user &&
    snapshot?.seasonActive && !snapshot.pass && !busy && !passInitBlocked);
  const showInitPass = Boolean(snapshot?.seasonActive && !snapshot.pass && user && reading?.owner === user);
  const quote = preparedPassInit?.user === user && preparedPassInit.seasonId === seasonId
    ? preparedPassInit.response.quote : null;

  useEffect(() => {
    setPreparedPassInit(null);
    setPassInitStatus('idle');
  }, [user, seasonId, Boolean(snapshot?.pass)]);

  async function prepareInitPass() {
    if (!canInitPass || !user || seasonId === null) return;
    const owner = user;
    const activeSeasonId = seasonId;
    setBusy(true);
    setPreparedPassInit(null);
    setPassInitStatus('preparing');
    try {
      // Recheck immediately before quoting; the backend then binds the exact init message.
      const current = readActiveSeason(await api.season.current());
      if (!current || current.seasonId !== activeSeasonId) { flash(c.unavailable); refresh(); return; }
      const verified = (await import('../../lib/vipReadings')).readVipSnapshot(
        await api.season.vipStatus(owner, activeSeasonId), owner, activeSeasonId);
      if (!verified || !verified.seasonActive || verified.pass || owner !== reading?.owner ||
          reading.seasonId !== activeSeasonId) {
        flash(c.unavailable);
        refresh();
        return;
      }
      const response = await api.season.passInit({ player: owner, seasonId: activeSeasonId });
      if (currentUser.current !== owner || currentSeasonId.current !== activeSeasonId) return;
      if (typeof response?.tx !== 'string' || !response.tx || !response.quote) throw new Error('Missing payer quote');
      setPreparedPassInit({ user: owner, seasonId: activeSeasonId, response });
      setPassInitStatus('prepared');
    } catch {
      if (currentUser.current === owner && currentSeasonId.current === activeSeasonId) {
        setPassInitStatus('failed');
        flash(c.quoteUnavailable);
      }
    } finally {
      setBusy(false);
    }
  }

  async function confirmInitPass() {
    if (!canInitPass || !user || seasonId === null || !quote || !preparedPassInit) return;
    const owner = user;
    const activeSeasonId = seasonId;
    const response = preparedPassInit.response;
    setBusy(true);
    const intent: SeasonPassInitIntent = { kind: 'seasonPassInit', user: owner, seasonId: activeSeasonId, quote };
    try {
      const result = await handleTxResponse(response, intent);
      if (currentUser.current !== owner || currentSeasonId.current !== activeSeasonId) return;
      if (result.success || result.signature) {
        setPassInitBlockedFor(`${owner}:${activeSeasonId}`);
        setPreparedPassInit(null);
        setPassInitStatus(result.success ? 'success' : 'pending');
        flash(result.success ? c.submitted : c.pending);
        refresh();
      } else {
        setPassInitStatus('failed');
        flash(c.failed);
      }
    } finally {
      setBusy(false);
    }
  }

  async function prepareXpClaim(claim: PendingXpClaim) {
    if (!user || seasonId === null || reading?.owner !== user || !claim.canClaim ||
        claim.player !== user || claim.seasonId !== seasonId || busy) return;
    const owner = user;
    const activeSeasonId = seasonId;
    setBusy(true);
    setPreparedXpClaim(null);
    setXpClaimStatus(c.preparing);
    try {
      const response = await api.season.xpClaimTransaction(owner, claim.id);
      if (currentUser.current !== owner || currentSeasonId.current !== activeSeasonId) return;
      const entitlement = response?.entitlement;
      if (typeof response?.tx !== 'string' || !response.tx || !response.quote ||
          entitlement?.id !== claim.id || entitlement?.player !== owner ||
          entitlement?.seasonId !== activeSeasonId || entitlement?.amount !== claim.amount ||
          entitlement?.campaignId !== claim.campaignId || entitlement?.nonce !== claim.nonce ||
          String(entitlement?.expirySlot) !== claim.expirySlot ||
          typeof entitlement?.authority !== 'string' || typeof entitlement?.programId !== 'string' ||
          typeof entitlement?.clusterGenesisHash !== 'string' || typeof entitlement?.campaignDigest !== 'string' ||
          typeof entitlement?.genesisHashDigest !== 'string') {
        throw new Error('The prepared XP claim does not match the pending entitlement');
      }
      setPreparedXpClaim({ user: owner, seasonId: activeSeasonId, claim, response });
      setXpClaimStatus(null);
    } catch {
      if (currentUser.current === owner && currentSeasonId.current === activeSeasonId) {
        setPreparedXpClaim(null);
        setXpClaimStatus(c.quoteUnavailable);
        flash(c.quoteUnavailable);
      }
    } finally {
      setBusy(false);
    }
  }

  async function confirmXpClaim() {
    if (!user || seasonId === null || reading?.owner !== user || !preparedXpClaim || busy ||
        preparedXpClaim.user !== user || preparedXpClaim.seasonId !== seasonId) return;
    const owner = user;
    const activeSeasonId = seasonId;
    const prepared = preparedXpClaim;
    const entitlement = prepared.response.entitlement;
    const quote = prepared.response.quote as PayerCostQuote;
    const intent: SeasonXpClaimIntent = {
      kind: 'seasonXpClaim',
      user: owner,
      authority: entitlement.authority,
      seasonId: entitlement.seasonId,
      amount: entitlement.amount,
      campaignId: entitlement.campaignId,
      campaignDigest: entitlement.campaignDigest,
      entitlementId: entitlement.id,
      nonce: entitlement.nonce,
      expirySlot: String(entitlement.expirySlot),
      clusterGenesisHash: entitlement.clusterGenesisHash,
      programId: entitlement.programId,
      genesisHashDigest: entitlement.genesisHashDigest,
      quote,
    };
    setBusy(true);
    setXpClaimStatus(c.preparing);
    try {
      const result = await handleTxResponse(prepared.response, intent);
      if (currentUser.current !== owner || currentSeasonId.current !== activeSeasonId) return;
      let confirmed = false;
      if (result.signature) {
        try {
          const confirmation = await api.season.xpClaimConfirm(owner, prepared.claim.id, result.signature);
          confirmed = confirmation?.status === 'consumed';
        } catch {
          // The on-chain cursor remains authoritative; reconcile below if the
          // confirmation endpoint or its single-use wallet proof is unavailable.
        }
      }
      if (result.success || confirmed) {
        setXpClaims((claims) => claims.filter((claim) => claim.id !== prepared.claim.id));
        setPreparedXpClaim(null);
        setXpClaimBlockedFor(null);
        setXpClaimStatus(c.xpClaimSuccess);
        flash(c.xpClaimSuccess);
        refresh();
        return;
      }
      if (result.signature) {
        try {
          const latest = await api.season.xpClaims(owner, activeSeasonId);
          if (currentUser.current !== owner || currentSeasonId.current !== activeSeasonId) return;
          const claims = Array.isArray(latest?.claims) ? latest.claims as PendingXpClaim[] : [];
          setXpClaims(claims);
          if (!claims.some((claim) => claim.id === prepared.claim.id)) {
            setPreparedXpClaim(null);
            setXpClaimBlockedFor(null);
            setXpClaimStatus(c.xpClaimSuccess);
            flash(c.xpClaimSuccess);
            refresh();
            return;
          }
          // The RPC reports this exact entitlement is still unconsumed (for
          // example, the submitted transaction failed atomically), so it can
          // safely be quoted and retried.
          setPreparedXpClaim(null);
          setXpClaimBlockedFor(null);
          setXpClaimStatus(c.failed);
          flash(c.failed);
        } catch {
          setPreparedXpClaim(null);
          setXpClaimBlockedFor(`${owner}:${activeSeasonId}:${prepared.claim.id}`);
          setXpClaimStatus(c.pending);
          flash(c.pending);
        }
      } else {
        setXpClaimStatus(c.failed);
        flash(c.failed);
      }
    } finally {
      setBusy(false);
    }
  }

  async function refreshXpClaimStatus() {
    if (!user || seasonId === null || reading?.owner !== user || busy) return;
    const owner = user;
    const activeSeasonId = seasonId;
    setBusy(true);
    try {
      const latest = await api.season.xpClaims(owner, activeSeasonId);
      if (currentUser.current !== owner || currentSeasonId.current !== activeSeasonId) return;
      setXpClaims(Array.isArray(latest?.claims) ? latest.claims as PendingXpClaim[] : []);
      setXpClaimsFailed(false);
      setXpClaimBlockedFor(null);
      setPreparedXpClaim(null);
      setXpClaimStatus(null);
    } catch {
      setXpClaimsFailed(true);
      setXpClaimStatus(c.pending);
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
      <Card className="bg-gradient-to-r from-accent-600/20 to-soil-850 border border-accent-600/30">
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
      {user && seasonId !== null && reading?.owner === user && <Card>
        <h3 className="text-parchment font-semibold text-sm mb-2">{c.xpRewardsTitle}</h3>
        {xpClaimsLoading && <p role="status" className="text-straw text-xs">{c.verifying}</p>}
        {xpClaimsFailed && <p role="status" className="text-straw text-xs">{c.xpClaimUnavailable}</p>}
        {xpClaimStatus && <p role="status" className="text-straw text-xs">{xpClaimStatus}</p>}
        {!xpClaimsLoading && !xpClaimsFailed && xpClaims.length === 0 &&
          <p className="text-straw text-xs">{c.xpNoRewards}</p>}
        <div className="space-y-3">
          {xpClaims.map((claim) => {
            const isPrepared = preparedXpClaim?.claim.id === claim.id &&
              preparedXpClaim.user === user && preparedXpClaim.seasonId === seasonId;
            const claimQuote = isPrepared ? preparedXpClaim.response.quote as PayerCostQuote : null;
            const isBlocked = xpClaimBlockedFor === `${user}:${seasonId}:${claim.id}`;
            return <div key={claim.id} className="p-3 rounded-xl bg-soil-800/70 border border-straw/10 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-parchment text-sm font-semibold">+{claim.amount} {c.xp}</p>
                  <p className="text-straw text-xs">{c.season} {claim.seasonId} · {claim.campaignId}</p>
                  <p className="text-straw text-xs">{c.xpClaimExpiry(claim.expirySlot)}</p>
                </div>
                <span className="text-xs text-gold shrink-0">#{claim.nonce}</span>
              </div>
              {!claim.canClaim && <p className="text-straw text-xs">{c.xpClaimQueue}</p>}
              {claimQuote && <div className="text-straw text-xs space-y-1" role="note" aria-label={c.quoteTitle}>
                <p>{c.quoteTitle}</p>
                <p>{c.quoteReview}</p>
                <p>{c.xpClaimRent(formatLamportsAsSol(claimQuote.rentLamports, language), claimQuote.rentLamports)}</p>
                <p>{c.quoteFee(formatLamportsAsSol(claimQuote.networkFeeLamports, language), claimQuote.networkFeeLamports)}</p>
                <p>{c.quoteMax(formatLamportsAsSol(claimQuote.maxCostLamports, language), claimQuote.maxCostLamports)}</p>
              </div>}
              {isBlocked && <p role="status" className="text-straw text-xs">{c.pending}</p>}
              {claim.canClaim && !isBlocked && <button type="button"
                onClick={isPrepared ? confirmXpClaim : () => prepareXpClaim(claim)} disabled={busy}
                className="w-full py-2.5 px-3 rounded-xl bg-gold text-soil-950 font-bold text-sm disabled:opacity-40 [overflow-wrap:anywhere]">
                {busy ? c.preparing : isPrepared ? c.xpClaimConfirm : c.xpClaimButton}
              </button>}
              {claim.canClaim && isPrepared && <button type="button" onClick={() => prepareXpClaim(claim)} disabled={busy}
                className="w-full py-2 px-3 rounded-xl border border-gold/30 text-parchment text-xs disabled:opacity-40">{c.refreshQuote}</button>}
            </div>;
          })}
        </div>
        <button type="button" onClick={refreshXpClaimStatus} disabled={busy || xpClaimsLoading}
          className="mt-3 w-full py-2 px-3 rounded-xl border border-straw/20 text-straw text-xs disabled:opacity-40">{c.xpClaimCheckStatus}</button>
      </Card>}
      {showInitPass && !passInitBlocked && <>
        <p className="text-straw text-xs" role="note">{c.initPassNote}</p>
        {quote && <div className="text-straw text-xs space-y-1" role="note" aria-label={c.quoteTitle}>
          <p>{c.quoteTitle}</p>
          <p>{c.quoteReview}</p>
          <p>{c.quoteRent(formatLamportsAsSol(quote.rentLamports, language), quote.rentLamports)}</p>
          <p>{c.quoteFee(formatLamportsAsSol(quote.networkFeeLamports, language), quote.networkFeeLamports)}</p>
          <p>{c.quoteMax(formatLamportsAsSol(quote.maxCostLamports, language), quote.maxCostLamports)}</p>
        </div>}
        {passInitStatus === 'preparing' && <p role="status" className="text-straw text-xs">{c.preparing}</p>}
        {passInitStatus === 'failed' && <p role="status" className="text-straw text-xs">{quote ? c.failed : c.quoteUnavailable}</p>}
        {passInitStatus === 'success' && <p role="status" className="text-straw text-xs">{c.submitted}</p>}
        <button type="button" onClick={quote ? confirmInitPass : prepareInitPass} disabled={!canInitPass}
          className="w-full py-3.5 px-3 rounded-2xl bg-soil-800 border border-gold/40 text-parchment font-bold text-sm disabled:opacity-40 [overflow-wrap:anywhere]">
          {busy ? c.preparing : quote ? c.initPassConfirm : c.initPass}
        </button>
        {quote && <button type="button" onClick={prepareInitPass} disabled={!canInitPass}
          className="w-full py-2 px-3 rounded-xl border border-gold/30 text-parchment text-xs disabled:opacity-40">{c.refreshQuote}</button>}
      </>}
      {showInitPass && passInitBlocked && <p role="status" className="text-center text-straw text-xs">{c.pending}</p>}
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
