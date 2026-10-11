import { useEffect, useRef, useState } from "react";
import { useLocale } from "../../i18n/LocaleProvider";
import { profileCopy } from "../../i18n/profileCopy";
import { gameHeaders } from "../../i18n/gameHeaders";
import { readPlayerSnapshot, type PlayerSnapshot } from "../../lib/playerReadings";
import { api } from "../../lib/api";
import { handleTxResponse } from "../../lib/txFlow";
import type { PlayerInitIntent, PayerCostQuote } from "../../lib/transactionIntent";
import { formatLamportsAsSol } from "../../lib/formatLamports";
import { WalletButton } from "../../components/ui/WalletButton";
import { legalUiCopy } from "../../i18n/legalUiCopy";
import { ListRow } from "../../components/ListRow";
import { Key, Keys, Note, Panel, Readout, Readouts, Sticker } from "../../ui/forge/kit";
import { useWalletStr } from "../../lib/useWalletStr";
import { useNav } from "../../nav/NavContext";
import { NavHeader } from "../../components/NavHeader";
import { UI_ICONS } from "../../lib/visualAssets";
import { FriendsList } from "../friend/FriendsList";
import { SeasonPassPage } from "./SeasonPassPage";
import { TrustPage } from "./TrustPage";
import { PrivilegesPanel } from "../../components/PrivilegesPanel";
import { CollectorsPanel } from "../../components/CollectorsPanel";
import { QuestBoardPage } from "../quests/QuestBoardPage";
import { DailyRewardButton } from "../../components/DailyRewardButton";
import { RebirthPanel } from "../../components/RebirthPanel";
import { PortfolioHome } from "../portfolio/PortfolioHome";
import { LeaderboardPage } from "../social/LeaderboardPage";
import { PlayerRatingPage } from "../social/PlayerRatingPage";

type PlayerRead = { owner: string; kind: 'loading' | 'ready' | 'missing' | 'error'; player?: PlayerSnapshot };
type PreparedPlayerInit = { owner: string; response: { tx: string; quote: PayerCostQuote } };

