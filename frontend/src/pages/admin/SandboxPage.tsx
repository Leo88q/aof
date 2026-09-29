import { Card } from '../../components/ui/Card';
import { ResourceGlyph } from '../../components/visual/ResourceGlyph';
import { UI_ICONS } from '../../lib/visualAssets';
import { useLocale } from '../../i18n/LocaleProvider';
import { sandboxAdminCopy } from '../../i18n/sandboxAdminCopy';

/** Unmounted admin screen. The API still exists behind admin auth, but its
 * V1/V2 models use obsolete synthetic resources, not the live chain economy. */
export function SandboxPage() {
  const { language } = useLocale();
  const copy = sandboxAdminCopy[language];
  return (
    <div className="p-4 pb-24 min-w-0" lang={language}>
      <Card>
        <h2 className="text-parchment font-bold text-lg flex items-center gap-2 min-w-0 [overflow-wrap:anywhere]">
          <ResourceGlyph icon={UI_ICONS.flasks} alt="" className="w-6 h-6 shrink-0" />
          {copy.title}
        </h2>
        <div role="status" className="mt-3 rounded-lg border border-gold-500/30 bg-soil-800/70 p-3 min-w-0 [overflow-wrap:anywhere]">
          <p className="text-gold-400 font-semibold">{copy.paused}</p>
          <p className="text-straw text-sm mt-1">{copy.explanation}</p>
          <p className="text-straw text-xs mt-2">{copy.apiNote}</p>
        </div>
      </Card>
    </div>
  );
}
