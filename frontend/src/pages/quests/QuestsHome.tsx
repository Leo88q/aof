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

const tabs = [
  { id: "daily", icon: "📅", label: "Задания" },
  { id: "challenges", icon: "🏆", label: "Челленджи" },
  { id: "achievements", icon: UI_ICONS.achievements, label: "Достижения" },
];

export function QuestsHome() {
  const { address } = useWalletStore();
  const [txStatus, flash] = useFlash();
  const [activeTab, setActiveTab] = useState("daily");
  const [quests, setQuests] = useState<any[]>([]);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [claimedIds, setClaimedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  // Loading квестов
  useEffect(() => {
    if (!address) return;
    api.quests
      .list(address)
      .then((data: any) => setQuests(data.quests || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [address]);

  // Loading достижений
  useEffect(() => {
    if (!address || activeTab !== "achievements") return;
    api.quests
      .achievements(address)
      .then((data: any) => setAchievements(data.achievements || []))
      .catch(() => {});
  }, [address, activeTab]);

  // Клейм награды за квест
  async function claimQuest(questId: number) {
    if (!address) return flash("❌ Connect wallet");
    try {
      const resp = await api.quests.claim({ user: address, questId });
      if (resp.success) {
        flash("🎉 Награда получена!");
        setClaimedIds([...claimedIds, questId]);
        // Перезагружаем квесты
        const data = await api.quests.list(address);
        setQuests(data.quests || []);
      } else {
        flash(`❌ ${resp.error}`);
      }
    } catch (e: any) {
      flash(`❌ ${e.message}`);
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
            <Card className="text-center py-8">
              <p className="text-straw">Нет активных заданий</p>
            </Card>
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
                  <Card>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h3 className="text-parchment text-sm font-medium">{quest.title}</h3>
                        <p className="text-straw text-xs mt-1">{quest.description}</p>
                      </div>
                      <span className="text-wheat-500 text-xs ml-2">
                        {quest.reward.amount} {quest.reward.type}
                      </span>
                    </div>

                    <LiquidBar
                      level={quest.pct}
                      color={quest.claimable ? "#e8a33d" : "#6bbf59"}
                    />

                    <div className="flex justify-between items-center mt-3">
                      <span className="text-xs text-straw">
                        <AnimatedCounter value={quest.pct} />% ({quest.progress}/{quest.target})
                      </span>

                      {quest.claimable && !isClaimed ? (
                        <RewardBurst
                          rewardLabel={`${quest.reward.amount} ${quest.reward.type}`}
                          onClaim={() => claimQuest(quest.id)}
                        />
                      ) : isClaimed ? (
                        <span className="text-sprout-500 text-xs">✅ Получено</span>
                      ) : (
                        <span className="text-straw text-xs">В процессе</span>
                      )}
                    </div>
                  </Card>
                </motion.div>
              );
            })
          )}
        </div>
      )}

      {/* Челленджи */}
      {activeTab === "challenges" && (
        <Card>
          <h3 className="text-parchment font-semibold mb-3">🏆 Недельный челлендж</h3>
          <p className="text-straw text-sm mb-3">Внесение отключено до появления проверяемого списания медалей и расчёта наград.</p>
          <LiquidBar level={64} color="#e8a33d" label="Прогресс недели · только просмотр" icon="🏆" />
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
          {achievements.length === 0 ? (
            <Card className="col-span-3 text-center py-8">
              <p className="text-straw">Loading достижений...</p>
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
