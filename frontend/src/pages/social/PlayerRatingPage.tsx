import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from '../../components/ui/Card';
import { ProgressRing } from '../../components/ProgressRing';
import { api } from '../../lib/api';
import { readPlayerRating, type PlayerRating } from '../../lib/ratingReadings';
import { useLocale } from '../../i18n/LocaleProvider';
import { ratingCopy } from '../../i18n/ratingCopy';
import { UI_ICONS } from '../../lib/visualAssets';
import { ResourceGlyph } from '../../components/visual/ResourceGlyph';
import { useWalletStr } from '../../lib/useWalletStr';

type Reading = { owner: string; kind: 'loading' | 'ready' | 'error'; snapshot?: PlayerRating };

export function PlayerRatingPage({ targetUser }: { targetUser?: string }) {
  const { language } = useLocale();
  const copy = ratingCopy[language];
  const wallet = useWalletStr();
  const user = targetUser || wallet;
  const [reading, setReading] = useState<Reading | null>(null);
  useEffect(() => {
    let active = true;
    if (!user) { setReading(null); return () => { active = false; }; }
    setReading({ owner: user, kind: 'loading' });
    api.rating.player(user).then(raw => {
      if (!active) return;
      const snapshot = readPlayerRating(raw, user);
      if (!snapshot) throw new Error('Incomplete community rating');
      setReading({ owner: user, kind: 'ready', snapshot });
    }).catch(() => { if (active) setReading({ owner: user, kind: 'error' }); });
    return () => { active = false; };
  }, [user]);

  const current = reading?.owner === user ? reading : null;
  const data = current?.kind === 'ready' ? current.snapshot : null;
  if (!data || data.count === 0) return <div lang={language} className="p-4 pb-24 min-w-0 [overflow-wrap:anywhere]">
    <Card><p role="status" className="text-straw text-center py-8">
      {!user ? copy.connect : !current || current.kind === 'loading' ? copy.loading
        : current.kind === 'error' || !data ? copy.unavailable : copy.emptyPlayer}
    </p></Card>
  </div>;

  const stars = Math.round(data.average);
  const totalVotes = data.distribution.reduce((a, b) => a + b, 0);

  return <div lang={language} className="p-4 pb-24 space-y-4 min-w-0 [overflow-wrap:anywhere]">
    <Card className="text-center">
      <p className="text-straw text-xs font-mono mb-3 break-all">{data.user.slice(0, 12)}…{data.user.slice(-12)}</p>
      <div className="flex justify-center mb-3"><ProgressRing
        value={data.average} max={5} size={120} stroke={10}
        color={data.average >= 4 ? '#5FD3A8' : data.average >= 3 ? '#5FC9DA' : '#E2685F'}
        label={data.average.toLocaleString(language, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
        sub={UI_ICONS.rewardStar}
      /></div>
      <div className="flex justify-center gap-1 mb-2" aria-hidden="true">{[1, 2, 3, 4, 5].map(s =>
        <span key={s} className={`text-2xl ${s <= stars ? 'text-accent-500' : 'text-soil-600'}`}>★</span>)}</div>
      <p className="text-straw text-sm">{copy.reviews(data.count)}</p>
      <p className="text-straw text-xs mt-2">{copy.communitySource}</p>
    </Card>
    <Card>
      <h3 className="text-parchment font-semibold text-sm mb-3">{copy.distribution}</h3>
      <div className="space-y-2">{[5, 4, 3, 2, 1].map(star => {
        const count = data.distribution[star - 1];
        const pct = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
        return <div key={star} className="flex items-center gap-2">
          <span className="text-accent-500 text-sm w-6 inline-flex items-center gap-0.5">
            <ResourceGlyph icon={UI_ICONS.rewardStar} alt="" className="w-3.5 h-3.5" />{star}
          </span>
          <div className="flex-1 h-2 bg-soil-800 rounded-full overflow-hidden"><motion.div
            className="h-full bg-accent-500" initial={{ width: 0 }} animate={{ width: `${pct}%` }}
            transition={{ duration: 0.5, delay: (5 - star) * 0.1 }} /></div>
          <span className="text-straw text-xs w-8 text-right">{count}</span>
        </div>;
      })}</div>
    </Card>
    <Card>
      <h3 className="text-parchment font-semibold text-sm mb-3">{copy.recent}</h3>
      <div className="space-y-2">{data.recentRatings.map((r, i) => <motion.div key={`${r.fromUser}-${r.timestamp}-${i}`}
        initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
        className="p-2 rounded-lg bg-soil-800/40 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span aria-label={`${r.rating}/5`} className="flex gap-0.5" >{[1, 2, 3, 4, 5].map(s =>
            <span key={s} aria-hidden="true" className={`text-sm ${s <= r.rating ? 'text-accent-500' : 'text-soil-600'}`}>★</span>)}</span>
          <time dateTime={r.timestamp} className="text-straw text-[10px] shrink-0">{new Date(r.timestamp).toLocaleDateString(language)}</time>
        </div>
        <p className="text-straw text-xs font-mono break-all">{copy.by} {r.fromUser.slice(0, 8)}…{r.fromUser.slice(-8)}</p>
        {r.comment && <p className="text-parchment text-xs mt-1 italic break-words">“{r.comment}”</p>}
      </motion.div>)}</div>
    </Card>
  </div>;
}
