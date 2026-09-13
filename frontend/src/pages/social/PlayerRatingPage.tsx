import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card } from "../../components/ui/Card";
import { ProgressRing } from "../../components/ProgressRing";
import { api } from "../../lib/api";
import { useWalletStr } from "../../lib/useWalletStr";

interface PlayerRatingData {
  user: string;
  average: number;
  count: number;
  distribution: number[];
  verified: boolean;
  recentRatings: Array<{
    fromUser: string;
    rating: number;
    context: string;
    comment?: string;
    timestamp: string;
  }>;
}

export function PlayerRatingPage({ targetUser }: { targetUser?: string }) {
  const currentWallet = useWalletStr();
  const user = targetUser || currentWallet;
  const [data, setData] = useState<PlayerRatingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    api.rating.player(user)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) {
    return (
      <div className="p-4">
        <Card><p className="text-straw text-center py-8">Загрузка рейтинга...</p></Card>
      </div>
    );
  }

  if (!data || data.count === 0) {
    return (
      <div className="p-4">
        <Card>
          <p className="text-straw text-center py-8">
            У этого игрока пока нет оценок
          </p>
        </Card>
      </div>
    );
  }

  const stars = Math.round(data.average);
  const totalVotes = data.distribution.reduce((a, b) => a + b, 0);

  return (
    <div className="p-4 pb-24">
      <Card className="mb-4 text-center">
        <p className="text-straw text-xs font-mono mb-3">
          {data.user.slice(0, 12)}...{data.user.slice(-12)}
        </p>
        
        <div className="flex justify-center mb-3">
          <ProgressRing
            value={data.average}
            max={5}
            size={120}
            stroke={10}
            color={data.average >= 4 ? "#34d399" : data.average >= 3 ? "#fbbf24" : "#f87171"}
            label={data.average.toFixed(1)}
            sub="★"
          />
        </div>
        
        <div className="flex justify-center gap-1 mb-2">
          {[1, 2, 3, 4, 5].map((s) => (
            <span key={s} className={`text-2xl ${s <= stars ? "text-wheat-500" : "text-soil-600"}`}>
              ★
            </span>
          ))}
        </div>
        
        <p className="text-straw text-sm">
          На основе {data.count} оценок
        </p>
        
        {data.verified && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-full bg-sprout-500/20 border border-sprout-500/40"
          >
            <span className="text-sprout-500">✓</span>
            <span className="text-sprout-500 text-sm font-bold">Verified Player</span>
          </motion.div>
        )}
      </Card>

      <Card className="mb-4">
        <h3 className="text-parchment font-semibold text-sm mb-3">Распределение оценок</h3>
        <div className="space-y-2">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = data.distribution[star - 1];
            const pct = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
            return (
              <div key={star} className="flex items-center gap-2">
                <span className="text-wheat-500 text-sm w-6">★{star}</span>
                <div className="flex-1 h-2 bg-soil-800 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-wheat-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.5, delay: (5 - star) * 0.1 }}
                  />
                </div>
                <span className="text-straw text-xs w-8 text-right">{count}</span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <h3 className="text-parchment font-semibold text-sm mb-3">Последние оценки</h3>
        <div className="space-y-2">
          {data.recentRatings.slice(0, 10).map((r, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="p-2 rounded-lg bg-soil-800/40"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <span key={s} className={`text-sm ${s <= r.rating ? "text-wheat-500" : "text-soil-600"}`}>
                      ★
                    </span>
                  ))}
                </div>
                <span className="text-straw text-[10px]">
                  {new Date(r.timestamp).toLocaleDateString()}
                </span>
              </div>
              <p className="text-straw text-xs font-mono truncate">
                от {r.fromUser.slice(0, 8)}...{r.fromUser.slice(-8)}
              </p>
              {r.comment && (
                <p className="text-parchment text-xs mt-1 italic">"{r.comment}"</p>
              )}
            </motion.div>
          ))}
        </div>
      </Card>
    </div>
  );
}
