import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { handleTxResponse } from '../../lib/txFlow';
import { useWalletStore } from '../../store/walletStore';
import { useLocale } from '../../i18n/LocaleProvider';
import { orderbookCopy } from '../../i18n/orderbookCopy';
import { homeResourceNames, type ResourceId } from '../../i18n/homeDetail';
import { Card } from '../../components/ui/Card';
import { DepthChart } from '../../components/charts/DepthChart';
import { ALL_TRADE_RESOURCES, shortAddr, type TradeResource } from '../../lib/marketUtils';
import { loadMints } from '../../lib/mints';
import { readOrderbookV2, comparePriceV2, formatResourceUnits, lamportsPerWholeToSol, quoteTotalLamports,
  readOrderbook, resourceUnitsToAtoms, solPerWholeToLamports, takerBufferLamports,
  type Orderbook, type OrderbookV2, type ResourceOrder, type ResourceOrderV2 } from '../../lib/orderbookReadings';
import { lamportsToSol } from '../../lib/amounts';
import { ResourceGlyph } from '../../components/visual/ResourceGlyph';
import { UI_ICONS } from '../../lib/visualAssets';

// v1 remains read/cancel-only: its contract price is lamports PER ATOMIC token,
// while the old form claimed SOL per whole resource (up to 10^9 times the shown
// total). v2 fixes the unit in the program — price per WHOLE resource, escrow
// rounded up — and every v2 action is bound to a wallet intent that recomputes
// the same integer quote the program will use.
const nameId = (key: string): ResourceId =>
  key.toLowerCase().replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()) as ResourceId;

