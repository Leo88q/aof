import { useLocale } from "../../i18n/LocaleProvider";
import { marketDetailCopy } from "../../i18n/marketDetailCopy";
import { Card } from "../../components/ui/Card";
import { UI_ICONS } from "../../lib/visualAssets";
import { ResourceGlyph } from "../../components/visual/ResourceGlyph";
import { FeatureDisabledNotice } from "../../components/ui/FeatureDisabledNotice";

/**
 * The previous screen displayed synthetic candles and a synthetic queue while
 * the deployed aof-market program has no queue/indexer for those values. Keep
 * the route discoverable, but fail closed instead of presenting fake prices or
 * accepting a trade against an unknown tool inventory.
 */
export function HotMarket() {
  const { language } = useLocale();
  const copy = marketDetailCopy[language];
  return (
    <div lang={language} className="p-4 pt-6 pb-32 min-w-0">
      <h1 className="text-2xl font-bold text-parchment mb-4 flex items-center gap-2"><ResourceGlyph icon={UI_ICONS.marketHot} alt="" className="w-7 h-7" /> {copy.hotTitle}</h1>
      {/* Единый источник правды по отключённым механикам — FeatureDisabledNotice. */}
      <FeatureDisabledNotice id="hot_market" />
      <Card className="mt-3">
        <p className="text-straw text-sm leading-relaxed">
          {copy.hotExplanation}
        </p>
      </Card>
    </div>
  );
}
