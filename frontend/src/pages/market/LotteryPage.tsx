import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { handleTxResponse } from '../../lib/txFlow';
import { useWalletStore } from '../../store/walletStore';
import { useLocale } from '../../i18n/LocaleProvider';
import { lotteryCopy } from '../../i18n/lotteryCopy';
import { Card } from '../../components/ui/Card';
import { UI_ICONS } from '../../lib/visualAssets';
import { lamportsToSol } from '../../lib/amounts';
import { canRefundLotteryTicket, LOTTERY_TICKET_PRICE_LAMPORTS, lotteryU64, readLotteryRound,
  readLotteryTickets, type LotteryRound, type LotteryTicket } from '../../lib/lotteryReadings';
import { LotteryHall, type LotteryPoolId } from './LotteryHall';

/** Public game view: no admin create/draw controls. A purchase is signed with
 * the price ceiling the player sees (`max_price_lamports`), and existing owners
 * can claim or refund, each with a wallet-bound ticket intent. A failed read is
 * never rendered as an empty round or ticket list. */
export function LotteryPage() {
  const { language } = useLocale();
  const c = lotteryCopy[language];
  const { address } = useWalletStore();
  const walletRef = useRef(address);
  walletRef.current = address;
  const [roundId, setRoundId] = useState('1');
  const selectedId = lotteryU64(roundId, true) ? roundId : null;
  const selectionRef = useRef(selectedId);
  selectionRef.current = selectedId;
  const [round, setRound] = useState<LotteryRound | null>(null);
  const [roundState, setRoundState] = useState<'loading' | 'ready' | 'missing' | 'error' | 'invalid'>('loading');
  const [tickets, setTickets] = useState<LotteryTicket[] | null>(null);
  const [ticketOwner, setTicketOwner] = useState<string | null>(null);
  const [ticketRound, setTicketRound] = useState<string | null>(null);
  const [ticketState, setTicketState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [pending, setPending] = useState<{ action: 'claim' | 'refund'; ticket: string } | null>(null);
  const [notice, setNotice] = useState<null | 'working' | 'pending' | 'successCheck' | 'uncertain' | 'failed'>(null);
  const [pool, setPool] = useState<LotteryPoolId>('sol');
  const [now, setNow] = useState(() => Date.now());
  const roundRequest = useRef(0);
  const ticketRequest = useRef(0);

  useEffect(() => {
    let stopped = false;
    const read = (silent: boolean) => {
      const request = ++roundRequest.current;
      const id = selectionRef.current;
      if (!id) { setRoundState('invalid'); setRound(null); return; }
      if (!silent) { setRound(null); setRoundState('loading'); }
      api.query.lotteryRound(id).then((raw: unknown) => {
        if (stopped || request !== roundRequest.current || selectionRef.current !== id) return;
        if (raw === null) { setRoundState('missing'); return; }
        const snapshot = readLotteryRound(raw, id);
        if (!snapshot) { if (!silent) setRoundState('error'); return; }
        setRound(snapshot);
        setRoundState('ready');
      }).catch(() => {
        if (!stopped && request === roundRequest.current && !silent) setRoundState('error');
      });
    };
    read(false);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'hidden' || busyRef.current) return;
      read(true);
    }, 8000);
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { stopped = true; window.clearInterval(timer); window.clearInterval(clock); roundRequest.current++; };
  }, [selectedId, refresh]);

  useEffect(() => {
    const request = ++ticketRequest.current;
    if (!round || roundState !== 'ready' || !address) {
      setTickets(null); setTicketOwner(null); setTicketRound(null); setTicketState('idle'); return;
    }
    const owner = address;
    const same = ticketOwner === owner && ticketRound === round.roundId && ticketState === 'ready';
    if (!same) {
      setTickets(null); setTicketOwner(null); setTicketRound(null); setTicketState('loading');
    }
    api.query.myTickets(round.roundId, owner).then((raw: unknown) => {
      if (request !== ticketRequest.current || walletRef.current !== owner) return;
      const owned = readLotteryTickets(raw, round, owner);
      if (!owned) { setTicketState('error'); return; }
      setTickets(owned);
      setTicketOwner(owner);
      setTicketRound(round.roundId);
      setTicketState('ready');
    }).catch(() => { if (request === ticketRequest.current && walletRef.current === owner) setTicketState('error'); });
    return () => { ticketRequest.current++; };
  }, [round, roundState, address]);

  const activeRound = round?.roundId === selectedId ? round : null;
  const activeTickets = ticketOwner === address && ticketRound === selectedId && activeRound ? tickets : null;
  useEffect(() => { setPending(null); setNotice(null); }, [selectedId, address]);
  useEffect(() => {
    if (pending?.action === 'claim' && roundState === 'ready' && activeRound?.claimed ||
        pending?.action === 'refund' && ticketState === 'ready' && activeTickets && !activeTickets.some(t => t.ticketNumber === pending.ticket)) {
      setPending(null);
    }
  }, [activeRound, roundState, activeTickets, ticketState, pending]);

  const refreshNow = () => { setNotice(pending ? 'pending' : null); setRefresh(n => n + 1); };
  const canClaim = (ticket: LotteryTicket) => !!activeRound?.drawn && !activeRound.claimed &&
    activeRound.winningTicket === ticket.ticketNumber;
  const canRefund = !!activeRound && canRefundLotteryTicket(activeRound, now);

  async function act(action: 'claim' | 'refund', ticket: LotteryTicket) {
    const owner = address, id = selectedId;
    if (!owner || !id || busyRef.current || pending || !activeRound || roundState !== 'ready' ||
        ticketState !== 'ready' || !activeTickets?.some(t => t.pubkey === ticket.pubkey) ||
        !(action === 'claim' ? canClaim(ticket) : canRefund)) return;
    busyRef.current = true;
    setBusy(true);
    setNotice('working');
    try {
      // Re-read both on-chain sources immediately before asking the wallet.
      const fresh = readLotteryRound(await api.query.lotteryRound(id), id);
      if (walletRef.current !== owner || selectionRef.current !== id) return;
      const owned = fresh && readLotteryTickets(await api.query.myTickets(id, owner), fresh, owner);
      if (walletRef.current !== owner || selectionRef.current !== id) return;
      if (!fresh || !owned?.some(t => t.pubkey === ticket.pubkey && t.ticketNumber === ticket.ticketNumber) ||
          !(action === 'claim' ? fresh.drawn && !fresh.claimed && fresh.winningTicket === ticket.ticketNumber
            : canRefundLotteryTicket(fresh))) {
        setNotice('uncertain');
        setRefresh(n => n + 1);
        return;
      }
      const response = action === 'claim'
        ? await api.lottery.claim({ winner: owner, roundId: id, ticketNumber: ticket.ticketNumber })
        : await api.lottery.ticketRefund({ payer: owner, roundId: id, ticketNumber: ticket.ticketNumber });
      if (walletRef.current !== owner || selectionRef.current !== id) return;
      const result = await handleTxResponse(response, {
        kind: 'lotteryTicket', action, user: owner, roundId: id, ticketNumber: ticket.ticketNumber,
      });
      if (walletRef.current !== owner || selectionRef.current !== id) return;
      if (result.success || result.signature) {
        setPending({ action, ticket: ticket.ticketNumber });
        setNotice(result.success ? 'successCheck' : 'pending');
        setRefresh(n => n + 1);
      } else setNotice('failed');
    } catch {
      if (walletRef.current === owner && selectionRef.current === id) setNotice('uncertain');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function buyTicket() {
    const owner = address, id = selectedId;
    if (!owner || !id || busyRef.current || pending || roundState !== 'ready' || !activeRound ||
        activeRound.drawn || activeRound.drawCommitted) return;
    busyRef.current = true;
    setBusy(true);
    setNotice('working');
    try {
      // Re-read the round immediately before asking the wallet: the ticket PDA
      // is derived from `tickets_sold`, and sales may have closed meanwhile.
      const fresh = readLotteryRound(await api.query.lotteryRound(id), id);
      if (walletRef.current !== owner || selectionRef.current !== id) return;
      if (!fresh || fresh.drawn || fresh.drawCommitted) {
        setNotice('uncertain');
        setRefresh(n => n + 1);
        return;
      }
      const response = await api.lottery.ticketBuy({
        buyer: owner, roundId: id, maxPriceLamports: LOTTERY_TICKET_PRICE_LAMPORTS,
      });
      if (walletRef.current !== owner || selectionRef.current !== id) return;
      const result = await handleTxResponse(response, {
        kind: 'lotteryTicket', action: 'buy', user: owner, roundId: id,
        ticketNumber: fresh.ticketsSold, maxPriceLamports: LOTTERY_TICKET_PRICE_LAMPORTS,
      });
      if (walletRef.current !== owner || selectionRef.current !== id) return;
      if (result.success || result.signature) {
        setNotice(result.success ? 'successCheck' : 'pending');
        setRefresh(n => n + 1);
      } else setNotice('failed');
    } catch {
      if (walletRef.current === owner && selectionRef.current === id) setNotice('uncertain');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const status = !selectedId ? c.invalidRound : roundState === 'loading' || roundState === 'ready' && !activeRound ? c.roundLoading
    : roundState === 'missing' ? c.roundMissing : roundState !== 'ready' ? c.roundError
    : activeRound?.drawn ? c.drawn : activeRound?.drawCommitted ? c.drawPending : c.awaitingDraw;
  const ticketStatus = !address ? c.connect : ticketState === 'loading' || ticketState === 'idle' && roundState === 'loading'
    ? c.ticketsLoading : ticketState === 'error' ? c.ticketsError : ticketState === 'ready' && activeTickets?.length === 0
      ? c.noTickets : null;

  return (
    <div className="lot-page p-4 pt-6 pb-24 space-y-4 min-w-0 [overflow-wrap:anywhere]" lang={language}>
      <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
        <h1 className="text-2xl font-bold text-parchment flex items-center gap-2 min-w-0 [overflow-wrap:anywhere]">
          <img src={UI_ICONS.lottery} alt="" className="w-7 h-7 object-contain shrink-0" />{c.title}
        </h1>
        <button type="button" onClick={refreshNow} disabled={!selectedId || busy}
          className="text-xs text-straw px-3 py-2 rounded-lg bg-soil-800 border border-straw/20 disabled:opacity-40">
          {c.refresh}
        </button>
      </div>
      <p className="text-straw text-xs">{c.intro}</p>
      <LotteryHall copy={c} pool={pool} onPool={setPool} round={activeRound} now={now} tickets={activeTickets} spinning={notice === 'working'} />
      <label className="flex flex-wrap items-center gap-2 text-straw text-xs">
        {c.round}
        <input type="text" inputMode="numeric" pattern="[0-9]*" value={roundId}
          onChange={event => setRoundId(event.target.value.trim())}
          className="w-28 max-w-full bg-soil-800 border border-straw/20 rounded-xl px-3 py-2 text-parchment text-sm" />
      </label>
      {notice && <p className="text-straw text-xs" role="status">{c[notice]}</p>}
      <Card>
        <h2 className="text-parchment font-semibold text-sm mb-2">{c.roundStatus}</h2>
        <p className="text-straw text-xs" role="status">{status}</p>
        {roundState === 'ready' && activeRound && <>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
            {[
              [c.round, activeRound.roundId], [c.sold, BigInt(activeRound.ticketsSold).toLocaleString(language)],
              [c.pool, `${lamportsToSol(activeRound.poolLamports)} SOL`],
              [c.created, new Date(activeRound.createdAt * 1000).toLocaleString(language)],
              [c.winning, activeRound.drawn && activeRound.winningTicket !== null ? activeRound.winningTicket : '—'],
            ].map(([label, value]) => <div key={label} className="px-3 py-2 rounded-xl bg-soil-800/70 border border-straw/10 min-w-0">
              <dt className="text-straw text-xs">{label}</dt><dd className="text-parchment text-sm font-medium break-words">{value}</dd>
            </div>)}
          </dl>
          {activeRound.drawn && <p className="text-straw text-xs mt-3">{activeRound.claimed ? c.claimed : c.unclaimed}</p>}
        </>}
      </Card>
      <Card>
        <h2 className="text-parchment font-semibold text-sm mb-2">{c.tickets}</h2>
        {ticketStatus && <p className="text-straw text-xs" role="status">{ticketStatus}</p>}
        {roundState === 'ready' && ticketState === 'ready' && activeTickets && activeTickets.length > 0 && <>
          <p className="text-straw text-xs mb-2">{activeRound?.drawn ? c.claimHelp : c.refundHelp}</p>
          <ul className="space-y-2">
            {activeTickets.map(ticket => <li key={ticket.pubkey} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-soil-800/70 border border-straw/10 min-w-0">
              <span className="text-parchment text-sm">{c.ticket(BigInt(ticket.ticketNumber).toLocaleString(language))}</span>
              {canClaim(ticket) && <button type="button" disabled={busy || !!pending} onClick={() => act('claim', ticket)}
                className="px-3 py-2 rounded-xl bg-sprout-500 text-white text-xs disabled:opacity-40 max-w-full [overflow-wrap:anywhere]">{c.claim}</button>}
              {!activeRound?.drawn && canRefund && <button type="button" disabled={busy || !!pending} onClick={() => act('refund', ticket)}
                className="px-3 py-2 rounded-xl bg-accent-600 text-white text-xs disabled:opacity-40 max-w-full [overflow-wrap:anywhere]">{c.refund}</button>}
            </li>)}
          </ul>
          {!activeRound?.drawn && !canRefund && <p className="text-straw text-xs mt-2">{c.refundWaiting}</p>}
        </>}
      </Card>
      <Card>
        <h2 className="text-parchment font-semibold text-sm mb-2">{c.purchaseTitle}</h2>
        {pool !== 'sol' ? <div className="text-straw text-xs space-y-2 [overflow-wrap:anywhere]" role="status"><p>{c.solOnly}</p><p>{pool === 'skr' ? c.skrSeal : c.potatoSeal}</p></div>
          : !address ? <p className="text-straw text-xs" role="status">{c.connect}</p>
          : !activeRound || roundState !== 'ready' ? <p className="text-straw text-xs" role="status">{c.purchaseClosed}</p>
          : activeRound.drawn || activeRound.drawCommitted ? <p className="text-straw text-xs" role="status">{c.purchaseClosed}</p>
          : <>
            <p className="text-straw text-xs">{c.priceLine(lamportsToSol(LOTTERY_TICKET_PRICE_LAMPORTS))}</p>
            <p className="text-straw text-xs mt-1">{c.buyHelp}</p>
            <button type="button" disabled={busy || !!pending} onClick={buyTicket}
              className="mt-3 px-3 py-2 rounded-xl bg-sprout-500 text-white text-xs disabled:opacity-40 max-w-full [overflow-wrap:anywhere]">
              {c.buy}
            </button>
          </>}
      </Card>
    </div>
  );
}
