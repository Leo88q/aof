import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from '../../components/ui/Card';
import { api } from '../../lib/api';
import { readLeaderboard, type RatingEntry } from '../../lib/ratingReadings';
import { useLocale } from '../../i18n/LocaleProvider';
import { ratingCopy } from '../../i18n/ratingCopy';
import { UI_ICONS } from '../../lib/visualAssets';
import { ResourceGlyph } from '../../components/visual/ResourceGlyph';

type Reading = { kind: 'loading' | 'ready' | 'error'; rows?: RatingEntry[] };

export function LeaderboardPage() {
  const { language } = useLocale();
  const copy = ratingCopy[language];
  const [reading, setReading] = useState<Reading>({ kind: 'loading' });
  useEffect(() => {
    let active = true;
    api.rating.leaderboard(100).then(raw => {
      if (!active) return;
      const rows = readLeaderboard(raw);
      if (!rows) throw new Error('Incomplete community rating list');
      setReading({ kind: 'ready', rows });
    }).catch(() => { if (active) setReading({ kind: 'error' }); });
    return () => { active = false; };
  }, []);
  const rows = reading.kind === 'ready' ? reading.rows : null;

  return <div lang={language} className="p-4 pb-24 min-w-0 [overflow-wrap:anywhere]">
    <Card className="mb-4">
      <h2 className="text-parchment font-bold text-lg mb-2 flex items-center gap-2 min-w-0">
        <ResourceGlyph icon={UI_ICONS.rewardTrophy} alt="" className="w-6 h-6 shrink-0" />{copy.leaderboard}
      </h2>
      <p className="text-straw text-sm">{copy.leaderboardAbout}</p>
    </Card>
    {!rows ? <Card><p role="status" className="text-straw text-center py-8">
      {reading.kind === 'loading' ? copy.leaderboardLoading : copy.leaderboardUnavailable}
    </p></Card> : rows.length === 0 ? <Card>
      <p className="text-straw text-center py-8">{copy.leaderboardEmpty}</p>
    </Card> : <div className="space-y-2">
      {rows.map((entry, i) => {
        const medal = entry.rank === 1 ? UI_ICONS.medalGold : entry.rank === 2 ? UI_ICONS.medalSilver : entry.rank === 3 ? UI_ICONS.medalBronze : '';
        return <motion.div key={entry.user} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
          <Card className="p-3"><div className="flex items-center gap-3 min-w-0">
            <div className="w-8 shrink-0 text-center">{medal
              ? <ResourceGlyph icon={medal} alt="" className="w-6 h-6" />
              : <span className="text-parchment font-bold">#{entry.rank}</span>}</div>
            <div className="flex-1 min-w-0">
              <p className="text-parchment font-mono text-sm break-all">{entry.user.slice(0, 8)}…{entry.user.slice(-8)}</p>
              <p className="text-straw text-xs">{copy.reviews(entry.count)}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <ResourceGlyph icon={UI_ICONS.rewardStar} alt="" className="w-5 h-5" />
              <span className="text-parchment font-bold text-lg">{entry.average.toLocaleString(language, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div></Card>
        </motion.div>;
      })}
    </div>}
  </div>;
}