export function ProfileHome() {
  const { language } = useLocale();
  const copy = profileCopy[language];
  const menu = gameHeaders[language];
  const user = useWalletStr();
  const { push } = useNav();
  const [reading, setReading] = useState<PlayerRead | null>(null);
  const [playerRevision, setPlayerRevision] = useState(0);
  const [preparedPlayerInit, setPreparedPlayerInit] = useState<PreparedPlayerInit | null>(null);
  const [playerInitStatus, setPlayerInitStatus] = useState<'idle' | 'preparing' | 'prepared' | 'failed' | 'pending' | 'success'>('idle');
  const [playerInitBusy, setPlayerInitBusy] = useState(false);
  const currentUser = useRef(user);
  currentUser.current = user;

  useEffect(() => {
    setPreparedPlayerInit(null);
    setPlayerInitStatus('idle');
  }, [user]);

  useEffect(() => {
    let active = true;
    if (!user) { setReading(null); return () => { active = false; }; }
    setReading({ owner: user, kind: 'loading' });
    api.query.player(user).then(raw => {
      if (!active) return;
      if (!raw || typeof raw !== 'object' || typeof raw.exists !== 'boolean') {
        throw new Error('Invalid player read response');
      }
      if (!raw.exists) {
        setReading({ owner: user, kind: 'missing' });
        return;
      }
      const player = readPlayerSnapshot(raw.player, user);
      if (!player) throw new Error('Incomplete on-chain player state');
      setReading({ owner: user, kind: 'ready', player });
      setPreparedPlayerInit(null);
      setPlayerInitStatus((status) => status === 'pending' ? 'success' : status);
    }).catch(() => { if (active) setReading({ owner: user, kind: 'error' }); });
    return () => { active = false; };
  }, [user, playerRevision]);

  const preparePlayerInit = async () => {
    if (!user || playerInitBusy) return;
    const owner = user;
    setPlayerInitBusy(true);
    setPlayerInitStatus('preparing');
    setPreparedPlayerInit(null);
    try {
      const response = await api.profile.initPlayer({ player: owner });
      if (currentUser.current !== owner) return;
      if (typeof response?.tx !== 'string' || !response.tx || !response.quote) {
        throw new Error('Missing bounded player initialization quote');
      }
      setPreparedPlayerInit({ owner, response });
      setPlayerInitStatus('prepared');
    } catch {
      if (currentUser.current === owner) setPlayerInitStatus('failed');
    } finally {
      setPlayerInitBusy(false);
    }
  };

  const confirmPlayerInit = async () => {
    if (!user || !preparedPlayerInit || preparedPlayerInit.owner !== user || playerInitBusy) return;
    const { owner, response } = preparedPlayerInit;
    const intent: PlayerInitIntent = { kind: 'playerInit', user: owner, quote: response.quote };
    setPlayerInitBusy(true);
    try {
      const result = await handleTxResponse(response, intent);
      if (currentUser.current !== owner) return;
      if (result.success) {
        setPreparedPlayerInit(null);
        setPlayerInitStatus('success');
        setPlayerRevision((revision) => revision + 1);
      } else if (result.signature) {
        setPreparedPlayerInit(null);
        setPlayerInitStatus('pending');
        setPlayerRevision((revision) => revision + 1);
      } else {
        setPlayerInitStatus('failed');
      }
    } finally {
      setPlayerInitBusy(false);
    }
  };

  const state = !user ? 'disconnected' : reading?.owner !== user ? 'loading' : reading.kind;
  const player = state === 'ready' && reading?.owner === user ? reading.player ?? null : null;
  const short = user ? `${user.slice(0, 4)}…${user.slice(-4)}` : null;
  const count = (amount: number) => amount.toLocaleString(language);

  return (
    <div lang={language} className="profile-home px-4 pt-5 pb-24 min-w-0">
      <div className="flex justify-end mb-2 gap-2">
        <button type="button" className="text-xs text-straw underline underline-offset-2" onClick={() => window.dispatchEvent(new Event("nf:open-privacy"))}>{legalUiCopy[language].settings}</button>
        <WalletButton />
      </div>
      <Panel tier="hero" id={<Sticker bars>{short ?? copy.guestSticker}</Sticker>}
        meta={user ? copy.operator : copy.noWallet} title={short ?? copy.guest}
        sub={state === 'disconnected' ? copy.connect : state === 'loading' ? copy.reading : state === 'error' ? copy.unknown : state === 'missing' ? copy.playerMissing : copy.source}>
        <p role="status" className="fg-note break-words">
          {state === 'disconnected' ? copy.connect : state === 'loading' ? copy.reading : state === 'error' ? copy.unknown : state === 'missing' ? copy.playerMissing : copy.source}
        </p>
        {state === 'missing' && user && reading?.owner === user && <div className="mt-4 space-y-3 rounded-2xl border border-gold/30 bg-soil-900/60 p-3">
          <p className="text-straw text-sm break-words">{copy.initPlayerNote}</p>
          {preparedPlayerInit?.owner === user && <div className="text-straw text-xs space-y-1" role="note" aria-label={copy.initPlayerPrepared}>
            <p>{copy.initPlayerPrepared}</p>
            <p>{copy.quoteRent(formatLamportsAsSol(preparedPlayerInit.response.quote.rentLamports, language))}</p>
            <p>{copy.quoteNetworkFee(formatLamportsAsSol(preparedPlayerInit.response.quote.networkFeeLamports, language))}</p>
            <p>{copy.quoteMax(formatLamportsAsSol(preparedPlayerInit.response.quote.maxCostLamports, language))}</p>
          </div>}
          {playerInitStatus === 'preparing' && <p role="status" className="text-straw text-xs">{copy.initPlayerPreparing}</p>}
          {playerInitStatus === 'failed' && <p role="status" className="text-straw text-xs">{copy.initPlayerFailed}</p>}
          {playerInitStatus === 'pending' && <div role="status" className="text-straw text-xs space-y-2">
            <p>{copy.initPlayerPending}</p>
            <button type="button" onClick={() => setPlayerRevision((revision) => revision + 1)} className="underline">{copy.retryRead}</button>
          </div>}
          {playerInitStatus === 'success' && <p role="status" className="text-straw text-xs">{copy.initPlayerSuccess}</p>}
          <button type="button" onClick={preparedPlayerInit?.owner === user ? confirmPlayerInit : preparePlayerInit} disabled={playerInitBusy || playerInitStatus === 'pending'}
            className="w-full py-3.5 px-3 rounded-2xl bg-gold text-soil-950 font-bold text-sm disabled:opacity-40 [overflow-wrap:anywhere]">
            {playerInitBusy ? copy.initPlayerPreparing : preparedPlayerInit?.owner === user ? copy.initPlayerConfirm : copy.initPlayer}
          </button>
          {preparedPlayerInit?.owner === user && <button type="button" onClick={preparePlayerInit} disabled={playerInitBusy}
            className="w-full py-2 px-3 rounded-xl border border-gold/30 text-parchment text-xs disabled:opacity-40">{copy.refreshQuote}</button>}
        </div>}
        {state === 'error' && user && <button type="button" onClick={() => setPlayerRevision((revision) => revision + 1)}
          className="mt-3 rounded-xl border border-gold/30 px-3 py-2 text-xs text-parchment">{copy.retryRead}</button>}
        {player && <p className="text-straw text-xs mt-2 break-words">{copy.tent}: {player.hasTent ? copy.tentYes : copy.tentNo}</p>}
        <div style={{ marginTop: 16 }}><Readouts>
          <Readout label={copy.villagers} value={player ? count(player.villagers) : undefined} dash={!player} hint={copy.villagersHint} />
          <Readout label={copy.available} value={player ? count(player.villagersAvailable) : undefined} dash={!player} hint={copy.availableHint} />
          <Readout label={copy.historian} value={player ? count(player.historianCount) : undefined} dash={!player} hint={copy.historianHint} />
          <Readout label={copy.medallion} value={player ? count(player.medallionCount) : undefined} dash={!player} hint={copy.medallionHint} />
          <Readout label={copy.trust} dash hint={copy.trustHint} />
        </Readouts></div>
      </Panel>

      <DailyRewardButton />

      <Panel tier="panel" className="mb-4" id={<Sticker>{copy.sectionsSticker}</Sticker>}
        meta={copy.sectionsMeta} title={copy.sectionsTitle} sub={copy.sectionsSub}>
        <div className="list">
          <ListRow icon={UI_ICONS.menuQuests} label={menu.curatorQuests}
            onClick={() => push("profile", "quests", <><NavHeader headerId="curatorQuests" icon={UI_ICONS.menuQuests} tabKey="profile" /><QuestBoardPage /></>)} />
          <ListRow icon={UI_ICONS.catalog} label={menu.portfolio}
            onClick={() => push("profile", "portfolio", <><NavHeader headerId="portfolio" tabKey="profile" /><PortfolioHome /></>)} />
          <ListRow icon={UI_ICONS.privileges} label={menu.trust} value="—"
            onClick={() => push("profile", "trust", <><NavHeader headerId="trust" tabKey="profile" /><TrustPage /></>)} />
          <ListRow icon={UI_ICONS.achievements} label={menu.leaderboard}
            onClick={() => push("profile", "leaderboard", <><NavHeader headerId="leaderboard" icon={UI_ICONS.achievements} tabKey="profile" /><LeaderboardPage /></>)} />
          <ListRow icon={UI_ICONS.questsDaily} label={menu.rating}
            onClick={() => push("profile", "my-rating", <><NavHeader headerId="rating" icon={UI_ICONS.questsDaily} tabKey="profile" /><PlayerRatingPage /></>)} />
          <ListRow icon={UI_ICONS.seasonPass} label={copy.seasonVip}
            onClick={() => push("profile", "season", <><NavHeader headerId="seasonPass" tabKey="profile" /><SeasonPassPage /></>)} />
          <ListRow icon={UI_ICONS.friends} label={copy.friends}
            onClick={() => push("profile", "friends", <><NavHeader headerId="friends" tabKey="profile" /><FriendsList /></>)} />
          <ListRow icon={UI_ICONS.flasks} label={copy.gallery} onClick={() => window.open("/visual", "_blank", "noopener")} />
        </div>
      </Panel>

      {/* Дефект: перки коллекционеров были объявлены, но включить их в игре
          было нечем — ни постановки NFT, ни возврата. */}
      <div className="mb-4"><CollectorsPanel /></div>

      <Panel tier="panel" className="mb-4" id={<Sticker>{copy.accessSticker}</Sticker>}
        meta={copy.accessMeta} title={copy.accessTitle} sub={copy.accessSub}>
        <PrivilegesPanel compact />
      </Panel>

      {/* [§3.4] Перерождение включено: панель читает цену, кулдаун и список
          излишков из сети и подписывает полный сброс одной транзакцией. */}
      <div className="mb-4"><RebirthPanel /></div>

    </div>
  );
}
