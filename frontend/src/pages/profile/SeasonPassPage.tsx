import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../../lib/api';
import { handleTxResponse } from '../../lib/txFlow';
import { connection } from '../../lib/wallet';
import type {
  PayerCostQuote,
  SeasonPassInitIntent,
  SeasonPassIntent,
  SeasonXpClaimIntent,
} from '../../lib/transactionIntent';
import { formatLamportsAsSol } from '../../lib/formatLamports';
import { useVipStatus } from '../../lib/useVipStatus';
import type { VipSnapshot } from '../../lib/vipReadings';
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
const SEASON_PASS_MAX_LEVEL = 42;
const SEASON_XP_PER_LEVEL = 1_000;
const SEASON_REWARD_UNITS_PER_LEVEL = 100;
type PreparedSeasonPassInit = { user: string; seasonId: number; response: { tx: string; quote: PayerCostQuote } };
type PreparedSeasonPassPurchase = { user: string; seasonId: number; response: { tx: string; quote: PayerCostQuote } };
type PendingXpClaim = {
  id: string; player: string; seasonId: number; amount: number; campaignId: string;
  nonce: number; expirySlot: string; canClaim: boolean;
};
type PreparedXpClaim = { user: string; seasonId: number; claim: PendingXpClaim; response: any };

function claimableSeasonLevels(xp: number, claimedBitmap: string): number[] {
  const claimed = BigInt(claimedBitmap);
  return Array.from({ length: SEASON_PASS_MAX_LEVEL }, (_, index) => index + 1)
    .filter((level) => xp >= level * SEASON_XP_PER_LEVEL && (claimed & (1n << BigInt(level - 1))) === 0n);
}

function seasonRewardKey(user: string, seasonId: number, level: number, premiumTrack: boolean): string {
  return `${user}:${seasonId}:${premiumTrack ? 'premium' : 'free'}:${level}`;
}

function canClaimSeasonReward(snapshot: VipSnapshot | null, level: number, premiumTrack: boolean): boolean {
  if (!snapshot?.seasonActive || !snapshot.pass || level < 1 || level > SEASON_PASS_MAX_LEVEL ||
      snapshot.pass.xp < level * SEASON_XP_PER_LEVEL) return false;
  if (premiumTrack && (!snapshot.passPremium || snapshot.pass.premiumClaimedBitmap === null)) return false;
  const bitmap = premiumTrack ? snapshot.pass.premiumClaimedBitmap : snapshot.pass.claimedBitmap;
  return bitmap !== null && (BigInt(bitmap) & (1n << BigInt(level - 1))) === 0n;
}

function hasClaimedSeasonReward(snapshot: VipSnapshot | null, level: number, premiumTrack: boolean): boolean {
  if (!snapshot?.pass || level < 1 || level > SEASON_PASS_MAX_LEVEL) return false;
  const bitmap = premiumTrack ? snapshot.pass.premiumClaimedBitmap : snapshot.pass.claimedBitmap;
  return bitmap !== null && (BigInt(bitmap) & (1n << BigInt(level - 1))) !== 0n;
}

const SEASON_REWARD_NO_SUBMISSION_ERRORS = new Set([
  'INVALID_SEASON_ID', 'INVALID_SEASON_REWARD_CLAIM', 'SEASON_REWARD_AUTHORITY_CONFIGURATION_MISMATCH',
  'SEASON_NOT_FOUND', 'SEASON_NOT_ACTIVE', 'SEASON_PASS_REQUIRED', 'SEASON_INSUFFICIENT_XP',
  'SEASON_PREMIUM_REQUIRED', 'SEASON_PREMIUM_CLAIMS_LEDGER_UNAVAILABLE', 'SEASON_REWARD_ALREADY_CLAIMED',
  'SEASON_REWARD_TRANSACTION_FAILED', 'SEASON_REWARD_PREPARE_FAILED', 'FRAUD_REVIEW_HOLD',
  'FRAUD_HOLD_CHECK_UNAVAILABLE', 'Wallet signature required', 'Wallet proof actor or subject mismatch',
  'Wallet proof already used', 'Wallet proof storage unavailable', 'Invalid wallet proof payload',
]);

