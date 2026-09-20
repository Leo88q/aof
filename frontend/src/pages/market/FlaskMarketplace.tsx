import { Card } from "../../components/ui/Card";

const FLASKS = [
  { key: "FLASK_BLUE", label: "Зелье энергии", icon: "🧪", desc: "+20% добыча на 1ч" },
  { key: "FLASK_YELLOW", label: "Зелье газа", icon: "🧪", desc: "+100 газа" },
  { key: "FLASK_GREEN", label: "Зелье роста", icon: "🧪", desc: "×2 скорость на 1ч" },
  { key: "FLASK_PINK", label: "Зелье любви", icon: "🧪", desc: "+3 ❤️ к соседу" },
  { key: "FLASK_PURPLE", label: "Зелье удачи", icon: "🧪", desc: "+50% Forge на 1ч" },
];

export function FlaskMarketplace() {
  return (
    <div className="space-y-3">
      <Card className="p-4">
        <h3 className="text-parchment font-bold text-lg mb-2">🧪 Торговля зельями</h3>
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
