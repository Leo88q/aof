import type { ReactNode } from 'react';
import { Card } from './Card';
import { ResourceGlyph } from '../visual/ResourceGlyph';
import { UI_ICONS } from '../../lib/visualAssets';
import { useInstrumentLanguage } from '../../i18n/LocaleProvider';
import { dormantFeatureCopy } from '../../i18n/dormantFeatureCopy';

interface VipGateProps {
  isVip: boolean;
  feature: string;
  children: ReactNode;
}

/** Retired and currently unmounted. An isVip prop alone cannot establish
 * that a specific benefit exists; never route to purchase or render children. */
export function VipGate(_props: VipGateProps) {
  const language = useInstrumentLanguage();
  const copy = dormantFeatureCopy[language];
  return (
    <Card className="border border-gold/20 min-w-0">
      <div role="status" lang={language} className="flex items-start gap-3 min-w-0 [overflow-wrap:anywhere]">
        <ResourceGlyph icon={UI_ICONS.privileges} alt="" className="w-8 h-8 shrink-0" />
        <div className="min-w-0">
          <h3 className="text-gold font-semibold text-sm">{copy.premiumTitle}</h3>
          <p className="text-parchment text-xs mt-1 font-semibold">{copy.premiumPaused}</p>
          <p className="text-straw text-xs mt-1">{copy.premiumReason}</p>
        </div>
      </div>
    </Card>
  );
}
