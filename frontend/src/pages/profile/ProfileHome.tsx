import { PortfolioHome } from "../portfolio/PortfolioHome";
import { AuditLogPage } from "../admin/AuditLogPage";
import { EconomyDashboard } from "../admin/EconomyDashboard";
import { NpcDashboard } from "../admin/NpcDashboard";
import { SandboxPage } from "../admin/SandboxPage";
import { LeaderboardPage } from "../social/LeaderboardPage";
import { PlayerRatingPage } from "../social/PlayerRatingPage";
import { WalletButton } from "../../components/ui/WalletButton";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../../lib/api";
import { ListRow } from "../../components/ListRow";
import { Key, Keys, Note, Panel, Readout, Readouts, Sticker } from "../../ui/forge/kit";
import { TrustRing } from "../../components/ui/TrustRing";
import { ResourceGlyph } from "../../components/visual/ResourceGlyph";
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

// Утилита: вычисление статуса "Ветеран/Поколение" на основе данных игрока
function computeVeteranStatus(playerData: any): { title: string; generation: number; emoji: string; icon?: string } {
  // Поколение = количество ребёртов + 1
  const rebirths = playerData?.rebirthCount ?? playerData?.rebirths ?? 0;
  const generation = rebirths + 1;
  
  // Титул зависит от поколения и общего опыта
  const totalDays = playerData?.daysPlayed ?? playerData?.accountAgeDays ?? 0;
  const totalHarvests = playerData?.totalHarvests ?? 0;
  
  let title: string;
  let emoji: string;
  let icon: string | undefined;

  if (generation >= 5 || totalDays >= 180) {
    title = "Легенда сети";
    emoji = "👑";
    icon = UI_ICONS.rankLegend;
  } else if (generation >= 3 || totalDays >= 90) {
    title = "Ветеран сети";
    emoji = "🎖️";
    icon = UI_ICONS.rankVeteran;
  } else if (generation >= 2 || totalDays >= 30) {
    title = "Опытный оператор";
    emoji = "🌾";
    icon = UI_ICONS.rankExperienced;
  } else if (totalDays >= 7) {
    title = "Оператор";
    emoji = "👨‍🌾";
    icon = UI_ICONS.rankOperator;
  } else {
    title = "Новичок";
    emoji = "🌱";
    icon = UI_ICONS.rankNovice;
  }

  return { title, generation, emoji, icon };
}

// Утилита: вычисление значков (badges) на основе достижений
function computeBadges(playerData: any): string[] {
  const badges: string[] = [];
  
  // Бейджи за достижения
  if ((playerData?.rebirthCount ?? 0) >= 1) badges.push(UI_ICONS.rebirth); // Ребёрт
  if ((playerData?.totalHarvests ?? 0) >= 100) badges.push(UI_ICONS.achievements); // 100 урожаев
  if ((playerData?.daysPlayed ?? 0) >= 7) badges.push(UI_ICONS.rewardDaily); // Стрик 7 дней
  if ((playerData?.questsCompleted ?? 0) >= 10) badges.push(UI_ICONS.questsDaily); // 10 квестов
  if ((playerData?.guildMembers ?? 0) >= 1) badges.push(UI_ICONS.trustGuild); // В гильдии
  if ((playerData?.referrals ?? 0) >= 5) badges.push(UI_ICONS.friends); // 5 рефералов
  if ((playerData?.craftCount ?? 0) >= 50) badges.push(UI_ICONS.craft); // 50 крафтов
  if ((playerData?.tradeCount ?? 0) >= 20) badges.push(UI_ICONS.economyOverview); // 20 сделок
  
  // Ограничиваем до 6 бейджей
  return badges.slice(0, 6);
}

