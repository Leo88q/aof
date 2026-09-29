import { Card } from '../../components/ui/Card';
import { ResourceGlyph } from '../../components/visual/ResourceGlyph';
import { UI_ICONS } from '../../lib/visualAssets';
import { useLocale } from '../../i18n/LocaleProvider';
import { npcAdminCopy } from '../../i18n/npcAdminCopy';

/** Admin-only, currently unmounted. The backend reports enabled:false for stats
 * and rejects manual runs with 503; do not show a runnable trader or invent data. */
export function NpcDashboard() {
  const { language } = useLocale();
  const copy = npcAdminCopy[language];
  return (
    <div className="p-4 pb-24 min-w-0" lang={language}>
      <Card>
        <h2 className="text-parchment font-bold text-lg flex items-center gap-2 min-w-0 [overflow-wrap:anywhere]">
          <ResourceGlyph icon={UI_ICONS.trainer} alt="" className="w-6 h-6 shrink-0" />
          {copy.title}
        </h2>
        <div role="status" className="mt-3 rounded-lg border border-gold-500/30 bg-soil-800/70 p-3 min-w-0 [overflow-wrap:anywhere]">
          <p className="text-gold-400 font-semibold">{copy.unavailable}</p>
          <p className="text-straw text-sm mt-1">{copy.reason}</p>
        </div>
      </Card>
    </div>
  );
}
