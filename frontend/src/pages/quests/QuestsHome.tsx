import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card } from "../../components/ui/Card";
import { LiquidBar } from "../../components/ui/LiquidBar";
import { AnimatedCounter } from "../../components/ui/AnimatedCounter";
import { RewardBurst } from "../../components/animations/RewardBurst";
import { api } from "../../lib/api";
import { useWalletStore } from "../../store/walletStore";
import { useFlash } from "../../lib/marketUtils";
import { UI_ICONS } from "../../lib/visualAssets";
import { DataUnavailableNotice, isFailClosedError } from "../../lib/availability";
import { Note, Panel, Sticker } from "../../ui/forge/kit";
import { PunchedCard } from "../../ui/forge/devices";

/**
 * К10 · перфокарты Жаккарда. Один шаг задания — одна колонка карты: пробитые
 * колонки уже отработаны, подсвеченная — следующая. Число колонок выводится из
 * реального прогресса (quest.pct / progress / target), ничего не дорисовывается.
 */
const CARD_STEPS = 12;

function questSteps(pct: number): ("done" | "next" | "open")[] {
  const filled = Math.max(0, Math.min(CARD_STEPS, Math.round((Number(pct) || 0) / (100 / CARD_STEPS))));
  return Array.from({ length: CARD_STEPS }, (_, i) => (i < filled ? "done" : i === filled ? "next" : "open"));
}

const tabs = [
  { id: "daily", icon: UI_ICONS.questsDaily, label: "Задания" },
  { id: "challenges", icon: UI_ICONS.challenges, label: "Челленджи" },
  { id: "achievements", icon: UI_ICONS.achievements, label: "Достижения" },
];

