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
import { Card } from "../../components/ui/Card";
import { TrustRing } from "../../components/ui/TrustRing";
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
  if ((playerData?.rebirthCount ?? 0) >= 1) badges.push("🔄"); // Ребёрт
  if ((playerData?.totalHarvests ?? 0) >= 100) badges.push("🏆"); // 100 урожаев
  if ((playerData?.daysPlayed ?? 0) >= 7) badges.push("🔥"); // Стрик 7 дней
  if ((playerData?.questsCompleted ?? 0) >= 10) badges.push("⭐"); // 10 квестов
  if ((playerData?.guildMembers ?? 0) >= 1) badges.push("🏰"); // В гильдии
  if ((playerData?.referrals ?? 0) >= 5) badges.push("👥"); // 5 рефералов
  if ((playerData?.craftCount ?? 0) >= 50) badges.push("⚒️"); // 50 крафтов
  if ((playerData?.tradeCount ?? 0) >= 20) badges.push("📈"); // 20 сделок
  
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

  return (
    <div className="p-4 pt-6 pb-24">
      {/* Кнопка кошелька */}
      <div className="flex justify-end mb-2">
        <WalletButton />
      </div>

      <h1 className="text-2xl font-bold mb-4">Профиль</h1>

      {/* Шапка: аватар + имя + титул + бейджи (на основе реальных данных) */}
      <Card className="mb-4 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-wheat-600 to-soil-700 flex items-center justify-center text-3xl">
          {veteranStatus?.icon ? (
            <img src={veteranStatus.icon} alt="" className="w-12 h-12 object-contain" />
          ) : (
            veteranStatus?.emoji ?? "❔"
          )}
        </div>
        <div className="flex-1">
          <h2 className="text-parchment font-semibold">
            {user ? `${user.slice(0, 4)}...${user.slice(-4)}` : "Гость"}
          </h2>
          {veteranStatus ? (
            <p className="text-wheat-500 text-sm">
              {veteranStatus.title} • Поколение {veteranStatus.generation}
            </p>
          ) : (
            <p className="text-amber-400 text-sm">Статус игрока недоступен</p>
          )}
          <div className="flex gap-1 mt-2">
            {playerData ? (badges.length > 0 ? (
              badges.map((b, i) => (
                <motion.span
                  key={i}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                  className="text-lg"
                  title={b}
                >
                  {b}
                </motion.span>
              ))
            ) : (
              <span className="text-straw text-xs">Пока нет достижений</span>
            )) : (
              <span className="text-straw text-xs">Достижения недоступны</span>
            )}
          </div>
        </div>
      </Card>

      {/* Quests */}
      <Card className="mb-4" onClick={() => push("profile", "quests", (
        <>
          <NavHeader title="🧙‍♂️ Квесты" tabKey="profile" />
          <QuestBoardPage />
        </>
      ))}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-parchment font-semibold">🧙‍♂️ Квесты Странника Джо</h3>
            <p className="text-straw/60 text-xs mt-1">Ежедневные задания с наградами</p>
          </div>
          <span className="text-2xl text-straw">→</span>
        </div>
      </Card>

      {/* Daily Reward */}
      <DailyRewardButton />

      {/* Траст-индекс */}
      <Card className="mb-4" onClick={() => push("profile", "trust", (
        <>
          <NavHeader title="Индекс доверия" tabKey="profile" />
          <TrustPage />
        </>
      ))}>
        {trust ? (
          <div className="flex items-center gap-4">
            <TrustRing score={trust.score} tier={trust.tier} />
            <div className="flex-1">
              <h3 className="text-parchment font-semibold text-sm mb-2">Индекс доверия</h3>
              <div className="space-y-2 text-xs text-straw">
                <p>🎯 Тир: <span className="text-wheat-500">{trust.tier}</span></p>
                <p>💰 Лимит сессии: <span className="text-parchment">недоступен</span></p>
                <p>🤖 Автоторговля: <span className="text-straw">недоступна до проверки индекса</span></p>
              </div>
            </div>
            <span className="text-2xl text-straw">→</span>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-parchment font-semibold text-sm mb-1">Индекс доверия</h3>
              <p className="text-amber-400 text-xs">Недоступен до развёртывания канонического индексатора</p>
            </div>
            <span className="text-2xl text-straw">→</span>
          </div>
        )}
      </Card>

      {/* === ПОРЯДОК: Сезон пасс → Привилегии → Перерождение === */}

      {/* Портфель */}
      <Card className="mb-4" onClick={() => push("profile", "portfolio", (
        <>
          <NavHeader title="Портфель" tabKey="profile" />
          <PortfolioHome />
        </>
      ))}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-wheat-500 font-semibold">💼 Портфель</h3>
            <p className="text-straw text-xs mt-1">Инструменты, ресурсы, листинги, ордера</p>
          </div>
          <span className="text-2xl">→</span>
        </div>
      </Card>

      {/* My Rating */}
      <Card className="mb-4" onClick={() => push("profile", "my-rating", (
        <>
          <NavHeader title="⭐ Мой рейтинг" tabKey="profile" />
          <PlayerRatingPage />
        </>
      ))}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-parchment font-semibold">⭐ Мой рейтинг</h3>
            <p className="text-straw/60 text-xs mt-1">Как меня оценивают другие</p>
          </div>
          <span className="text-2xl text-straw">→</span>
        </div>
      </Card>

      {/* Social: Leaderboard */}
      <Card className="mb-4" onClick={() => push("profile", "leaderboard", (
        <>
          <NavHeader title="🏆 Leaderboard" tabKey="profile" />
          <LeaderboardPage />
        </>
      ))}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-parchment font-semibold">🏆 Leaderboard</h3>
            <p className="text-straw/60 text-xs mt-1">Топ игроков по рейтингу</p>
          </div>
          <span className="text-2xl text-straw">→</span>
        </div>
      </Card>

      {/* Sandbox */}
      <Card className="mb-4 bg-soil-900/50 border-straw/10" onClick={() => push("profile", "sandbox", (
        <>
          <NavHeader title="🧪 Sandbox" tabKey="profile" />
          <SandboxPage />
        </>
      ))}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-straw font-semibold">🧪 Economy Sandbox</h3>
            <p className="text-straw/60 text-xs mt-1">Симуляция экономики перед апдейтами</p>
          </div>
          <span className="text-2xl text-straw">→</span>
        </div>
      </Card>

      {/* NPC Dashboard */}
      <Card className="mb-4 bg-soil-900/50 border-straw/10" onClick={() => push("profile", "npc", (
        <>
          <NavHeader title="🤖 NPC Торговец" tabKey="profile" />
          <NpcDashboard />
        </>
      ))}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-straw font-semibold">🤖 NPC Торговец</h3>
            <p className="text-straw/60 text-xs mt-1">Автономный агент на маркете</p>
          </div>
          <span className="text-2xl text-straw">→</span>
        </div>
      </Card>

      {/* Admin: Audit Log (только для разработчиков) */}
      <Card className="mb-4 bg-soil-900/50 border-straw/10" onClick={() => push("profile", "audit", (
        <>
          <NavHeader title="🛡️ Audit Log" tabKey="profile" />
          <AuditLogPage />
        </>
      ))}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-straw font-semibold">🛡️ Sentinel Audit Log</h3>
            <p className="text-straw/60 text-xs mt-1">Все действия игроков (admin only)</p>
          </div>
          <span className="text-2xl text-straw">→</span>
        </div>
      </Card>

      {/* Admin: Economy Dashboard */}
      <Card className="mb-4 bg-soil-900/50 border-straw/10" onClick={() => push("profile", "economy", (
        <>
          <NavHeader title="🤖 Economy Monitor" tabKey="profile" />
          <EconomyDashboard />
        </>
      ))}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-straw font-semibold">🤖 Economy Monitor</h3>
            <p className="text-straw/60 text-xs mt-1">Мониторинг POTATO экономики (admin)</p>
          </div>
          <span className="text-2xl text-straw">→</span>
        </div>
      </Card>

      {/* 1. Пасс эпохи / VIP */}
      <Card className="mb-4" onClick={() => push("profile", "season", (
        <>
          <NavHeader title="Пасс эпохи" tabKey="profile" />
          <SeasonPassPage />
        </>
      ))}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-wheat-500 font-semibold">🎫 Пасс эпохи / VIP</h3>
            <p className="text-straw text-xs mt-1">Premium: Farm-Trader, награды без рекламы, бусты</p>
          </div>
          <span className="text-2xl">→</span>
        </div>
      </Card>

      {/* 2. Привилегии (перенесено из отдельной вкладки) */}
      <Card className="mb-4">
        <h3 className="text-parchment font-semibold text-sm mb-3">🎯 Привилегии</h3>
        <PrivilegesPanel compact={true} />
        <button
          onClick={() => push("profile", "privileges", (
            <>
              <NavHeader title="Все привилегии" tabKey="profile" />
              <div className="p-4"><PrivilegesPanel /></div>
            </>
          ))}
          className="w-full mt-3 py-2 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-400 text-xs font-semibold hover:bg-purple-600/30 transition"
        >
          Показать все привилегии →
        </button>
      </Card>



      {/* Друзья и соседи */}
      <Card className="mb-4" onClick={() => push("profile", "friends", (
        <>
          <NavHeader title="Друзья" tabKey="profile" />
          <FriendsList />
        </>
      ))}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-wheat-500 font-semibold">👥 Друзья и соседи</h3>
            <p className="text-straw text-xs mt-1">Поиск по нику, список друзей, визиты на фермы</p>
          </div>
          <span className="text-2xl">→</span>
        </div>
      </Card>

      {/* Перерождение (эндгейм) */}
      <Card className="mb-4 bg-gradient-to-r from-gold/10 to-soil-850 border border-gold/20">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-gold font-semibold">🔄 Перерождение</h3>
            <p className="text-straw text-xs mt-1">Сброс прогресса за постоянный бонус +2%</p>
          </div>
          <span className="px-4 py-2 rounded-2xl bg-soil-800 text-straw text-sm">
            Временно отключено
          </span>
        </div>
      </Card>

      <p className="text-xs text-straw mt-3">
        Rebirth отключён до реализации атомарного сброса сезонного прогресса и
        всех заявленных списаний в контракте. Подпись и списание SOL недоступны.
      </p>
    </div>
  );
}
