import { Card } from "../../components/ui/Card";
import { resourceIcon, UI_ICONS } from "../../lib/visualAssets";
import { ResourceGlyph } from "../../components/visual/ResourceGlyph";

const FLASKS = [
  { key: "CRYO_FLUID", label: "Крио-флюид", icon: resourceIcon("CRYO_FLUID") || "", desc: "+20% добыча на 1ч" },
  { key: "VOLT_FLUID", label: "Вольт-флюид", icon: resourceIcon("VOLT_FLUID") || "", desc: "+100 газа" },
  { key: "BIO_FLUID", label: "Био-флюид", icon: resourceIcon("BIO_FLUID") || "", desc: "×2 скорость на 1ч" },
  { key: "NANO_FLUID", label: "Нано-флюид", icon: resourceIcon("NANO_FLUID") || "", desc: "+3 ❤️ к соседу" },
  { key: "QUANTUM_FLUID", label: "Квантовый флюид", icon: resourceIcon("QUANTUM_FLUID") || "", desc: "+50% Forge на 1ч" },
];

export function FlaskMarketplace() {
  return (
    <div className="space-y-3">
      <Card className="p-4">
        <h3 className="text-parchment font-bold text-lg mb-2 flex items-center gap-2"><ResourceGlyph icon={UI_ICONS.flasks} alt="" className="w-5 h-5" /> Торговля зельями</h3>
        <p className="text-straw text-sm">
          Реальный orderbook и инструкции покупки/продажи флаконов не найдены в текущем market contract.
        </p>
        <p className="text-amber-300 text-xs mt-2">
          Демо-ордера удалены: цены, продавцы и заявки не должны выдаваться за данные блокчейна.
        </p>
      </Card>

      <Card className="p-4">
        <h3 className="text-parchment font-bold text-sm mb-3">Каталог флаконов</h3>
        <div className="space-y-2">
          {FLASKS.map((flask) => (
            <div key={flask.key} className="flex items-center gap-3 p-3 rounded-lg bg-soil-800/60 border border-straw/10">
              <span className="text-2xl">{flask.icon}</span>
              <div className="flex-1">
                <div className="text-parchment text-sm font-bold">{flask.label}</div>
                <div className="text-straw text-xs">{flask.desc}</div>
              </div>
              <span className="text-straw text-xs">Price: не найдена</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
