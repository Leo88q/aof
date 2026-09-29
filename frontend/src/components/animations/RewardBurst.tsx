import { Card } from '../ui/Card';
import { ResourceGlyph } from '../visual/ResourceGlyph';
import { UI_ICONS } from '../../lib/visualAssets';
import { useInstrumentLanguage } from '../../i18n/LocaleProvider';
import { dormantFeatureCopy } from '../../i18n/dormantFeatureCopy';

interface RewardBurstProps {
  onClaim: () => void;
  rewardLabel: string;
}

/** Retired and currently unmounted. Animation time cannot prove settlement;
 * keep the old prop shape for compatibility but never call onClaim on a timer. */
export function RewardBurst(_props: RewardBurstProps) {
  const language = useInstrumentLanguage();
  const copy = dormantFeatureCopy[language];
  return (
    <Card className="min-w-0">
      <div role="status" lang={language} className="flex items-start gap-3 min-w-0 [overflow-wrap:anywhere]">
        <ResourceGlyph icon={UI_ICONS.noticeError} alt="" className="w-7 h-7 shrink-0" />
        <div className="min-w-0">
          <h3 className="text-parchment font-semibold text-sm">{copy.rewardTitle}</h3>
          <p className="text-gold-400 text-xs mt-1 font-semibold">{copy.rewardPaused}</p>
          <p className="text-straw text-xs mt-1">{copy.rewardReason}</p>
        </div>
      </div>
    </Card>
  );
}