export function ProfileHome() {
  const user = useWalletStr();
  const { push } = useNav();
  const [trust, setTrust] = useState<any>(null);
  const [playerData, setPlayerData] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    
    // Загружаем индекс доверия
    api.trust
      .get(user)
      .then((t: any) => {
        setTrust({ score: t.score, tier: t.tier });
      })
      .catch(() => setTrust(null));
    
    // Загружаем данные игрока (для ветерана/поколения/бейджей)
    api.query
      .player(user)
      .then((p: any) => setPlayerData(p))
      .catch(() => setPlayerData(null));
  }, [user]);

  // Вычисляем статус ветерана и бейджи на основе реальных данных
  const veteranStatus = playerData ? computeVeteranStatus(playerData) : null;
  const badges = playerData ? computeBadges(playerData) : [];

  const short = user ? `${user.slice(0, 4)}…${user.slice(-4)}` : null;

  return (
    <div className="px-4 pt-5">
      <div className="flex justify-end mb-2">
        <WalletButton />
      </div>

      {/* Личная карта оператора: адрес — настоящий, номера бейджей — только по факту */}
      <Panel
        tier="hero"
        id={<Sticker bars>{short ?? "ГОСТЬ"}</Sticker>}
        meta={user ? "ОПЕРАТОР" : "БЕЗ КОШЕЛЬКА"}
        title={short ?? "Гость"}
        sub={veteranStatus ? `${veteranStatus.title} · поколение ${veteranStatus.generation}` : "статус недоступен"}
      >
        <div className="flex items-center gap-4">
          <div
            className="nf-plate"
            style={{ width: 62, height: 62, borderRadius: 999, background: "var(--fg-glass)" }}
          >
            {veteranStatus?.icon ? (
              <img src={veteranStatus.icon} alt="" width={40} height={40} style={{ objectFit: "contain" }} />
            ) : (
              <span style={{ fontSize: 26 }} aria-hidden="true">{veteranStatus?.emoji ?? "—"}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="fg-note" style={{ margin: 0 }}>
              {playerData ? "Хранитель лаборатории" : "Данные оператора ещё не читаются из сети"}
            </div>
            <div className="fg-lamps" style={{ marginTop: 8 }}>
              {playerData ? (
                badges.length > 0 ? (
                  badges.map((b, i) => (
                    <motion.span key={i} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.1 }}>
                      <ResourceGlyph icon={b} alt="" className="w-5 h-5" />
                    </motion.span>
                  ))
                ) : (
                  <span className="fg-gap">Знаков отличия пока нет</span>
                )
              ) : (
                <span className="fg-gap">Знаки отличия недоступны</span>
              )}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <Readouts>
            <Readout
              label="Доверие"
              value={trust ? String(trust.score) : undefined}
              dash={!trust}
              hint={trust ? trust.tier : "архив сети не запущен"}
            />
            <Readout
              label="Дней в сети"
              value={playerData?.daysPlayed != null ? String(playerData.daysPlayed) : undefined}
              dash={playerData?.daysPlayed == null}
              hint="возраст аккаунта"
            />
            <Readout
              label="Перерождений"
              value={playerData?.rebirthCount != null ? String(playerData.rebirthCount) : undefined}
              dash={playerData?.rebirthCount == null}
              hint="полных сбросов"
            />
            <Readout
              label="Заданий выполнено"
              value={playerData?.questsCompleted != null ? String(playerData.questsCompleted) : undefined}
              dash={playerData?.questsCompleted == null}
              hint="за всё время"
            />
          </Readouts>
        </div>
      </Panel>

      <DailyRewardButton />

      {/* Один приборный список вместо тринадцати отдельных окон */}
      <Panel
        tier="panel"
        className="mb-4"
        id={<Sticker>РАЗДЕЛЫ</Sticker>}
        meta="СТЕЛЛАЖ"
        title="Разделы лаборатории"
        sub="куда идти дальше"
      >
        <div className="list">
          <ListRow
            icon={UI_ICONS.menuQuests}
            label="Задания куратора"
            onClick={() => push("profile", "quests", (<><NavHeader title="Задания куратора" icon={UI_ICONS.menuQuests} tabKey="profile" /><QuestBoardPage /></>))}
          />
          <ListRow
            icon={UI_ICONS.catalog}
            label="Портфель"
            onClick={() => push("profile", "portfolio", (<><NavHeader title="Портфель" tabKey="profile" /><PortfolioHome /></>))}
          />
          <ListRow
            icon={UI_ICONS.privileges}
            label="Индекс доверия"
            value={trust ? trust.tier : "—"}
            onClick={() => push("profile", "trust", (<><NavHeader title="Индекс доверия" tabKey="profile" /><TrustPage /></>))}
          />
          <ListRow
            icon={UI_ICONS.achievements}
            label="Рейтинг игроков"
            onClick={() => push("profile", "leaderboard", (<><NavHeader title="Рейтинг игроков" icon={UI_ICONS.achievements} tabKey="profile" /><LeaderboardPage /></>))}
          />
          <ListRow
            icon={UI_ICONS.questsDaily}
            label="Мой рейтинг"
            onClick={() => push("profile", "my-rating", (<><NavHeader title="Мой рейтинг" icon={UI_ICONS.questsDaily} tabKey="profile" /><PlayerRatingPage /></>))}
          />
          <ListRow
            icon={UI_ICONS.seasonPass}
            label="Пасс эпохи и VIP"
            onClick={() => push("profile", "season", (<><NavHeader title="Пасс эпохи" tabKey="profile" /><SeasonPassPage /></>))}
          />
          <ListRow
            icon={UI_ICONS.friends}
            label="Друзья и соседи"
            onClick={() => push("profile", "friends", (<><NavHeader title="Друзья" tabKey="profile" /><FriendsList /></>))}
          />
        </div>
      </Panel>

      {/* Привилегии */}
      <Panel
        tier="panel"
        className="mb-4"
        id={<Sticker>ДОСТУП</Sticker>}
        meta="ПАНЕЛЬ"
        title="Привилегии"
        sub="что открыто оператору"
      >
        <PrivilegesPanel compact={true} />
        <Keys>
          <Key onClick={() => push("profile", "privileges", (<><NavHeader title="Все привилегии" tabKey="profile" /><div className="p-4"><PrivilegesPanel /></div></>))}>
            Показать все привилегии
          </Key>
        </Keys>
      </Panel>

      {/* Перерождение: механика закрыта, причина — из единого справочника */}
      <Panel
        tier="panel"
        className="mb-4"
        id={<Sticker alt>ЭНДГЕЙМ</Sticker>}
        meta="ОТКЛЮЧЕНО"
        title="Перерождение"
        sub="сброс прогресса за постоянный бонус +2%"
      >
        <Note quiet>Механика пока закрыта: кнопка не списывает и не сбрасывает ничего.</Note>
        <Keys>
          <Key disabled>Перерождение недоступно</Key>
        </Keys>
      </Panel>
      <FeatureDisabledNotice id="rebirth" />

      {/* Служебные экраны для команды: тихий уровень, без рамок приборов */}
      <Panel
        tier="quiet"
        className="mb-4"
        id={<Sticker>СЛУЖЕБНОЕ</Sticker>}
        meta="ДЛЯ КОМАНДЫ"
      >
        <div className="list">
          <ListRow
            icon={UI_ICONS.flasks}
            label="Песочница экономики"
            onClick={() => push("profile", "sandbox", (<><NavHeader title="Песочница экономики" icon={UI_ICONS.flasks} tabKey="profile" /><SandboxPage /></>))}
          />
          <ListRow
            icon={UI_ICONS.trainer}
            label="Торговый агент"
            onClick={() => push("profile", "npc", (<><NavHeader title="Торговый агент" icon={UI_ICONS.trainer} tabKey="profile" /><NpcDashboard /></>))}
          />
          <ListRow
            icon={UI_ICONS.trustAntibot}
            label="Журнал действий"
            onClick={() => push("profile", "audit", (<><NavHeader title="Журнал действий" icon={UI_ICONS.trustAntibot} tabKey="profile" /><AuditLogPage /></>))}
          />
          <ListRow
            icon={UI_ICONS.economyOverview}
            label="Монитор экономики"
            onClick={() => push("profile", "economy", (<><NavHeader title="Монитор экономики" icon={UI_ICONS.economyOverview} tabKey="profile" /><EconomyDashboard /></>))}
          />
        </div>
      </Panel>
    </div>
  );
}
