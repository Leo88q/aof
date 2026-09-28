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
  { key: "CRYO_FLUID", label: "Крио-флюид" },
  { key: "VOLT_FLUID", label: "Вольт-флюид" },
  { key: "BIO_FLUID", label: "Био-флюид" },
  { key: "NANO_FLUID", label: "Нано-флюид" },
  { key: "QUANTUM_FLUID", label: "Квантовый флюид" },
];

export function FlaskMarketplace() {
  return (
    <div className="space-y-3">
      <Card className="p-4">
        <h3 className="text-parchment font-bold text-lg mb-2 flex items-center gap-2">
          <ResourceGlyph icon={UI_ICONS.flasks} alt="" className="w-5 h-5" /> Фляги
        </h3>
        <p className="text-straw text-sm leading-relaxed">
          Фляги пока только варят: у сети нет ни книги заявок, ни операции применения.
          Поэтому здесь нет ни цен, ни продавцов — только состав рецептов.
        </p>
      </Card>

      <Card className="p-4">
        <h3 className="text-parchment font-bold text-sm mb-3">Каталог фляг</h3>
        <div className="space-y-2">
          {FLASKS.map((flask) => (
            <div key={flask.key} className="flex items-center gap-3 p-3 rounded-lg bg-soil-800/60 border border-straw/10">
              <ResourceGlyph icon={resourceIcon(flask.key) || ""} alt="" className="w-6 h-6" />
              <div className="flex-1">
                <div className="text-parchment text-sm font-bold">{flask.label}</div>
                <div className="text-straw text-xs">Выпускается рецептом; применение в сети не объявлено</div>
              </div>
              <span className="text-straw text-xs">Цены нет</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
