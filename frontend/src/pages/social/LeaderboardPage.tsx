import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card } from "../../components/ui/Card";
import { api } from "../../lib/api";
import { UI_ICONS } from "../../lib/visualAssets";
import { ResourceGlyph } from "../../components/visual/ResourceGlyph";

interface LeaderboardEntry {
  rank: number;
  user: string;
  average: number;
  count: number;
}

export function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLeaderboard();
  }, []);

  async function loadLeaderboard() {
    try {
      const data = await api.rating.leaderboard(100);
      setLeaderboard(data.leaderboard || []);
    } catch (e) {
      console.error("Failed to load leaderboard:", e);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4">
        <Card><p className="text-straw text-center py-8">Loading лидерборда...</p></Card>
      </div>
    );
  }

  return (
    <div className="p-4 pb-24">
      <Card className="mb-4">
        <h2 className="text-parchment font-bold text-lg mb-2 flex items-center gap-2"><ResourceGlyph icon={UI_ICONS.rewardTrophy} alt="" className="w-6 h-6" /> Топ игроков по рейтингу</h2>
        <p className="text-straw text-sm">
          Игроки с лучшими оценками от сообщества (минимум 5 оценок)
        </p>
      </Card>

      {leaderboard.length === 0 ? (
        <Card>
          <p className="text-straw text-center py-8">
            Пока нет игроков с достаточным количеством оценок
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {leaderboard.map((entry, i) => {
            const medal = entry.rank === 1 ? UI_ICONS.medalGold : entry.rank === 2 ? UI_ICONS.medalSilver : entry.rank === 3 ? UI_ICONS.medalBronze : "";
            
            return (
              <motion.div
                key={entry.user}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Card className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 text-center">
                      {medal ? (
                        <span className="text-2xl"><ResourceGlyph icon={medal} alt="" className="w-6 h-6" /></span>
                      ) : (
                        <span className="text-parchment font-bold">#{entry.rank}</span>
                      )}
                    </div>
                    
                    <div className="flex-1">
                      <p className="text-parchment font-mono text-sm">
                        {entry.user.slice(0, 8)}...{entry.user.slice(-8)}
                      </p>
                      <p className="text-straw text-xs">
                        {entry.count} оценок
                      </p>
                    </div>
                    
                    <div className="text-right">
                      <div className="flex items-center gap-1">
                        <ResourceGlyph icon={UI_ICONS.rewardStar} alt="" className="w-5 h-5" />
                        <span className="text-parchment font-bold text-lg">
                          {entry.average.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