function isSeasonRewardPreSubmitError(error: unknown): boolean {
  const code = error && typeof error === 'object' ? (error as { code?: unknown }).code : null;
  return typeof code === 'string' && SEASON_REWARD_NO_SUBMISSION_ERRORS.has(code);
}

export function SeasonPassPage() {
  const { language } = useLocale();
  const c = seasonPassCopy[language];
  const treasury = useTreasury();
  const { user, reading, seasonId, refresh } = useVipStatus();
  const snapshot: VipSnapshot | null = reading?.kind === 'ready' ? reading.snapshot ?? null : null;
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
  const [preparedPassPurchase, setPreparedPassPurchase] = useState<PreparedSeasonPassPurchase | null>(null);
  const [passInitStatus, setPassInitStatus] = useState<'idle' | 'preparing' | 'prepared' | 'failed' | 'pending' | 'success'>('idle');
  const [xpClaims, setXpClaims] = useState<PendingXpClaim[]>([]);
  const [xpClaimsLoading, setXpClaimsLoading] = useState(false);
  const [xpClaimsFailed, setXpClaimsFailed] = useState(false);
  const [preparedXpClaim, setPreparedXpClaim] = useState<PreparedXpClaim | null>(null);
  const [xpClaimStatus, setXpClaimStatus] = useState<string | null>(null);
  const [xpClaimBlockedFor, setXpClaimBlockedFor] = useState<string | null>(null);
  const [seasonRewardStatus, setSeasonRewardStatus] = useState<string | null>(null);
  const [seasonRewardBlockedFor, setSeasonRewardBlockedFor] = useState<string | null>(null);
  const [seasonRewardPendingSignature, setSeasonRewardPendingSignature] = useState<string | null>(null);
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
    setSeasonRewardStatus(null);
    setSeasonRewardBlockedFor(null);
    setSeasonRewardPendingSignature(null);
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
  const purchaseQuote = preparedPassPurchase?.user === user && preparedPassPurchase.seasonId === seasonId
    ? preparedPassPurchase.response.quote : null;
  const freeRewardLevels = snapshot?.pass && snapshot.seasonActive
    ? claimableSeasonLevels(snapshot.pass.xp, snapshot.pass.claimedBitmap) : [];
  const premiumRewardLevels = snapshot?.pass && snapshot.seasonActive && snapshot.passPremium &&
      snapshot.pass.premiumClaimedBitmap !== null
    ? claimableSeasonLevels(snapshot.pass.xp, snapshot.pass.premiumClaimedBitmap) : [];
  const canBuy = Boolean(PAID_PASS_READY && seasonId !== null && user && treasury && snapshot?.seasonActive && !snapshot.passPremium &&
    !busy && !paymentBlocked);

  async function preparePassPurchase() {
    if (!canBuy || !user || !treasury || seasonId === null) return;
    const owner = user;
    const activeSeasonId = seasonId;
    setBusy(true);
    setPreparedPassPurchase(null);
    try {
      // Recheck immediately before requesting a payment transaction.
      const current = readActiveSeason(await api.season.current());
      if (!current || current.seasonId !== activeSeasonId) { flash(c.unavailable); refresh(); return; }
      const verified = (await import('../../lib/vipReadings')).readVipSnapshot(
        await api.season.vipStatus(owner, activeSeasonId), owner, activeSeasonId);
      if (!verified || !verified.seasonActive || verified.passPremium || owner !== reading?.owner ||
          reading.seasonId !== activeSeasonId) {
        flash(c.unavailable);
        refresh();
        return;
      }
      const response = await api.season.passPurchase({ user: owner, seasonId: activeSeasonId, treasury });
      if (currentUser.current !== owner || currentSeasonId.current !== activeSeasonId) return;
      if (typeof response?.tx !== 'string' || !response.tx || !response.quote) throw new Error('Missing payer quote');
      setPreparedPassPurchase({ user: owner, seasonId: activeSeasonId, response });
      flash(c.preparing);
    } catch {
      if (currentUser.current === owner && currentSeasonId.current === activeSeasonId) flash(c.quoteUnavailable);
    } finally {
      setBusy(false);
    }
  }

  async function confirmPassPurchase() {
    if (!canBuy || !user || !treasury || seasonId === null || !purchaseQuote || !preparedPassPurchase) return;
    const owner = user;
    const activeSeasonId = seasonId;
    const response = preparedPassPurchase.response;
    const intent: SeasonPassIntent = {
      kind: 'seasonPass', user: owner, treasury, seasonId: activeSeasonId,
      priceLamports: PASS_PRICE_LAMPORTS, quote: purchaseQuote,
    };
    setBusy(true);
    try {
      const result = await handleTxResponse(response, intent);
      if (currentUser.current !== owner || currentSeasonId.current !== activeSeasonId) return;
      if (result.success || result.signature) {
        setPaymentBlockedFor(`${owner}:${activeSeasonId}`);
        setPreparedPassPurchase(null);
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
    setPreparedPassPurchase(null);
    setPassInitStatus('idle');
  }, [user, seasonId, Boolean(snapshot?.pass), Boolean(snapshot?.passPremium)]);

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

  async function submitSeasonRewardClaim(level: number, premiumTrack: boolean) {
    if (!user || seasonId === null || reading?.owner !== user || busy || seasonRewardBlockedFor ||
        !canClaimSeasonReward(snapshot, level, premiumTrack)) return;
    const owner = user;
    const activeSeasonId = seasonId;
    const key = seasonRewardKey(owner, activeSeasonId, level, premiumTrack);
    let requestStarted = false;
    let submittedSignature: string | null = null;
    setBusy(true);
    setSeasonRewardStatus(c.preparingRewardClaim);
    try {
      const current = readActiveSeason(await api.season.current());
      if (!current || current.seasonId !== activeSeasonId) {
        setSeasonRewardStatus(c.unavailable);
        refresh();
        return;
      }
      const { readVipSnapshot: readLatestVip } = await import('../../lib/vipReadings');
      const latest = readLatestVip(await api.season.vipStatus(owner, activeSeasonId), owner, activeSeasonId);
      if (!latest || !canClaimSeasonReward(latest, level, premiumTrack) ||
          currentUser.current !== owner || currentSeasonId.current !== activeSeasonId) {
        setSeasonRewardStatus(c.unavailable);
        refresh();
        return;
      }
      const payload = { owner, seasonId: activeSeasonId, level, premiumTrack };
      const { createWalletProof } = await import('../../lib/wallet');
      const walletProof = await createWalletProof(owner, 'season_reward_claim', payload, {
        method: 'POST', target: '/season/reward/claim',
      });
      if (currentUser.current !== owner || currentSeasonId.current !== activeSeasonId) return;

      // From this point the backend may broadcast an operator-paid claim. Keep
      // the level locked until its signature or the on-chain claim bitmap settles.
      requestStarted = true;
      setSeasonRewardBlockedFor(key);
      const response = await api.season.rewardClaim({ ...payload, walletProof });
      if (currentUser.current !== owner || currentSeasonId.current !== activeSeasonId) return;
      if (typeof response?.signature === 'string') submittedSignature = response.signature;
      if (typeof response?.sig === 'string') submittedSignature = response.sig;
      setSeasonRewardPendingSignature(submittedSignature);
      if (response?.owner !== owner || response.seasonId !== activeSeasonId || response.level !== level ||
          response.premiumTrack !== premiumTrack) {
        throw new Error('Season reward response differs from the signed request');
      }
      if (response.pending === true) {
        setSeasonRewardStatus(c.rewardClaimPending);
        flash(c.rewardClaimPending);
        refresh();
        return;
      }
      if (typeof response.sig !== 'string' || !response.sig) {
        throw new Error('Missing operator claim signature');
      }

      const result = await handleTxResponse(response);
      if (currentUser.current !== owner || currentSeasonId.current !== activeSeasonId) return;
      if (result.signature) {
        submittedSignature = result.signature;
        setSeasonRewardPendingSignature(result.signature);
      }
      if (result.success) {
        const confirmed = readLatestVip(await api.season.vipStatus(owner, activeSeasonId), owner, activeSeasonId);
        if (currentUser.current !== owner || currentSeasonId.current !== activeSeasonId) return;
        if (hasClaimedSeasonReward(confirmed, level, premiumTrack)) {
          setSeasonRewardBlockedFor(null);
          setSeasonRewardPendingSignature(null);
          setSeasonRewardStatus(c.rewardClaimSuccess);
          flash(c.rewardClaimSuccess);
          refresh();
          return;
        }
      }
      if (result.signature || result.success) {
        setSeasonRewardStatus(c.rewardClaimPending);
        flash(c.rewardClaimPending);
        refresh();
        return;
      }
      setSeasonRewardBlockedFor(null);
      setSeasonRewardPendingSignature(null);
      setSeasonRewardStatus(c.rewardClaimFailed);
      flash(c.rewardClaimFailed);
    } catch (error: any) {
      if (currentUser.current !== owner || currentSeasonId.current !== activeSeasonId) return;
      if (requestStarted && !isSeasonRewardPreSubmitError(error)) {
        setSeasonRewardBlockedFor(key);
        setSeasonRewardPendingSignature(submittedSignature);
        setSeasonRewardStatus(c.rewardClaimPending);
        flash(c.rewardClaimPending);
      } else {
        setSeasonRewardBlockedFor(null);
        setSeasonRewardPendingSignature(null);
        setSeasonRewardStatus(c.rewardClaimFailed);
        flash(c.rewardClaimFailed);
      }
    } finally {
      setBusy(false);
    }
  }

  async function refreshSeasonRewardStatus() {
    if (!user || seasonId === null || reading?.owner !== user || busy || !seasonRewardBlockedFor) return;
    const owner = user;
    const activeSeasonId = seasonId;
    const [blockedUser, blockedSeasonRaw, blockedTrack, blockedLevelRaw] = seasonRewardBlockedFor.split(':');
    if (blockedUser !== owner || Number(blockedSeasonRaw) !== activeSeasonId) {
      setSeasonRewardBlockedFor(null);
      setSeasonRewardPendingSignature(null);
      return;
    }
    const blockedLevel = Number(blockedLevelRaw);
    const blockedPremium = blockedTrack === 'premium';
    setBusy(true);
    try {
      const { readVipSnapshot: readLatestVip } = await import('../../lib/vipReadings');
      const latest = readLatestVip(await api.season.vipStatus(owner, activeSeasonId), owner, activeSeasonId);
      if (currentUser.current !== owner || currentSeasonId.current !== activeSeasonId) return;
      if (!latest) throw new Error('Season reward status unavailable');
      const claimed = hasClaimedSeasonReward(latest, blockedLevel, blockedPremium);
      if (claimed) {
        setSeasonRewardBlockedFor(null);
        setSeasonRewardPendingSignature(null);
        setSeasonRewardStatus(c.rewardClaimSuccess);
        flash(c.rewardClaimSuccess);
        refresh();
        return;
      }
      if (seasonRewardPendingSignature) {
        const signatureStatus = (await connection.getSignatureStatuses(
          [seasonRewardPendingSignature], { searchTransactionHistory: true },
        )).value[0];
        if (currentUser.current !== owner || currentSeasonId.current !== activeSeasonId) return;
        if (signatureStatus?.err) {
          setSeasonRewardBlockedFor(null);
          setSeasonRewardPendingSignature(null);
          setSeasonRewardStatus(c.rewardClaimFailed);
          flash(c.rewardClaimFailed);
          refresh();
          return;
        }
      }
      setSeasonRewardStatus(c.rewardClaimPending);
      flash(c.rewardClaimPending);
      refresh();
    } catch {
      setSeasonRewardStatus(c.rewardClaimPending);
      flash(c.rewardClaimPending);
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
      {snapshot?.pass && snapshot.seasonActive && user && seasonId !== null && reading?.owner === user && <Card>
        <h3 className="text-parchment font-semibold text-sm mb-2">{c.seasonRewards}</h3>
        {seasonRewardStatus && <p role="status" className="text-straw text-xs mb-2">{seasonRewardStatus}</p>}
        <p className="text-straw text-xs mb-3" role="note">{c.rewardPayerNote}</p>
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="text-parchment text-sm">{c.freeTrackTitle}</h4>
            {freeRewardLevels.length === 0 && <p className="text-straw text-xs">{c.noSeasonRewards}</p>}
            {freeRewardLevels.map((level) => {
              const key = seasonRewardKey(user, seasonId, level, false);
              const isBlocked = seasonRewardBlockedFor === key;
              return <div key={`free-${level}`} className="p-3 rounded-xl bg-soil-800/70 border border-straw/10 space-y-2">
                <p className="text-parchment text-sm font-semibold">{c.season} {seasonId} · #{level}</p>
                <p className="text-straw text-xs">{c.rewardAmount(level * SEASON_REWARD_UNITS_PER_LEVEL)}</p>
                {isBlocked ? <p role="status" className="text-straw text-xs">{seasonRewardStatus || c.rewardClaimPending}</p>
                  : <button type="button" onClick={() => submitSeasonRewardClaim(level, false)}
                    disabled={busy || Boolean(seasonRewardBlockedFor)}
                    className="w-full py-2.5 px-3 rounded-xl bg-gold text-soil-950 font-bold text-sm disabled:opacity-40 [overflow-wrap:anywhere]">
                    {busy ? c.preparingRewardClaim : c.claimSeasonReward(level)}
                  </button>}
              </div>;
            })}
          </div>
          {snapshot.passPremium && <div className="space-y-2">
            <h4 className="text-parchment text-sm">{c.premiumTrackTitle}</h4>
            {snapshot.pass.premiumClaimedBitmap === null
              ? <p role="status" className="text-straw text-xs">{c.premiumLedgerUnavailable}</p>
              : premiumRewardLevels.length === 0
                ? <p className="text-straw text-xs">{c.noSeasonRewards}</p>
                : premiumRewardLevels.map((level) => {
                    const key = seasonRewardKey(user, seasonId, level, true);
                    const isBlocked = seasonRewardBlockedFor === key;
                    return <div key={`premium-${level}`} className="p-3 rounded-xl bg-soil-800/70 border border-straw/10 space-y-2">
                      <p className="text-parchment text-sm font-semibold">{c.season} {seasonId} · #{level}</p>
                      <p className="text-straw text-xs">{c.rewardAmount(level * SEASON_REWARD_UNITS_PER_LEVEL)}</p>
                      {isBlocked ? <p role="status" className="text-straw text-xs">{seasonRewardStatus || c.rewardClaimPending}</p>
                        : <button type="button" onClick={() => submitSeasonRewardClaim(level, true)}
                          disabled={busy || Boolean(seasonRewardBlockedFor)}
                          className="w-full py-2.5 px-3 rounded-xl bg-gold text-soil-950 font-bold text-sm disabled:opacity-40 [overflow-wrap:anywhere]">
                          {busy ? c.preparingRewardClaim : c.claimSeasonReward(level)}
                        </button>}
                    </div>;
                  })}
          </div>}
        </div>
        {seasonRewardBlockedFor && <button type="button" onClick={refreshSeasonRewardStatus} disabled={busy}
          className="mt-3 w-full py-2 px-3 rounded-xl border border-straw/20 text-straw text-xs disabled:opacity-40">{c.xpClaimCheckStatus}</button>}
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
        {purchaseQuote && <div className="text-straw text-xs space-y-1" role="note" aria-label={c.quoteTitle}>
          <p>{c.quoteTitle}</p>
          <p>{c.quoteRent(formatLamportsAsSol(purchaseQuote.rentLamports, language), purchaseQuote.rentLamports)}</p>
          <p>{c.quoteFee(formatLamportsAsSol(purchaseQuote.networkFeeLamports, language), purchaseQuote.networkFeeLamports)}</p>
          <p>{c.quoteMax(formatLamportsAsSol(purchaseQuote.maxCostLamports, language), purchaseQuote.maxCostLamports)}</p>
        </div>}
        <button type="button" onClick={purchaseQuote ? confirmPassPurchase : preparePassPurchase} disabled={!canBuy}
          className="w-full py-3.5 px-3 rounded-2xl bg-gold text-soil-950 font-bold text-sm disabled:opacity-40 [overflow-wrap:anywhere]">
          {busy ? c.preparing : c.purchase}
        </button>
        {purchaseQuote && <button type="button" onClick={preparePassPurchase} disabled={!canBuy}
          className="w-full py-2 px-3 rounded-xl border border-gold/30 text-parchment text-xs disabled:opacity-40">{c.refreshQuote}</button>}
      </>}
      {snapshot?.seasonActive && !snapshot.passPremium && paymentBlocked &&
        <p className="text-center text-straw text-xs" role="status">{c.pending}</p>}
    </div>
  );
}
