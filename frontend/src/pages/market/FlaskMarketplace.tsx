import { useLocale } from "../../i18n/LocaleProvider";
import { marketDetailCopy } from "../../i18n/marketDetailCopy";
import { homeResourceNames } from "../../i18n/homeDetail";
import { Card } from "../../components/ui/Card";
import { resourceIcon, UI_ICONS } from "../../lib/visualAssets";
import { ResourceGlyph } from "../../components/visual/ResourceGlyph";

/**
 * Фляги — только крафтовые позиции.
 *
 * Дефект 2026-09-28: каталог обещал эффекты («+20% добыча на 1ч», «+100 газа»,
 * «×2 скорость»), которых нет ни в одной инструкции aof-core: применения фляг
 * в сети не объявлено, они лишь выпускаются рецептами. Обещания убраны, вместо
 * выдуманных цен стоит честная строка о состоянии рынка.
 */
const FLASKS = [
  { key: "CRYO_FLUID", resourceId: "cryoFluid" },
  { key: "VOLT_FLUID", resourceId: "voltFluid" },
  { key: "BIO_FLUID", resourceId: "bioFluid" },
  { key: "NANO_FLUID", resourceId: "nanoFluid" },
  { key: "QUANTUM_FLUID", resourceId: "quantumFluid" },
] as const;

export function FlaskMarketplace() {
  const { language } = useLocale();
  const copy = marketDetailCopy[language];
  return (
    <div lang={language} className="space-y-3 min-w-0">
      <Card className="p-4">
        <h3 className="text-parchment font-bold text-lg mb-2 flex items-center gap-2">
          <ResourceGlyph icon={UI_ICONS.flasks} alt="" className="w-5 h-5" /> {copy.flaskTitle}
        </h3>
        <p className="text-straw text-sm leading-relaxed">
          {copy.flaskExplanation}
        </p>
      </Card>

      <Card className="p-4">
        <h3 className="text-parchment font-bold text-sm mb-3">{copy.flaskCatalog}</h3>
        <div className="space-y-2">
          {FLASKS.map((flask) => (
            <div key={flask.key} className="flex items-center gap-3 p-3 rounded-lg bg-soil-800/60 border border-straw/10">
              <ResourceGlyph icon={resourceIcon(flask.key) || ""} alt="" className="w-6 h-6" />
              <div className="flex-1 min-w-0">
                <div className="text-parchment text-sm font-bold">{homeResourceNames[language][flask.resourceId]}</div>
                <div className="text-straw text-xs">{copy.flaskRecipe}</div>
              </div>
              <span className="text-straw text-xs max-w-[35%] break-words text-right">{copy.flaskNoPrice}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
