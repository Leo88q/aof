import { useEffect, useRef, useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { motion } from 'framer-motion';
import { Card } from '../../components/ui/Card';
import { useWalletStore } from '../../store/walletStore';
import { api } from '../../lib/api';
import { handleTxResponse } from '../../lib/txFlow';
import { CORE_PROGRAM_ID } from '../../lib/transactionIntent';
import { UI_ICONS, resourceIcon, toolPlate } from '../../lib/visualAssets';
import { ArtPlate } from '../../components/visual/ArtPlate';
import { ResourceGlyph } from '../../components/visual/ResourceGlyph';
import { actionErrorFeedback, LocalTxFeedbackError } from '../../lib/txResponseFeedback';
import { useLocale } from '../../i18n/LocaleProvider';
import { explorationCopy } from '../../i18n/explorationCopy';
import { homeResourceNames } from '../../i18n/homeDetail';

// aof-core/src/constants.rs: TRIP_COST_* in RESOURCE_UNIT (10^9) tokens.
const COST = [
  { id: 'data', symbol: 'DATA', amount: 75 },
  { id: 'circuit', symbol: 'CIRCUIT', amount: 35 },
  { id: 'silicon', symbol: 'SILICON', amount: 35 },
  { id: 'dataset', symbol: 'DATASET', amount: 50 },
] as const;
type TripState = 'checking' | 'unavailable' | 'missingTool' | 'ready' | 'pending' | 'closed';
type Notice = 'waiting' | 'pending' | 'unknown' | 'submitted' | 'uncertain' | null;

function tripCommit(mint: string): string {
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode('exploration_commit'), new PublicKey(mint).toBuffer()],
    new PublicKey(CORE_PROGRAM_ID),
  )[0].toBase58();
}

