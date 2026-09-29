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
import { readOrderbook, comparePrice, formatResourceUnits, priceSolPerResource, type Orderbook, type ResourceOrder } from '../../lib/orderbookReadings';
import { ResourceGlyph } from '../../components/visual/ResourceGlyph';
import { UI_ICONS } from '../../lib/visualAssets';

// Contract price is lamports PER ATOMIC token, while the previous form claimed
// SOL per whole resource. At 9 decimals, the previous UI could deposit 10^9
// times the indicated total. Do not re-enable placement/matching without a
// contract-level price migration AND a wallet-bound transaction intent.
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
  const [book, setBook] = useState<Orderbook | null>(null);
  const [bookState, setBookState] = useState<'loading' | 'ready' | 'error'>('loading');
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
      const result = readOrderbook(await api.query.orderbook(selected.mint), selected.mint, selected.kind);
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

  const bids = useMemo(() => [...(book?.buy || [])].sort((a, b) => comparePrice(b, a)), [book]);
  const asks = useMemo(() => [...(book?.sell || [])].sort(comparePrice), [book]);
  const ownedExhausted = book?.exhausted.filter(o => !!address && o.maker === address) || [];
  const price = (o: ResourceOrder) => `${priceSolPerResource(o.priceLamportsPerUnit, language)} SOL`;
  const displayName = (item: TradeResource) => names[nameId(item.key)] || item.key;

  async function cancel(order: ResourceOrder) {
    if (!address || !resource || !book || bookState !== 'ready' || busyRef.current || order.maker !== address) return;
    busyRef.current = true;
    setBusy(true);
    setNotice('cancelling');
    try {
      // Never act on a stale row: the PDA must still be the same owned order.
      const fresh = readOrderbook(await api.query.orderbook(resource.mint), resource.mint, resource.kind);
      if (walletRef.current !== address || resourceRef.current !== resource.mint) return;
      const rows = fresh && [...fresh.buy, ...fresh.sell, ...fresh.exhausted];
      if (!rows?.some(o => o.pubkey === order.pubkey && o.maker === address && o.isBuy === order.isBuy)) {
        setBook(null); setBookState('error'); setNotice('uncertain'); return;
      }
      const response: any = order.isBuy
        ? await api.orderbook.cancelBuy({ maker: address, mint: resource.mint })
        : await api.orderbook.cancelSell({ maker: address, mint: resource.mint });
      if (walletRef.current !== address || resourceRef.current !== resource.mint) return;
      if (typeof response?.tx !== 'string') throw new Error('Missing cancellation transaction');
      const result = await handleTxResponse(response);
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

  const row = (order: ResourceOrder) => {
    const mine = !!address && order.maker === address;
    return <div key={order.pubkey} className="flex flex-wrap items-center gap-x-2 gap-y-1 px-2 py-2 rounded-lg bg-soil-800/60 text-xs min-w-0">
      <span className="text-straw break-all">{shortAddr(order.maker)}{mine ? ` (${copy.you})` : ''}</span>
      <span className="text-straw">{order.isBuy ? copy.bids : copy.asks}</span>
      <span className="text-parchment ml-auto break-all">{formatResourceUnits(order.amountRemaining)} {copy.amountUnit}</span>
      <span className="text-wheat-500 font-semibold break-all">{price(order)}</span>
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
      <p className="text-wheat-500 text-sm font-semibold break-words">{copy.paused}</p>
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
          <h2 className="text-parchment font-semibold text-sm mb-2">{copy.depth}</h2>
          {bids.length || asks.length ? <DepthChart bids={bids.map(o => ({ price: o.priceLamportsPerUnit, amount: o.amountRemaining }))}
            asks={asks.map(o => ({ price: o.priceLamportsPerUnit, amount: o.amountRemaining }))} language={language} /> :
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
