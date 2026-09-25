import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card } from "../../components/ui/Card";
import { api } from "../../lib/api";
import { resourceIcon, UI_ICONS } from "../../lib/visualAssets";
import { ResourceGlyph } from "../../components/visual/ResourceGlyph";
import { useWalletStr } from "../../lib/useWalletStr";

interface Quest {
  id: string;
  type: string;
  title: string;
  description: string;
  target: any;
  reward: {
    potato: number;
    xp: number;
    item?: string;
  };
  difficulty: string;
  progress: number;
  completed: boolean;
}

const DIFFICULTY_COLORS = {
  easy: "text-sprout-500",
  medium: "text-wheat-500",
  hard: "text-red-400",
};

const DIFFICULTY_LABELS = {
  easy: "Легко",
  medium: "Средне",
  hard: "Сложно",
};

export function QuestBoardPage() {
  const user = useWalletStr();
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadQuests();
  }, [user]);

  async function loadQuests() {
    try {
      const data = await api.quests.daily(user);
      setQuests(data.quests || []);
    } catch (e) {
      console.error("Failed to load quests:", e);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4">
        <Card><p className="text-straw text-center py-8">Loading квестов...</p></Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-4">
        <Card><p className="text-straw text-center py-8">Подключите кошелёк</p></Card>
      </div>
    );
  }

  return (
    <div className="p-4 pb-24">
      <Card className="mb-4 bg-gradient-to-br from-gold/10 to-soil-900 border border-gold/30">
        <div className="flex items-center gap-3 mb-2">
          <ResourceGlyph icon={UI_ICONS.npcOracle} alt="Агент-куратор" className="w-12 h-12" />
          <div>
            <h2 className="text-parchment font-bold text-lg">Странник Джо</h2>
            <p className="text-straw text-xs">Ежедневные задания от таинственного путника</p>
          </div>
        </div>
        <p className="text-straw text-sm italic">
          "Каждый день я приношу новые испытания. Выполни их — и получишь щедрую награду!"
        </p>
      </Card>

      <div className="space-y-3">
        {quests.map((quest, i) => (
          <motion.div
            key={quest.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className={`p-4 ${quest.completed ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-parchment font-bold">{quest.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${DIFFICULTY_COLORS[quest.difficulty as keyof typeof DIFFICULTY_COLORS]} bg-current/10`}>
                      {DIFFICULTY_LABELS[quest.difficulty as keyof typeof DIFFICULTY_LABELS]}
                    </span>
                  </div>
                  <p className="text-straw text-sm">{quest.description}</p>
                </div>
                
                {quest.completed && (
                  <ResourceGlyph icon={UI_ICONS.noticeSuccess} alt="" className="w-8 h-8" />
                )}
              </div>

              <div className="mt-3 flex items-center justify-between">
                <div className="flex gap-3 text-xs">
                  <span className="text-wheat-500 inline-flex items-center gap-1"><ResourceGlyph icon={resourceIcon("MIND")} alt="" className="w-4 h-4" /> {quest.reward.potato}</span>
                  <span className="text-blue-400 inline-flex items-center gap-1"><ResourceGlyph icon={UI_ICONS.rewardStar} alt="" className="w-4 h-4" /> {quest.reward.xp} XP</span>
                  {quest.reward.item && (
                    <span className="text-gold inline-flex items-center gap-1"><ResourceGlyph icon={UI_ICONS.rewardDaily} alt="" className="w-4 h-4" /> {quest.reward.item}</span>
                  )}
                </div>

                {quest.target?.amount && (
                  <div className="text-xs text-straw">
                    {quest.progress}/{quest.target.amount}
                  </div>
                )}
              </div>

              {quest.target?.amount && (
                <div className="mt-2 h-2 bg-soil-800 rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full ${quest.completed ? "bg-sprout-500" : "bg-gold"}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${(quest.progress / quest.target.amount) * 100}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              )}
            </Card>
          </motion.div>
        ))}
      </div>

      {quests.length === 0 && (
        <Card>
          <p className="text-straw text-center py-8">
            Странник Джо ещё не принёс задания. Приходите позже!
          </p>
        </Card>
      )}
    </div>
  );
}