export function QuestsHome() {
  const { address } = useWalletStore();
  const [txStatus, flash] = useFlash();
  const [activeTab, setActiveTab] = useState("daily");
  const [quests, setQuests] = useState<any[]>([]);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [achievementsState, setAchievementsState] = useState<"idle" | "loading" | "ready" | "unavailable">("idle");
  const [claimedIds, setClaimedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  // Загрузка списка заданий. Без кошелька запроса нет — иначе индикатор
  // загрузки оставался на экране навсегда (вечный скелет вместо «подключите кошелёк»).
  useEffect(() => {
    if (!address) {
      setQuests([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    api.quests
      .list(address)
      .then((data: any) => {
        setQuests(Array.isArray(data?.quests) ? data.quests : []);
        setUnavailable(false);
      })
      .catch((e) => {
        // Пустая доска — это «нет заданий»; 503 — «прогресс не индексируется».
        setQuests([]);
        setUnavailable(isFailClosedError(e));
      })
      .finally(() => setLoading(false));
  }, [address]);

  // Загрузка достижений: без флага состояния пустой список выглядел как
  // вечный «Loading достижений...», хотя /quests/achievements отвечает 503.
  useEffect(() => {
    if (!address || activeTab !== "achievements") return;
    setAchievementsState("loading");
    api.quests
      .achievements(address)
      .then((data: any) => {
        setAchievements(Array.isArray(data?.achievements) ? data.achievements : []);
        setAchievementsState("ready");
      })
      .catch((e) => {
        setAchievements([]);
        setAchievementsState(isFailClosedError(e) ? "unavailable" : "ready");
      });
  }, [address, activeTab]);

  // Клейм награды за квест
  async function claimQuest(questId: number) {
    if (!address) return flash("❌ Подключите кошелёк");
    try {
      const resp = await api.quests.claim({ user: address, questId });
      if (resp.success) {
        flash("Награда получена — начислено в сети");
        setClaimedIds([...claimedIds, questId]);
        // Перезагружаем квесты
        const data = await api.quests.list(address);
        setQuests(data.quests || []);
      } else {
        flash(`${resp.error}`);
      }
    } catch (e: any) {
      flash(`${e.message}`);
    }
  }

  if (loading) {
    return (
      <div className="p-4 pt-6 pb-24">
        <h1 className="text-2xl font-bold mb-4">Задания</h1>
        <Card className="animate-pulse">
          <div className="h-20 bg-soil-800 rounded"></div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 pt-6 pb-24">
      <h1 className="text-2xl font-bold mb-4">Задания</h1>

      {/* Табы */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1 px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? "bg-wheat-600 text-soil-950 font-semibold"
                : "bg-soil-850 text-straw"
            }`}
          >
            {tab.icon.startsWith("/") ? (
              <img src={tab.icon} alt="" className="inline-block w-4 h-4 object-contain" />
            ) : (
              <span>{tab.icon}</span>
            )}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Задания */}
      {activeTab === "daily" && (
        <div className="space-y-3">
          {quests.length === 0 ? (
            unavailable ? (
              <DataUnavailableNotice id="quest_progress" />
            ) : (
              /* К10 · перфокарта стоит и без данных: пустая карта честно
                 показывает, что ни один шаг не зачтён, а подпись объясняет,
                 чего не хватает — кошелька, сети или самих заданий. */
              <Panel
                tier="panel"
                device="cards"
                id={<Sticker>ЗАДАНИЯ</Sticker>}
                meta={address ? "0 АКТИВНЫХ" : "БЕЗ КОШЕЛЬКА"}
                title="Перфокарта прогресса"
                sub="колонка — шаг задания"
              >
                <PunchedCard
                  title="ПРОГРЕСС"
                  steps={questSteps(0)}
                  rows={4}
                  footLeft="0 / 0"
                  footMid="шагов"
                  footRight="—"
                />
                <Note quiet>
                  {!address
                    ? "Подключите кошелёк, чтобы увидеть задания."
                    : unavailable
                      ? "Журнал заданий недоступен: сеть не ответила."
                      : "Активных заданий нет — сеть ничего не начислила."}
                </Note>
              </Panel>
            )
          ) : (
            quests.map((quest, i) => {
              const isClaimed = claimedIds.includes(quest.id);
              return (
                <motion.div
                  key={quest.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Panel
                    tier="panel"
                    device="cards"
                    id={<Sticker alt>ЗАДАНИЕ {String(quest.id).padStart(2, "0")}</Sticker>}
                    meta={isClaimed ? "ПОЛУЧЕНО" : quest.claimable ? "ГОТОВО К ВЫДАЧЕ" : "В РАБОТЕ"}
                    title={quest.title}
                    sub={`${quest.reward.amount} ${quest.reward.type}`}
                  >
                    <p className="fg-note" style={{ marginTop: 0 }}>{quest.description}</p>

                    <div style={{ marginTop: 12 }}>
                      <PunchedCard
                        title="ПРОГРЕСС"
                        steps={questSteps(quest.pct)}
                        footLeft={`${quest.progress}/${quest.target}`}
                        footMid={`${quest.pct}%`}
                        footRight={undefined}
                      />
                    </div>

                    <div className="fg-row" style={{ borderTop: "none" }}>
                      <span className="fg-row__k">
                        <AnimatedCounter value={quest.pct} />% ({quest.progress}/{quest.target})
                      </span>

                      {quest.claimable && !isClaimed ? (
                        <RewardBurst
                          rewardLabel={`${quest.reward.amount} ${quest.reward.type}`}
                          onClaim={() => claimQuest(quest.id)}
                        />
                      ) : isClaimed ? (
                        <span className="text-sprout-500 text-xs inline-flex items-center gap-1.5">
                          <img src={UI_ICONS.noticeSuccess} alt="" className="w-4 h-4 object-contain" />
                          Получено
                        </span>
                      ) : (
                        <span className="fg-row__k">В процессе</span>
                      )}
                    </div>
                  </Panel>
                </motion.div>
              );
            })
          )}
        </div>
      )}

      {/* Челленджи */}
      {activeTab === "challenges" && (
        <Card>
          <h3 className="text-parchment font-semibold mb-3 flex items-center gap-2">
            <img src={UI_ICONS.challenges} alt="" className="w-5 h-5 object-contain" />
            Недельный челлендж
          </h3>
          <p className="text-straw text-sm mb-3">Внесение отключено до появления проверяемого списания медалей и расчёта наград.</p>
          {/* Раньше здесь рисовалась полоса прогресса с зашитым значением 64% —
              это была декорация без источника данных. Пока механика отключена,
              показываем состояние вместо выдуманного прогресса. */}
          <div className="rounded-2xl border border-straw/15 bg-soil-800/60 px-3 py-3 text-center">
            <img src={UI_ICONS.challenges} alt="" className="w-6 h-6 object-contain mx-auto mb-1" />
            <p className="text-straw text-xs">Прогресс недели появится, когда сеть начнёт считать награды.</p>
          </div>
          <button
            type="button"
            disabled
            className="w-full mt-4 py-3 rounded-2xl bg-soil-800 text-straw font-semibold cursor-not-allowed"
          >
            Временно отключено
          </button>
        </Card>
      )}

      {/* Достижения */}
      {activeTab === "achievements" && (
        <div className="grid grid-cols-3 gap-3">
          {achievementsState === "unavailable" ? (
            <div className="col-span-3">
              <DataUnavailableNotice id="quest_progress" />
            </div>
          ) : achievementsState === "loading" ? (
            <Card className="col-span-3 text-center py-8">
              <p className="text-straw">Читаем достижения…</p>
            </Card>
          ) : achievements.length === 0 ? (
            <Card className="col-span-3 text-center py-8">
              <p className="text-straw">Достижений пока нет</p>
            </Card>
          ) : (
            achievements.map((ach) => (
              <Card
                key={ach.id}
                className={`text-center py-4 ${!ach.unlocked ? "opacity-40" : ""}`}
              >
                <span className="text-3xl">{ach.icon}</span>
                <p className="text-parchment text-xs font-semibold mt-2">{ach.title}</p>
                <p className="text-[10px] text-straw mt-1">
                  {ach.unlocked ? "Получено" : "Заблокировано"}
                </p>
              </Card>
            ))
          )}
        </div>
      )}
</div>
  );
}