export function OrderbookPage() {
  const { language } = useLocale();
  const copy = orderbookCopy[language];
  const names = homeResourceNames[language];
  const { address } = useWalletStore();
  const walletRef = useRef(address);
  walletRef.current = address;
  const [registry, setRegistry] = useState<TradeResource[] | null>(null);
  const [selectedKey, setSelectedKey] = useState('DATA');
  const [book, setBook] = useState<OrderbookV2 | null>(null);
  const [bookState, setBookState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [priceInput, setPriceInput] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [formNotice, setFormNotice] = useState<'working' | 'pending' | 'failed' | null>(null);
  const [notice, setNotice] = useState<'cancelling' | 'cancelled' | 'uncertain' | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const request = useRef(0);
  const resources = registry || [];
  const resource = resources.find(item => item.key === selectedKey) || resources[0];
  const resourceRef = useRef(resource?.mint);
  resourceRef.current = resource?.mint;

  useEffect(() => {
    let active = true;
    loadMints().then(mints => {
      if (!active) return;
      setRegistry(ALL_TRADE_RESOURCES
        .map(item => ({ ...item, mint: mints[item.key as keyof typeof mints] || '' }))
        .filter(item => item.mint));
    }).catch(() => { if (active) setRegistry([]); });
    return () => { active = false; };
  }, []);

  const load = useCallback(async (selected: TradeResource) => {
    const id = ++request.current;
    setBook(null);
    setBookState('loading');
    try {
      const result = readOrderbookV2(await api.query.orderbookV2(selected.mint), selected.mint, selected.kind);
      if (id !== request.current) return;
      if (!result) throw new Error('Incomplete orderbook response');
      setBook(result);
      setBookState('ready');
    } catch {
      if (id === request.current) { setBook(null); setBookState('error'); }
    }
  }, []);

  useEffect(() => {
    if (resource) load(resource);
    else { request.current++; setBook(null); setBookState('error'); }
    return () => { request.current++; };
  }, [resource?.key, resource?.mint, load]);

  // Switching wallets must not leave an old account's cancellation confirmation visible.
  useEffect(() => { setNotice(null); }, [address]);

  const bids = useMemo(() => [...(book?.buy || [])].sort((a, b) => comparePriceV2(b, a)), [book]);
  const asks = useMemo(() => [...(book?.sell || [])].sort(comparePriceV2), [book]);
  const ownedExhausted = book?.exhausted.filter(o => !!address && o.maker === address) || [];
  const price = (o: ResourceOrderV2) => `${lamportsPerWholeToSol(o.priceLamportsPerWhole, language)} SOL`;
  // Предпросмотр считается теми же целыми формулами, что и в программе.
  const preview = useMemo(() => {
    try {
      const priceLamports = solPerWholeToLamports(priceInput);
      const atoms = resourceUnitsToAtoms(amountInput);
      const total = quoteTotalLamports(priceLamports, atoms);
      return { priceLamports, atoms, total, escrow: total + takerBufferLamports(total), error: false };
    } catch {
      return { priceLamports: null, atoms: null, total: null, escrow: null, error: priceInput !== '' || amountInput !== '' };
    }
  }, [priceInput, amountInput]);
  const displayName = (item: TradeResource) => names[nameId(item.key)] || item.key;

  async function cancel(order: ResourceOrderV2) {
    if (!address || !resource || !book || bookState !== 'ready' || busyRef.current || order.maker !== address) return;
    busyRef.current = true;
    setBusy(true);
    setNotice('cancelling');
    try {
      // Never act on a stale row: the PDA must still be the same owned order.
      const fresh = readOrderbookV2(await api.query.orderbookV2(resource.mint), resource.mint, resource.kind);
      if (walletRef.current !== address || resourceRef.current !== resource.mint) return;
      const rows = fresh && [...fresh.buy, ...fresh.sell, ...fresh.exhausted];
      if (!rows?.some(o => o.pubkey === order.pubkey && o.maker === address && o.isBuy === order.isBuy)) {
        setBook(null); setBookState('error'); setNotice('uncertain'); return;
      }
      const intent = { kind: 'orderbookV2', action: order.isBuy ? 'cancelBuy' : 'cancelSell', user: address, mint: resource.mint } as const;
      const response: any = order.isBuy
        ? await api.orderbook.cancelBuyV2({ maker: address, mint: resource.mint })
        : await api.orderbook.cancelSellV2({ maker: address, mint: resource.mint });
      if (walletRef.current !== address || resourceRef.current !== resource.mint) return;
      if (typeof response?.tx !== 'string') throw new Error('Missing cancellation transaction');
      const result = await handleTxResponse(response, intent);
      if (walletRef.current !== address || resourceRef.current !== resource.mint) return;
      if (!result.success) throw new Error(result.error || 'Cancellation not confirmed');
      setNotice('cancelled');
      await load(resource);
    } catch {
      if (walletRef.current === address && resourceRef.current === resource.mint) {
        setNotice('uncertain');
        setBook(null);
        setBookState('error');
      }
    } finally { busyRef.current = false; setBusy(false); }
  }

  async function placeOrder() {
    const owner = address, item = resource;
    if (!owner || !item || busyRef.current || bookState !== 'ready' || preview.error ||
        preview.priceLamports === null || preview.atoms === null) return;
    busyRef.current = true;
    setBusy(true);
    setFormNotice('working');
    try {
      const terms = {
        user: owner, mint: item.mint, resourceKind: item.kind,
        priceLamportsPerWhole: preview.priceLamports, amountAtoms: preview.atoms,
      };
      const response: any = side === 'buy'
        ? await api.orderbook.placeBuyV2({ maker: owner, mint: item.mint, kind: item.kind,
            priceLamportsPerWhole: preview.priceLamports, amountAtoms: preview.atoms })
        : await api.orderbook.placeSellV2({ maker: owner, mint: item.mint, kind: item.kind,
            priceLamportsPerWhole: preview.priceLamports, amountAtoms: preview.atoms });
      if (walletRef.current !== owner || resourceRef.current !== item.mint) return;
      // Эскроу сверяется с предпросмотром: если бэкенд вернул другой итог, кошелёк
      // получит намерение с тем же числом, что показано, и отказ до подписи.
      if (side === 'buy' && typeof response?.escrowLamports === 'string' &&
          BigInt(response.escrowLamports) !== preview.escrow) {
        setBook(null); setBookState('error'); setFormNotice('failed'); return;
      }
      const intent = side === 'buy'
        ? { kind: 'orderbookV2' as const, action: 'buy' as const, ...terms, escrowLamports: String(preview.escrow) }
        : { kind: 'orderbookV2' as const, action: 'sell' as const, ...terms };
      const result = await handleTxResponse(response, intent);
      if (walletRef.current !== owner || resourceRef.current !== item.mint) return;
      if (result.success || result.signature) {
        setFormNotice(result.success ? null : 'pending');
        setPriceInput(''); setAmountInput('');
        await load(item);
      } else setFormNotice('failed');
    } catch {
      if (walletRef.current === owner && resourceRef.current === item.mint) setFormNotice('failed');
    } finally { busyRef.current = false; setBusy(false); }
  }

  /** Permissionless: сводим лучшую пересекающуюся пару из книги. */
  async function matchBest() {
    const owner = address, item = resource, current = book;
    if (!owner || !item || !current || busyRef.current || bookState !== 'ready') return;
    const buy = [...current.buy].sort((a, b) => comparePriceV2(b, a))[0];
    const sell = [...current.sell].sort(comparePriceV2)[0];
    if (!buy || !sell || BigInt(buy.priceLamportsPerWhole) < BigInt(sell.priceLamportsPerWhole)) {
      setFormNotice('failed'); return;
    }
    busyRef.current = true;
    setBusy(true);
    setFormNotice('working');
    try {
      const fresh = readOrderbookV2(await api.query.orderbookV2(item.mint), item.mint, item.kind);
      if (walletRef.current !== owner || resourceRef.current !== item.mint) return;
      const stillThere = fresh && [...fresh.buy, ...fresh.sell]
        .some(o => o.pubkey === buy.pubkey && o.maker === buy.maker) &&
        [...fresh.buy, ...fresh.sell].some(o => o.pubkey === sell.pubkey && o.maker === sell.maker);
      if (!stillThere) { setFormNotice('failed'); await load(item); return; }
      const response = await api.orderbook.matchV2({
        caller: owner, mint: item.mint, buyOrder: buy.pubkey, sellOrder: sell.pubkey,
        buyMaker: buy.maker, sellMaker: sell.maker,
      });
      if (walletRef.current !== owner || resourceRef.current !== item.mint) return;
      // Казна — адрес из сети: без него кошелёк не сможет проверить, кому уходит
      // комиссия, поэтому отсутствие адреса — отказ, а не пустая строка.
      if (typeof response?.treasury !== 'string') { setFormNotice('failed'); return; }
      const result = await handleTxResponse(response, {
        kind: 'orderbookV2', action: 'match', user: owner, mint: item.mint,
        buyMaker: buy.maker, sellMaker: sell.maker, treasury: response.treasury,
      });
      if (walletRef.current !== owner || resourceRef.current !== item.mint) return;
      if (result.success || result.signature) { setFormNotice(result.success ? null : 'pending'); await load(item); }
      else setFormNotice('failed');
    } catch {
      if (walletRef.current === owner && resourceRef.current === item.mint) setFormNotice('failed');
    } finally { busyRef.current = false; setBusy(false); }
  }

  const row = (order: ResourceOrderV2) => {
    const mine = !!address && order.maker === address;
    return <div key={order.pubkey} className="flex flex-wrap items-center gap-x-2 gap-y-1 px-2 py-2 rounded-lg bg-soil-800/60 text-xs min-w-0">
      <span className="text-straw break-all">{shortAddr(order.maker)}{mine ? ` (${copy.you})` : ''}</span>
      <span className="text-straw">{order.isBuy ? copy.bids : copy.asks}</span>
      <span className="text-parchment ml-auto break-all">{formatResourceUnits(order.amountRemaining)} {copy.amountUnit}</span>
      <span className="text-wheat-500 font-semibold break-all">{price(order)}</span>
      {order.isBuy && <span className="text-straw break-all">{copy.escrowLabel}: {lamportsToSol(order.escrowLamports)} SOL</span>}
      {mine && <button type="button" onClick={() => cancel(order)} disabled={busy || bookState !== 'ready'}
        className="text-parchment underline underline-offset-2 disabled:opacity-40 break-words">{copy.cancel}</button>}
    </div>;
  };

  return <div className="p-4 pt-6 pb-24 space-y-4 min-w-0">
    <header className="flex items-center justify-between gap-2 min-w-0">
      <h1 className="text-2xl font-bold text-parchment flex items-center gap-2 min-w-0 break-words"><ResourceGlyph icon={UI_ICONS.marketOrderbook} alt="" className="w-7 h-7 shrink-0" />{copy.title}</h1>
      <button type="button" disabled={!resource || bookState === 'loading'} onClick={() => resource && load(resource)}
        className="text-xs text-straw px-3 py-1.5 rounded-lg bg-soil-800 border border-straw/20 whitespace-normal break-words disabled:opacity-40">{copy.refresh}</button>
    </header>
    <p className="text-straw text-xs break-words">{copy.intro}</p>
    <Card className="border border-wheat-600/40">
      <p className="text-wheat-500 text-sm font-semibold break-words">{copy.v2Badge}</p>
      <p className="text-straw text-xs mt-2 break-words">{copy.pausedWhatWorks}</p>
      <p className="text-straw text-xs mt-2 break-words">{copy.unitWarning}</p>
    </Card>
    <label className="block min-w-0 text-straw text-xs">
      {copy.select}
      <select value={resource?.key || ''} disabled={!resource} onChange={e => setSelectedKey(e.target.value)}
        className="block w-full mt-2 bg-soil-800 text-parchment text-sm rounded-xl border border-straw/20 px-4 py-3 focus:border-wheat-500 focus:outline-none min-w-0">
        {resources.map(item => <option key={item.key} value={item.key}>{displayName(item)}</option>)}
      </select>
    </label>
    {resource && <p className="text-xs text-straw break-words">{copy.selected}: {displayName(resource)}</p>}
    {!address && <p className="text-straw text-xs break-words">{copy.noWallet}</p>}
    {notice && <p role="status" className="text-parchment text-xs break-words">{copy[notice]}</p>}
    {!registry ? <p role="status" className="text-straw text-xs">{copy.loading}</p> : registry.length === 0 ?
      <p role="status" className="text-straw text-xs break-words">{copy.registryUnavailable}</p> :
      bookState !== 'ready' || !book ? <p role="status" className="text-straw text-xs break-words">{bookState === 'loading' ? copy.loading : copy.unavailable}</p> : <>
        <Card>
          <div className="flex flex-wrap justify-between gap-3 text-sm min-w-0">
            <div className="min-w-0"><p className="text-straw text-xs">{copy.bestBid}</p><p className="text-sprout-500 font-bold break-all">{bids[0] ? price(bids[0]) : '—'}</p></div>
            <div className="min-w-0 text-right"><p className="text-straw text-xs">{copy.bestAsk}</p><p className="text-wheat-500 font-bold break-all">{asks[0] ? price(asks[0]) : '—'}</p></div>
          </div>
          <p className="text-straw text-xs mt-2">{copy.priceUnit}</p>
        </Card>
        <Card>
          <h2 className="text-parchment font-semibold text-sm mb-2">{copy.formTitle}</h2>
          <p className="text-straw text-xs mb-3 break-words">{copy.formInfo}</p>
          {!address ? <p className="text-straw text-xs" role="status">{copy.noWallet}</p> : <>
            <div className="flex flex-wrap gap-2 mb-3">
              {(['buy', 'sell'] as const).map(value => <button key={value} type="button" onClick={() => setSide(value)}
                className={`px-3 py-2 rounded-xl text-xs border ${side === value ? 'bg-sprout-500 text-white border-sprout-500' : 'bg-soil-800 text-straw border-straw/20'}`}>
                {value === 'buy' ? copy.bids : copy.asks}
              </button>)}
            </div>
            <label className="block text-straw text-xs mb-2">{copy.priceLabel}
              <input type="text" inputMode="decimal" value={priceInput} onChange={e => setPriceInput(e.target.value.trim())}
                className="block w-full mt-1 bg-soil-800 border border-straw/20 rounded-xl px-3 py-2 text-parchment text-sm min-w-0" />
            </label>
            <label className="block text-straw text-xs mb-2">{copy.amountLabel}
              <input type="text" inputMode="decimal" value={amountInput} onChange={e => setAmountInput(e.target.value.trim())}
                className="block w-full mt-1 bg-soil-800 border border-straw/20 rounded-xl px-3 py-2 text-parchment text-sm min-w-0" />
            </label>
            {preview.error && <p className="text-wheat-500 text-xs mb-2 break-words" role="status">{copy.formInvalid}</p>}
            {preview.total !== null && preview.escrow !== null && <p className="text-parchment text-xs mb-2 break-words">
              {copy.quoteLine(lamportsToSol(preview.total.toString()), lamportsToSol(preview.escrow.toString()))}</p>}
            {formNotice && <p className="text-straw text-xs mb-2 break-words" role="status">{copy[formNotice === 'working' ? 'formWorking' : formNotice === 'pending' ? 'formPending' : 'formFailed']}</p>}
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy || bookState !== 'ready' || preview.error || !preview.total || !!formNotice}
                onClick={placeOrder}
                className="px-3 py-2 rounded-xl bg-sprout-500 text-white text-xs disabled:opacity-40 max-w-full [overflow-wrap:anywhere]">
                {side === 'buy' ? copy.placeBuyAction : copy.placeSellAction}
              </button>
              <button type="button" disabled={busy || bookState !== 'ready' || !bids.length || !asks.length || !!formNotice}
                onClick={matchBest}
                className="px-3 py-2 rounded-xl bg-soil-800 text-parchment text-xs border border-straw/20 disabled:opacity-40 max-w-full [overflow-wrap:anywhere]">
                {copy.matchAction}
              </button>
            </div>
            <p className="text-straw text-xs mt-2 break-words">{copy.matchInfo}</p>
          </>}
        </Card>
        <Card>
          <h2 className="text-parchment font-semibold text-sm mb-2">{copy.depth}</h2>
          {bids.length || asks.length ? <DepthChart bids={bids.map(o => ({ price: o.priceLamportsPerWhole, amount: o.amountRemaining }))}
            asks={asks.map(o => ({ price: o.priceLamportsPerWhole, amount: o.amountRemaining }))} language={language} /> :
            <p className="text-straw text-xs py-3">{copy.empty}</p>}
        </Card>
        <Card>
          <h2 className="text-parchment font-semibold text-sm mb-2">{copy.orders}</h2>
          {bids.length || asks.length ? <div className="space-y-1">{asks.map(row)}{bids.map(row)}</div> :
            <p className="text-straw text-xs py-3">{copy.empty}</p>}
        </Card>
        {ownedExhausted.length > 0 && <Card>
          <h2 className="text-parchment font-semibold text-sm mb-2">{copy.exhausted}</h2>
          <p className="text-straw text-xs mb-3 break-words">{copy.exhaustedInfo}</p>
          <div className="space-y-1">{ownedExhausted.map(row)}</div>
        </Card>}
      </>}
  </div>;
}
