import { useEffect, useState } from "react";
import { useLocale } from "../../i18n/LocaleProvider";
import { profileCopy } from "../../i18n/profileCopy";
import { gameHeaders } from "../../i18n/gameHeaders";
import { readPlayerSnapshot, type PlayerSnapshot } from "../../lib/playerReadings";
import { api } from "../../lib/api";
import { WalletButton } from "../../components/ui/WalletButton";
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
import { QuestBoardPage } from "../quests/QuestBoardPage";
import { DailyRewardButton } from "../../components/DailyRewardButton";
import { FeatureDisabledNotice } from "../../components/ui/FeatureDisabledNotice";
import { PortfolioHome } from "../portfolio/PortfolioHome";
import { LeaderboardPage } from "../social/LeaderboardPage";
import { PlayerRatingPage } from "../social/PlayerRatingPage";

type PlayerRead = { owner: string; kind: 'loading' | 'ready' | 'error'; player?: PlayerSnapshot };

export function ProfileHome() {
  const { language } = useLocale();
  const copy = profileCopy[language];
  const menu = gameHeaders[language];
  const user = useWalletStr();
  const { push } = useNav();
  const [reading, setReading] = useState<PlayerRead | null>(null);

  useEffect(() => {
    let active = true;
    if (!user) { setReading(null); return () => { active = false; }; }
    setReading({ owner: user, kind: 'loading' });
    api.query.player(user).then(raw => {
      if (!active) return;
      const player = readPlayerSnapshot(raw, user);
      if (!player) throw new Error('Incomplete on-chain player state');
      setReading({ owner: user, kind: 'ready', player });
    }).catch(() => { if (active) setReading({ owner: user, kind: 'error' }); });
    return () => { active = false; };
  }, [user]);

  const state = !user ? 'disconnected' : reading?.owner !== user ? 'loading' : reading.kind;
  const player = state === 'ready' && reading?.owner === user ? reading.player ?? null : null;
  const short = user ? `${user.slice(0, 4)}…${user.slice(-4)}` : null;
  const count = (amount: number) => amount.toLocaleString(language);

  return (
    <div lang={language} className="profile-home px-4 pt-5 pb-24 min-w-0">
      <div className="flex justify-end mb-2"><WalletButton /></div>
      <Panel tier="hero" id={<Sticker bars>{short ?? copy.guestSticker}</Sticker>}
        meta={user ? copy.operator : copy.noWallet} title={short ?? copy.guest}
        sub={state === 'disconnected' ? copy.connect : state === 'loading' ? copy.reading : state === 'error' ? copy.unknown : copy.source}>
        <p role="status" className="fg-note break-words">
          {state === 'disconnected' ? copy.connect : state === 'loading' ? copy.reading : state === 'error' ? copy.unknown : copy.source}
        </p>
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

      <Panel tier="panel" className="mb-4" id={<Sticker>{copy.accessSticker}</Sticker>}
        meta={copy.accessMeta} title={copy.accessTitle} sub={copy.accessSub}>
        <PrivilegesPanel compact />
      </Panel>

      <Panel tier="panel" className="mb-4" id={<Sticker alt>{copy.rebirthSticker}</Sticker>}
        meta={copy.rebirthMeta} title={copy.rebirthTitle} sub={copy.rebirthSub}>
        <Note quiet>{copy.rebirthNote}</Note>
        <Keys><Key disabled>{copy.rebirthDisabled}</Key></Keys>
      </Panel>
      <FeatureDisabledNotice id="rebirth" />

    </div>
  );
}
