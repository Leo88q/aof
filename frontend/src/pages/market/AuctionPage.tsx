import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "../../lib/associatedToken";
import { api } from "../../lib/api";
import { handleTxResponse } from "../../lib/txFlow";
import { actionErrorFeedback } from "../../lib/txResponseFeedback";
import { walletRuntimeCopy } from "../../i18n/walletRuntimeCopy";
import { useWalletStore } from "../../store/walletStore";
import { useLocale } from "../../i18n/LocaleProvider";
import { auctionCopy } from "../../i18n/auctionCopy";
import { toolName, toolsCopy } from "../../i18n/toolsCopy";
import { TOOL_RARITIES, type ToolRarity } from "../../lib/visualAssets";
import { Lamp, Panel, Readout, Readouts, Sticker } from "../../ui/forge/kit";
import { SonarPPI } from "../../ui/forge/devices";
import { ArtPlate } from "../../components/visual/ArtPlate";
import { toolPlate, UI_ICONS } from "../../lib/visualAssets";
import { ResourceGlyph } from "../../components/visual/ResourceGlyph";
import {
  RARITY_COLOR, rarityKey,
  fmtSol, shortAddr, toNum, useNow, useTreasury, useFlash,
} from "../../lib/marketUtils";
import { NoticeMsg } from "../../components/visual/NoticeMsg";

const SYSTEM_KEY = "11111111111111111111111111111111";

