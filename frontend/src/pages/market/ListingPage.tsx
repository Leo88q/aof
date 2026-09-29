import { solToLamports, lamportsToSol } from "../../lib/amounts";
import type { MarketplaceBuyIntent } from "../../lib/transactionIntent";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../../lib/api";
import { handleTxResponse } from "../../lib/txFlow";
import { actionErrorFeedback } from "../../lib/txResponseFeedback";
import { walletRuntimeCopy } from "../../i18n/walletRuntimeCopy";
import { readFreeTools, readMarketListings, readListingTreasury, type FreeTool, type MarketListing } from "../../lib/listingReadings";
import { useWalletStore } from "../../store/walletStore";
import { useLocale } from "../../i18n/LocaleProvider";
import { listingCopy } from "../../i18n/listingCopy";
import { toolName, toolsCopy } from "../../i18n/toolsCopy";
import { Card } from "../../components/ui/Card";
import { Panel, Readout, Readouts, Sticker } from "../../ui/forge/kit";
import { SonarPPI } from "../../ui/forge/devices";
import { ArtPlate } from "../../components/visual/ArtPlate";
import { toolPlate, TOOL_RARITIES, UI_ICONS, type ToolRarity } from "../../lib/visualAssets";
import { ResourceGlyph } from "../../components/visual/ResourceGlyph";
import { RARITY_COLOR, rarityKey, shortAddr } from "../../lib/marketUtils";
import { NoticeMsg } from "../../components/visual/NoticeMsg";

function knownRarity(value: unknown): ToolRarity | null {
  if (value == null) return null;
  const key = rarityKey(value);
  return TOOL_RARITIES.includes(key as ToolRarity) ? key as ToolRarity : null;
}