/** Exploration status only proves a pending commit. Once its PDA closes, the API cannot tell success from failure or refund. */
export function ExplorationPage() {
  const { language } = useLocale();
  const copy = explorationCopy[language];
  const names = homeResourceNames[language];
  const { address } = useWalletStore();
  const walletRef = useRef(address);
  walletRef.current = address;
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [trip, setTrip] = useState<TripState>('checking');
  const [transmitter, setTransmitter] = useState<{ mint: string; commit: string } | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [error, setError] = useState<{ language: typeof language; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    setTransmitter(null);
    setNotice(null);
    setError(null);
    setTrip('checking');
    if (!address) { setTrip('missingTool'); return () => { active = false; }; }
    (async () => {
      try {
        const tools: unknown = await api.query.myTools(address);
        if (!active || !Array.isArray(tools)) {
          if (active) setTrip('unavailable');
          return;
        }
        const tool = tools.find((t: any) => String(t?.toolType ?? t?.tool_type ?? '').toLowerCase() === 'quantum_transmitter');
        if (!tool || typeof tool.mint !== 'string') { setTrip('missingTool'); return; }
        const commit = tripCommit(tool.mint);
        const status: any = await api.exploration.status(commit);
        if (!active) return;
        if (status?.state !== 'pending' && status?.state !== 'unknown' && status?.state !== 'settled' && status?.state !== 'refunded') {
          setTrip('unavailable'); return;
        }
        setTransmitter({ mint: tool.mint, commit });
        setTrip(status.state === 'pending' ? 'pending' : 'ready');
      } catch {
        if (active) setTrip('unavailable');
      }
    })();
    return () => { active = false; };
  }, [address]);

  useEffect(() => {
    if (trip !== 'pending' || !transmitter || !address) return;
    let active = true;
    const timer = setInterval(async () => {
      try {
        const status: any = await api.exploration.status(transmitter.commit);
        if (!active || walletRef.current !== address) return;
        if (status?.state === 'pending') return;
        if (['unknown', 'settled', 'refunded'].includes(status?.state)) {
          // No on-chain receipt is indexed for this mechanic after the PDA closes.
          setTrip('closed'); setNotice('unknown');
        } else { setTrip('unavailable'); setNotice('uncertain'); }
      } catch {
        if (active && walletRef.current === address) { setTrip('unavailable'); setNotice('uncertain'); }
      }
    }, 4000);
    return () => { active = false; clearInterval(timer); };
  }, [trip, transmitter, address]);

  function fail(e: unknown) {
    setError({ language, text: actionErrorFeedback(e, language, copy.uncertain) });
    setNotice('uncertain');
  }

  async function startExploration() {
    if (!address || !transmitter || (trip !== 'ready' && trip !== 'closed') || busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(null); setNotice(null);
    try {
      // Recheck the pending PDA immediately before asking for a wallet signature.
      const status: any = await api.exploration.status(transmitter.commit);
      if (walletRef.current !== address) return;
      if (status?.state === 'pending') { setTrip('pending'); setNotice('pending'); return; }
      if (!['unknown', 'settled', 'refunded'].includes(status?.state)) { setTrip('unavailable'); setNotice('uncertain'); return; }
      const response: any = await api.exploration.startCommit({ user: address, toolMint: transmitter.mint });
      if (walletRef.current !== address) return;
      if (response?.explorationCommit !== transmitter.commit || typeof response.tx !== 'string') throw new LocalTxFeedbackError(copy.uncertain);
      const result = await handleTxResponse(response);
      if (walletRef.current !== address) return;
      if (!result.success) throw new LocalTxFeedbackError(result.error || copy.uncertain);
      setTrip('pending'); setNotice('waiting');
    } catch (e) {
      if (walletRef.current === address) { setTrip('unavailable'); fail(e); }
    } finally { busyRef.current = false; setBusy(false); }
  }

  async function selfSettle() {
    if (!address || !transmitter || trip !== 'pending' || busyRef.current) return;
    busyRef.current = true; setBusy(true); setNotice(null); setError(null);
    try {
      const status: any = await api.exploration.status(transmitter.commit);
      if (walletRef.current !== address) return;
      if (status?.state !== 'pending') { setTrip('closed'); setNotice('unknown'); return; }
      const response: any = await api.exploration.reveal({ user: address, explorationCommit: transmitter.commit });
      if (walletRef.current !== address) return;
      if (typeof response?.tx !== 'string') throw new LocalTxFeedbackError(copy.uncertain);
      const result = await handleTxResponse(response);
      if (walletRef.current !== address) return;
      if (!result.success) throw new LocalTxFeedbackError(result.error || copy.uncertain);
      setTrip('closed'); setNotice('submitted');
    } catch (e) {
      if (walletRef.current === address) fail(e); // keep the trip available for status recheck
    } finally { busyRef.current = false; setBusy(false); }
  }

  const message = (error?.language === language ? error.text : null) || (notice ? copy[notice] : null);
  return (
    <div className="p-4 pt-6 pb-24 min-w-0">
      <h1 className="text-2xl font-bold mb-4 flex items-center gap-2 min-w-0"><img src={UI_ICONS.expedition} alt="" className="w-7 h-7 object-contain" />{copy.title}</h1>
      <Card className="mb-4">
        <div className="text-center mb-4">
          <ArtPlate src={toolPlate('quantum_transmitter')} alt="" size={56} className="mx-auto" />
          <h2 className="text-parchment font-bold text-lg mt-3 break-words">{copy.heading}</h2>
          <p className="text-straw text-sm mt-2 break-words">{copy.intro}</p>
        </div>
        <div className="bg-soil-800/60 rounded-xl p-4 mb-4 min-w-0">
          <h3 className="text-parchment font-semibold text-sm mb-3">{copy.cost}</h3>
          <div className="space-y-2 text-sm">
            {COST.map(({ id, symbol, amount }) => (
              <div key={id} className="flex justify-between gap-2 min-w-0 last:border-t last:border-straw/20 last:pt-2">
                <span className="text-straw inline-flex items-center gap-1.5 min-w-0 break-words"><ResourceGlyph icon={resourceIcon(symbol)} alt="" className="w-4 h-4 shrink-0" />{names[id]} ({symbol})</span>
                <span className="text-parchment font-bold shrink-0">{amount.toLocaleString(language)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-gold/10 border border-gold/30 rounded-xl p-4 mb-4">
          <h3 className="text-gold font-semibold text-sm mb-2">{copy.reward}</h3>
          <p className="text-straw text-xs break-words">{copy.rewardInfo}</p>
        </div>
        <div className="bg-nf-purple/10 border border-nf-purple/30 rounded-xl p-4 mb-4">
          <h3 className="text-nf-purple font-semibold text-sm mb-2">{copy.requirements}</h3>
          <ul className="space-y-1 text-xs text-straw break-words">
            <li>✓ {copy.tool}</li><li>✓ {copy.resources}</li><li>✓ {copy.limits}</li>
          </ul>
        </div>
        {(message || trip === 'checking' || trip === 'unavailable' || trip === 'pending') && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} role="status" className="text-xs px-3 py-2 rounded-xl bg-soil-800 border border-straw/20 text-parchment mb-4 break-words">
            {message || (trip === 'checking' ? copy.checking : trip === 'unavailable' ? copy.unavailable : copy.pending)}
          </motion.div>
        )}
        <button onClick={startExploration} disabled={busy || !address || !transmitter || (trip !== 'ready' && trip !== 'closed')}
          className="w-full min-w-0 px-3 py-3.5 rounded-2xl bg-gradient-to-r from-nf-purple to-accent-600 text-white font-bold text-sm disabled:opacity-40 active:scale-95 transition-transform whitespace-normal break-words">
          {busy ? copy.sending : !address ? copy.connect : trip === 'checking' ? copy.checking : trip === 'unavailable' ? copy.unavailable : trip === 'pending' ? copy.pending : !transmitter ? copy.missingTool : copy.send}
        </button>
        {transmitter && trip === 'pending' && <button onClick={selfSettle} disabled={busy}
          className="w-full min-w-0 mt-2 px-3 py-2 rounded-2xl bg-soil-800 border border-straw/20 text-parchment text-xs whitespace-normal break-words disabled:opacity-40">
          {busy ? copy.settling : copy.selfSettle}
        </button>}
      </Card>
      <Card>
        <h3 className="text-parchment font-semibold text-sm mb-3">{copy.how}</h3>
        <div className="space-y-2 text-xs text-straw break-words"><p>1. {copy.commit}</p><p>2. {copy.reveal}</p><p>3. {copy.outcome}</p></div>
      </Card>
    </div>
  );
}