export function AuctionPage() {
  const { language } = useLocale();
  const copy = auctionCopy[language];
  const rarityLabel = (rarity: string) => {
    const index = TOOL_RARITIES.indexOf(rarity as ToolRarity);
    return index < 0 ? toolsCopy[language].card.unknownRarity : toolsCopy[language].collectionPage.rarities[index];
  };
  const timeRemaining = (untilSec: number) => {
    const seconds = Math.max(0, Math.floor(untilSec - now / 1000));
    if (!seconds) return copy.finished;
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days) return `${days}${copy.day} ${hours}${copy.hour}`;
    if (hours) return `${hours}${copy.hour} ${minutes}${copy.minute}`;
    return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
  };
  const { address } = useWalletStore();
  const treasury = useTreasury();
  const now = useNow(1000);
  const [auctions, setAuctions] = useState<any[]>([]);
  const [myTools, setMyTools] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [txStatus, flash] = useFlash(language);
  const [statusLanguage, setStatusLanguage] = useState(language);
  const notify = (message: string) => { setStatusLanguage(language); flash(message); };
  const responseNotice = (message: string, signature?: string) =>
    signature ? `${message}: ${signature.slice(0, 10)}…` : message;
  const [bids, setBids] = useState<Record<string, string>>({});
  const [formOpen, setFormOpen] = useState(false);
  const [selMint, setSelMint] = useState("");
  const [minBidSol, setMinBidSol] = useState("0.05");
  const [durationH, setDurationH] = useState("24");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list: any = await api.query.auctions();
      const arr: any[] = Array.isArray(list) ? list : [];
      const withMeta = await Promise.all(
        arr.map(async (a) => ({ ...a, tool: await api.query.tool(a.mint).catch(() => null) }))
      );
      setAuctions(withMeta);
    } catch (e) {
      console.error("auctions:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!address) return;
    api.query.myTools(address)
      .then((r: any) => {
        const a: any[] = Array.isArray(r) ? r : r?.tools || [];
        setMyTools(a.filter((t) => !t.staked && !t.isMining));
      })
      .catch(() => {});
  }, [address]);

  async function bid(a: any) {
    if (!address) return notify(copy.connect);
    const lamports = Math.round(parseFloat(bids[a.mint] || "0") * 1e9);
    if (!isFinite(lamports) || lamports <= 0) return notify(copy.invalidBid);
    try {
      // Возврат предыдущей ставки: предыдущий bidder, а если ставок ещё не было — продавец
      const prev = a.highestBidder && a.highestBidder !== SYSTEM_KEY ? a.highestBidder : a.seller;
      notify(copy.placingBid);
      const resp = await api.auction.bid({ bidder: address, mint: a.mint, amount: String(lamports), previousBidder: prev });
      const r = await handleTxResponse(resp);
      notify(r.success ? responseNotice(copy.bidResponse, r.signature) : (r.error || walletRuntimeCopy[language].unconfirmedResponse));
      if (r.success) setTimeout(load, 2500);
    } catch (e: any) {
      notify(actionErrorFeedback(e, language, walletRuntimeCopy[language].unconfirmedResponse));
    }
  }

  async function settle(a: any) {
    if (!address) return notify(copy.connect);
    if (!treasury) return notify(copy.treasuryUnavailable);
    const winner = a.highestBidder;
    if (!winner || winner === SYSTEM_KEY) return notify(copy.noBidsSettle);
    try {
      const winnerToken = getAssociatedTokenAddressSync(
        new PublicKey(a.mint), new PublicKey(winner), true
      ).toBase58();
      notify(copy.settling);
      const resp = await api.auction.settle({
        caller: address, mint: a.mint, seller: a.seller, treasury, winnerToken,
      });
      const r = await handleTxResponse(resp);
      notify(r.success ? responseNotice(copy.settleResponse, r.signature) : (r.error || walletRuntimeCopy[language].unconfirmedResponse));
      if (r.success) setTimeout(load, 2500);
    } catch (e: any) {
      notify(actionErrorFeedback(e, language, walletRuntimeCopy[language].unconfirmedResponse));
    }
  }

  async function createAuction() {
    if (!address) return notify(copy.connect);
    if (!selMint) return notify(copy.selectTool);
    const minBid = Math.round(parseFloat(minBidSol) * 1e9);
    const dur = Math.round(parseFloat(durationH) * 3600);
    if (!isFinite(minBid) || minBid <= 0) return notify(copy.invalidMinBid);
    if (!isFinite(dur) || dur <= 0) return notify(copy.invalidDuration);
    try {
      notify(copy.creating);
      const resp = await api.auction.create({
        seller: address, mint: selMint, minBid: String(minBid), durationSeconds: String(dur),
      });
      const r = await handleTxResponse(resp);
      notify(r.success ? responseNotice(copy.createResponse, r.signature) : (r.error || walletRuntimeCopy[language].unconfirmedResponse));
      if (r.success) {
        setFormOpen(false);
        setSelMint("");
        setTimeout(load, 2500);
      }
    } catch (e: any) {
      notify(actionErrorFeedback(e, language, walletRuntimeCopy[language].unconfirmedResponse));
    }
  }

  return (
    <div className="p-4 pt-6 pb-24 space-y-4">
      {/* К6 · сонар аукционов: отметка — лот, радиус — текущая ставка отн.
          самой крупной. Свежие ставки горят лампами, выдуманных чисел нет. */}
      <Panel
        tier="panel"
        device="sonar"
        id={<Sticker>{copy.sticker}</Sticker>}
        meta={loading ? copy.reading : `${copy.lotCount} ${auctions.length}`}
        title={copy.hall}
        sub={copy.subtitle}
      >
        {auctions.length > 0 ? (() => {
          const tops = auctions.map((a: any) => toNum(a.highestBid) || toNum(a.minBid));
          const maxTop = Math.max(...tops, 0.000001);
          const blips = auctions.slice(0, 24).map((a: any, i: number, arr: any[]) => {
            const angle = (-90 + (i / Math.max(1, arr.length)) * 360) * (Math.PI / 180);
            const r = 9 + 43 * Math.min(1, (toNum(a.highestBid) || toNum(a.minBid)) / maxTop);
            return { x: 60 + r * Math.cos(angle), y: 60 + r * Math.sin(angle), r: 2.2 };
          });
          return (
            <SonarPPI
              ariaLabel={copy.hall}
              blips={blips}
              legend={
                <>
                  <span>{copy.lots}: <b>{auctions.length}</b></span>
                  <span>{copy.withBids}: <b>{auctions.filter((a: any) => toNum(a.highestBid) > 0).length}</b></span>
                  <span>{copy.highest}: <b>{fmtSol(maxTop, language)} ◎</b></span>
                </>
              }
            />
          );
        })() : (
          <p className="fg-note fg-note--quiet" style={{ margin: 0 }}>{copy.emptySonar}</p>
        )}
        <div style={{ marginTop: 14 }}>
          <Readouts>
            <Readout label={copy.lots} value={String(auctions.length)} hint={copy.activeHint} />
            <Readout
              label={copy.withBids}
              value={String(auctions.filter((a: any) => toNum(a.highestBid) > 0).length)}
              hint={copy.leaderHint}
            />
            <Readout
              label={copy.endingSoon}
              value={String(auctions.filter((a: any) => {
                const ends = toNum(a.endsAt) * 1000;
                return ends > now && ends - now < 5 * 60 * 1000;
              }).length)}
              hint={copy.endingSoonHint}
            />
          </Readouts>
        </div>
      </Panel>

      <div className="flex justify-end">
        <button onClick={load} className="fg-key fg-key--tiny" type="button">
          {loading ? copy.reading : copy.refresh}
        </button>
      </div>

      {txStatus && statusLanguage === language && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="text-xs px-3 py-2 rounded-xl bg-soil-800 border border-straw/20 text-parchment">
          <NoticeMsg text={txStatus} />
        </motion.div>
      )}

      {auctions.length === 0 && !loading && (
        <Panel tier="panel" className="text-center py-8">
          <div className="mb-2"><ResourceGlyph icon={UI_ICONS.auction} alt="" className="w-12 h-12 mx-auto" /></div>
          <p className="text-parchment text-sm">{copy.noAuctions}</p>
          <p className="text-straw text-xs mt-1">{copy.emptyHint}</p>
        </Panel>
      )}

      <div className="grid grid-cols-1 gap-3">
        {auctions.map((a, i) => {
          const rk = rarityKey(a.tool?.rarity);
          const endsMs = toNum(a.endsAt) * 1000;
          const ended = endsMs <= now;
          const lastFiveMin = !ended && endsMs - now < 5 * 60 * 1000;
          const topBid = toNum(a.highestBid);
          return (
            <motion.div key={a.pubkey || a.mint} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}>
              <Panel tier="panel" className={"mb-3" + (lastFiveMin ? " fg--hot" : "")}>
                <div className="flex flex-wrap items-center gap-3">
                  <ArtPlate src={toolPlate(a.tool?.toolType, rk)} alt={toolName(language, a.tool?.toolType)} size={56} />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-parchment font-semibold text-sm">{toolName(language, a.tool?.toolType)}</span>
                      <span className={`text-xs ${RARITY_COLOR[rk] || "text-straw"}`}>{rarityLabel(rk)}</span>
                    </div>
                    <p className="text-straw text-xs mt-0.5">
                      {shortAddr(a.mint)} · {copy.seller} {shortAddr(a.seller)}
                    </p>
                    <p className="text-xs mt-1">
                      {topBid > 0 ? (
                        <span className="text-wheat-500 font-bold">{copy.bidAmount}: {fmtSol(topBid, language)} ◎</span>
                      ) : (
                        <span className="text-straw">{copy.noBids} · {copy.minimum} {fmtSol(a.minBid, language)} ◎</span>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <Lamp tone={ended ? "wait" : lastFiveMin ? "err" : "ok"}>
                      {ended ? copy.closed : lastFiveMin ? copy.urgent : copy.live}
                    </Lamp>
                    <div className="fg-num" style={{ marginTop: 4, fontSize: 12, color: "var(--fg-text)" }}>
                      {timeRemaining(toNum(a.endsAt))}
                    </div>
                  </div>
                </div>

                {!ended && (
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <input
                      type="number" step="0.001" min="0" placeholder={copy.bidPlaceholder} aria-label={copy.bidPlaceholder}
                      value={bids[a.mint] || ""}
                      onChange={(e) => setBids((s) => ({ ...s, [a.mint]: e.target.value }))}
                      className="fg-input min-w-0 flex-1"
                    />
                    <button onClick={() => bid(a)}
                      className="fg-key fg-key--primary fg-key--tiny whitespace-normal break-words">
                      {copy.bidAction}
                    </button>
                  </div>
                )}

                {ended && (
                  <button onClick={() => settle(a)}
                    className="mt-3 w-full py-2 rounded-xl bg-wheat-600 text-white text-sm font-semibold break-words">
                    {copy.settle}
                  </button>
                )}
              </Panel>
            </motion.div>
          );
        })}
      </div>

      <Panel tier="panel">
        <button type="button" className="w-full flex items-center justify-between gap-2 text-left break-words" aria-expanded={formOpen} onClick={() => setFormOpen((v) => !v)}>
          <div className="text-left">
            <div className="text-parchment font-semibold text-sm">{copy.create}</div>
            <div className="text-straw text-xs">{copy.formHint}</div>
          </div>
          <span className="text-straw">{formOpen ? "−" : "+"}</span>
        </button>
        {formOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 space-y-2">
            {!address && <p className="text-straw text-xs">{copy.connectTools}</p>}
            {address && myTools.length === 0 && (
              <p className="text-straw text-xs">{copy.noTools}</p>
            )}
            {myTools.map((t) => {
              const rk = rarityKey(t.rarity);
              return (
                <button key={t.mint} onClick={() => setSelMint(t.mint)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-left ${selMint === t.mint ? "border-wheat-500 bg-wheat-500/10" : "border-straw/15 bg-soil-800/60"}`}>
                  <ArtPlate src={toolPlate(t.toolType, rk)} alt={toolName(language, t.toolType)} size={36} />
                  <span className="flex-1 min-w-0 text-sm text-parchment break-words">
                    {toolName(language, t.toolType)} <span className={`text-xs ${RARITY_COLOR[rk]}`}>({rarityLabel(rk)})</span>
                  </span>
                  {selMint === t.mint && <span className="text-wheat-500">✓</span>}
                </button>
              );
            })}
            <div className="flex items-center gap-2 pt-2">
              <label htmlFor="auction-min-bid" className="text-straw text-xs min-w-0 w-28 shrink-0 break-words">{copy.minBid}</label>
              <input id="auction-min-bid" type="number" step="0.001" min="0" value={minBidSol} onChange={(e) => setMinBidSol(e.target.value)}
                className="fg-input min-w-0 flex-1" />
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="auction-duration" className="text-straw text-xs min-w-0 w-28 shrink-0 break-words">{copy.durationHours}</label>
              <input id="auction-duration" type="number" step="1" min="1" value={durationH} onChange={(e) => setDurationH(e.target.value)}
                className="fg-input min-w-0 flex-1" />
            </div>
            <button onClick={createAuction} disabled={!selMint}
              className="btn btn-primary whitespace-normal break-words">
              {copy.create}
            </button>
          </motion.div>
        )}
      </Panel>
    </div>
  );
}