export function ListingPage() {
  const { language } = useLocale();
  const copy = listingCopy[language];
  const { address } = useWalletStore();
  const [treasury, setTreasury] = useState<string | null>(null);
  const [treasuryStatus, setTreasuryStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [listings, setListings] = useState<MarketListing[] | null>(null);
  const [loading, setLoading] = useState(true);
  const listingsRequest = useRef(0);
  const [owned, setOwned] = useState<{ address: string; items: FreeTool[] } | null>(null);
  const [ownedState, setOwnedState] = useState<'loading' | 'ready' | 'error' | 'disconnected'>('disconnected');
  const [toolsRefresh, setToolsRefresh] = useState(0);
  const [notice, setNotice] = useState<{ language: typeof language; text: string } | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [selection, setSelection] = useState<{ address: string; mint: string } | null>(null);
  const [priceSol, setPriceSol] = useState("0.1");

  const flash = (message: string) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice({ language, text: message });
    noticeTimer.current = setTimeout(() => setNotice(null), 7000);
  };
  useEffect(() => {
    setNotice(null);
    return () => { if (noticeTimer.current) clearTimeout(noticeTimer.current); };
  }, [address, language]);

  const load = useCallback(async () => {
    const request = ++listingsRequest.current;
    setLoading(true);
    setListings(null);
    try {
      const rows = readMarketListings(await api.query.listings());
      if (rows === null) throw new Error("Incomplete listing response");
      // Metadata is optional. A failed tool lookup never invents a type or rarity.
      const withMeta = await Promise.all(rows.map(async row => ({
        ...row, tool: await api.query.tool(row.mint).catch(() => null),
      })));
      if (request === listingsRequest.current) setListings(withMeta);
    } catch {
      if (request === listingsRequest.current) setListings(null);
    } finally {
      if (request === listingsRequest.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    return () => {
      listingsRequest.current++;
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [load]);

  useEffect(() => {
    let active = true;
    api.query.config().then(raw => {
      if (!active) return;
      const verified = readListingTreasury(raw);
      setTreasury(verified);
      setTreasuryStatus(verified ? 'ready' : 'error');
    }).catch(() => { if (active) { setTreasury(null); setTreasuryStatus('error'); } });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setOwned(null);
    if (!address) { setOwnedState('disconnected'); return () => { active = false; }; }
    setOwnedState('loading');
    api.query.myTools(address).then(raw => {
      if (!active) return;
      const items = readFreeTools(raw, address);
      if (!items) throw new Error('Incomplete inventory response');
      setOwned({ address, items });
      setOwnedState('ready');
    }).catch(() => { if (active) { setOwned(null); setOwnedState('error'); } });
    return () => { active = false; };
  }, [address, toolsRefresh]);

  const myTools = address && ownedState === 'ready' && owned?.address === address ? owned.items : null;
  const selectedMint = selection?.address === address ? selection.mint : '';
  const selectableTools = myTools?.filter(tool => !listings?.some(row => row.mint === tool.mint)) ?? null;
  let validPrice: string | null = null;
  try { validPrice = solToLamports(priceSol); } catch { /* invalid input is shown, not sent */ }
  const formatPrice = (value: string) => `${lamportsToSol(value)} ◎`;
  const rarityLabel = (rarity: ToolRarity | null) => rarity
    ? toolsCopy[language].collectionPage.rarities[TOOL_RARITIES.indexOf(rarity)]
    : toolsCopy[language].card.unknownRarity;
  const scheduleReload = () => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(load, 2500);
  };
  const fail = (error: unknown) => flash(actionErrorFeedback(error, language, walletRuntimeCopy[language].unconfirmedResponse));

  async function buy(row: MarketListing) {
    if (inFlight.current) return;
    if (!address) return flash(copy.connect);
    if (!treasury) return flash(copy.treasuryUnavailable);
    inFlight.current = true; setBusy(true);
    try {
      flash(copy.preparingBuy);
      // The intent binds the exact listing, seller, treasury and price ceiling;
      // the wallet verifies the returned transaction before signing.
      const intent: MarketplaceBuyIntent = Object.freeze({
        kind: "marketplaceBuy", buyer: address, seller: row.seller, treasury, mint: row.mint,
        maxPriceLamports: row.priceLamports,
        expiresAt: String(Math.floor(Date.now() / 1000) + 120),
      });
      const { kind: _kind, ...request } = intent;
      const response = await api.marketplace.buy(request);
      if (useWalletStore.getState().address !== address) { flash(copy.walletChanged); return; }
      if (!response?.tx) { flash(copy.actionFailed); return; }
      const result = await handleTxResponse(response, intent);
      if (result.success && result.signature) {
        flash(`${copy.bought}: ${result.signature.slice(0, 10)}…`);
        window.dispatchEvent(new CustomEvent("aof:refresh"));
        scheduleReload();
      } else flash(result.error || walletRuntimeCopy[language].unconfirmedResponse);
    } catch (error) { fail(error); }
    finally { inFlight.current = false; setBusy(false); }
  }

  async function cancel(row: MarketListing) {
    if (inFlight.current) return;
    if (!address) return flash(copy.connect);
    inFlight.current = true; setBusy(true);
    try {
      flash(copy.preparingCancel);
      const response = await api.marketplace.cancel({ seller: address, mint: row.mint });
      if (useWalletStore.getState().address !== address) { flash(copy.walletChanged); return; }
      if (!response?.tx) { flash(copy.actionFailed); return; }
      const result = await handleTxResponse(response);
      if (result.success && result.signature) {
        flash(`${copy.cancelled}: ${result.signature.slice(0, 10)}…`);
        window.dispatchEvent(new CustomEvent("aof:refresh"));
        scheduleReload();
        setToolsRefresh(value => value + 1);
      } else flash(result.error || walletRuntimeCopy[language].unconfirmedResponse);
    } catch (error) { fail(error); }
    finally { inFlight.current = false; setBusy(false); }
  }

  async function createListing() {
    if (inFlight.current) return;
    if (!address) return flash(copy.connect);
    if (!selectedMint || !selectableTools?.some(tool => tool.mint === selectedMint)) return flash(copy.selectTool);
    if (!validPrice) return flash(copy.invalidPrice);
    inFlight.current = true; setBusy(true);
    try {
      // The list of available tools can change while the form is open.
      const fresh = readFreeTools(await api.query.myTools(address), address);
      if (!fresh) { flash(copy.toolsUnavailable); return; }
      if (!fresh.some(tool => tool.mint === selectedMint)) { flash(copy.toolUnavailable); return; }
      if (useWalletStore.getState().address !== address) { flash(copy.walletChanged); return; }
      flash(copy.preparingList);
      const response = await api.marketplace.list({ seller: address, mint: selectedMint, priceLamports: validPrice });
      if (useWalletStore.getState().address !== address) { flash(copy.walletChanged); return; }
      if (!response?.tx) { flash(copy.actionFailed); return; }
      const result = await handleTxResponse(response);
      if (result.success && result.signature) {
        flash(`${copy.listed}: ${result.signature.slice(0, 10)}…`);
        setFormOpen(false);
        setSelection(null);
        window.dispatchEvent(new CustomEvent("aof:refresh"));
        scheduleReload();
        setToolsRefresh(value => value + 1);
      } else flash(result.error || walletRuntimeCopy[language].unconfirmedResponse);
    } catch (error) { fail(error); }
    finally { inFlight.current = false; setBusy(false); }
  }

  return (
    <div lang={language} className="listing-page p-4 pt-6 pb-24 space-y-4 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3 min-w-0">
        <h1 className="text-2xl font-bold text-parchment flex items-center gap-2 min-w-0 break-words">
          <img src={UI_ICONS.marketListing} alt="" className="w-6 h-6 object-contain shrink-0" />
          {copy.title}
        </h1>
        <button type="button" onClick={load} disabled={loading} className="text-xs text-straw px-3 py-1.5 rounded-lg bg-soil-800 border border-straw/20 disabled:opacity-60">
          {loading ? copy.loading : copy.refresh}
        </button>
      </div>
      <p className="text-straw text-xs leading-relaxed">{copy.intro}</p>
      {notice?.language === language && (
        <motion.div role="status" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="text-xs px-3 py-2 rounded-xl bg-soil-800 border border-straw/20 text-parchment break-words">
          <NoticeMsg text={notice.text} />
        </motion.div>
      )}
      {loading && <p role="status" className="text-straw text-sm">{copy.loading}</p>}
      {!loading && listings === null && (
        <Card className="p-4 border border-gold-500/30">
          <p role="status" className="text-gold-400 text-sm">{copy.listingsUnavailable}</p>
          <button type="button" onClick={load} className="mt-2 text-xs text-parchment underline">{copy.refresh}</button>
        </Card>
      )}

      {listings !== null && listings.length > 0 && (() => {
        const sorted = [...listings].sort((a, b) =>
          BigInt(a.priceLamports) < BigInt(b.priceLamports) ? -1 : BigInt(a.priceLamports) > BigInt(b.priceLamports) ? 1 : 0);
        const max = BigInt(sorted[sorted.length - 1].priceLamports);
        const blips = listings.slice(0, 24).map((row, i, arr) => {
          const angle = (-90 + (i / Math.max(1, arr.length)) * 360) * (Math.PI / 180);
          const ratio = Number(BigInt(row.priceLamports) * 10000n / max) / 10000;
          const radius = 9 + 43 * ratio;
          return { x: 60 + radius * Math.cos(angle), y: 60 + radius * Math.sin(angle), r: 2.2 };
        });
        return (
          <Panel tier="panel" device="sonar" className="mb-2"
            id={<Sticker>{copy.sticker}</Sticker>} meta={copy.sonarMeta}
            title={copy.sonarTitle} sub={copy.sonarSub}>
            <SonarPPI ariaLabel={copy.sonarTitle} blips={blips} legend={<>
              <span>{copy.count}: <b>{listings.length}</b></span>
              <span>{copy.cheapest}: <b>{formatPrice(sorted[0].priceLamports)}</b></span>
              <span>{copy.median}: <b>{formatPrice(sorted[Math.floor(sorted.length / 2)].priceLamports)}</b></span>
              <span>{copy.highest}: <b>{formatPrice(sorted[sorted.length - 1].priceLamports)}</b></span>
            </>} />
            <div style={{ marginTop: 14 }}><Readouts>
              <Readout label={copy.count} value={String(listings.length)} hint={copy.onMarket} />
              <Readout label={copy.yours} value={address ? String(listings.filter(row => row.seller === address).length) : undefined}
                dash={!address} hint={copy.signedByYou} />
            </Readouts></div>
          </Panel>
        );
      })()}

      {listings !== null && listings.length === 0 && !loading && (
        <Card className="text-center py-8">
          <div className="mb-2"><ResourceGlyph icon={UI_ICONS.marketListing} alt="" className="w-12 h-12 mx-auto" /></div>
          <p className="text-parchment text-sm">{copy.empty}</p>
          <p className="text-straw text-xs mt-1">{copy.emptyHint}</p>
        </Card>
      )}

      {listings !== null && <div className="grid grid-cols-1 gap-3">
        {listings.map((row, i) => {
          const rarity = knownRarity(row.tool?.rarity);
          const name = toolName(language, row.tool?.toolType);
          const mine = !!address && row.seller === address;
          return (
            <motion.div key={row.pubkey || row.mint} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}>
              <Card className={`border ${mine ? "border-wheat-600/40" : "border-straw/10"}`}>
                <div className="flex flex-wrap items-center gap-3 min-w-0">
                  <ArtPlate src={rarity ? toolPlate(row.tool?.toolType, rarity) : undefined} alt={name} size={56} className="shrink-0" />
                  <div className="flex-1 min-w-[120px] break-words">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-parchment font-semibold text-sm">{name}</span>
                      <span className={`text-xs ${rarity ? RARITY_COLOR[rarity] : 'text-straw'}`}>{rarityLabel(rarity)}</span>
                    </div>
                    <p className="text-straw text-xs mt-0.5 break-all">
                      {shortAddr(row.mint)} · {copy.seller} {shortAddr(row.seller)}{mine ? ` (${copy.you})` : ''}
                    </p>
                  </div>
                  <div className="min-w-0 flex flex-wrap items-center gap-2 sm:block sm:text-right">
                    <div className="text-wheat-500 font-bold break-all">{formatPrice(row.priceLamports)}</div>
                    {mine ? (
                      <button type="button" onClick={() => cancel(row)} disabled={busy}
                        className="sm:mt-1 text-xs px-3 py-1 rounded-lg bg-soil-700 border border-straw/20 text-straw disabled:opacity-50">{copy.cancel}</button>
                    ) : (
                      <button type="button" onClick={() => buy(row)} disabled={!address || !treasury || busy}
                        className="sm:mt-1 text-xs px-4 py-1 rounded-lg bg-sprout-500 text-white font-medium disabled:opacity-50">{copy.buy}</button>
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>}
      {listings !== null && listings.length > 0 && treasuryStatus !== 'ready' &&
        <p className="text-straw text-xs" role="status">
          {treasuryStatus === 'loading' ? copy.treasuryLoading : copy.treasuryUnavailable}
        </p>}

      <Card>
        <button type="button" aria-expanded={formOpen} className="w-full flex items-center justify-between gap-2 min-w-0 text-left"
          onClick={() => setFormOpen(value => !value)}>
          <span className="min-w-0 break-words">
            <span className="text-parchment font-semibold text-sm block">{copy.listTitle}</span>
            <span className="text-straw text-xs block">{copy.fixedPrice}</span>
          </span>
          <span className="text-straw shrink-0" aria-hidden="true">{formOpen ? '−' : '+'}</span>
        </button>
        {formOpen && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 space-y-2 min-w-0">
          {!address && <p className="text-straw text-xs">{copy.connectTools}</p>}
          {address && ownedState === 'loading' && <p className="text-straw text-xs" role="status">{copy.readingTools}</p>}
          {address && ownedState === 'error' && <p className="text-gold-400 text-xs" role="status">{copy.toolsUnavailable}</p>}
          {address && myTools !== null && selectableTools?.length === 0 && <p className="text-straw text-xs">{copy.noTools}</p>}
          {selectableTools?.map(tool => {
            const rarity = knownRarity(tool.rarity);
            const name = toolName(language, tool.toolType);
            return (
              <button key={tool.mint} type="button" onClick={() => setSelection({ address: address!, mint: tool.mint })}
                aria-pressed={selectedMint === tool.mint}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-left min-w-0 ${selectedMint === tool.mint ? "border-wheat-500 bg-wheat-500/10" : "border-straw/15 bg-soil-800/60"}`}>
                <ArtPlate src={rarity ? toolPlate(tool.toolType, rarity) : undefined} alt={name} size={36} className="shrink-0" />
                <span className="flex-1 min-w-0 text-sm text-parchment break-words">
                  {name} <span className={`text-xs ${rarity ? RARITY_COLOR[rarity] : 'text-straw'}`}>({rarityLabel(rarity)})</span>
                </span>
                {selectedMint === tool.mint && <span className="text-wheat-500 shrink-0" aria-hidden="true">✓</span>}
              </button>
            );
          })}
          <label className="flex flex-wrap items-center gap-2 pt-2 min-w-0">
            <span className="text-straw text-xs">{copy.price}</span>
            <input type="number" inputMode="decimal" step="any" min="0" value={priceSol}
              onChange={event => setPriceSol(event.target.value)} aria-invalid={priceSol.length > 0 && !validPrice}
              className="flex-1 min-w-[110px] bg-soil-800 border border-straw/20 rounded-xl px-3 py-2 text-parchment text-sm" />
          </label>
          {priceSol.length > 0 && !validPrice && <p className="text-gold-400 text-xs">{copy.invalidPrice}</p>}
          <button type="button" onClick={createListing}
            disabled={!address || listings === null || !selectableTools?.some(tool => tool.mint === selectedMint) || !validPrice || busy}
            className="w-full py-2.5 rounded-xl bg-wheat-600 text-white font-semibold text-sm disabled:opacity-40 break-words">
            {copy.list}
          </button>
        </motion.div>}
      </Card>
    </div>
  );
}
