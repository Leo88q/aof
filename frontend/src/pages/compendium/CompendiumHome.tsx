import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../../lib/api";
import { Card } from "../../components/ui/Card";
import { useWalletStr } from "../../lib/useWalletStr";

const toolTypes = [
  { id: "axe", icon: "🪓", label: "Топор" },
  { id: "pick", icon: "⛏️", label: "Кирка" },
  { id: "spear", icon: "🗡️", label: "Копьё" },
  { id: "bow", icon: "🏹", label: "Лук" },
];

const rarities = [
  { id: "common", label: "Обычный", color: "border-straw/40" },
  { id: "uncommon", label: "Необычный", color: "border-sprout-500/40" },
  { id: "rare", label: "Редкий", color: "border-water-500/40" },
  { id: "epic", label: "Эпический", color: "border-wheat-500/40" },
  { id: "legendary", label: "Легендарный", color: "border-gold/60" },
];

const demoCaught = new Set([
  "axe-common", "axe-uncommon", "pick-common", "pick-rare",
  "spear-common", "bow-uncommon", "axe-epic",
]);

export function CompendiumHome() {
  // [ФИКС] Адрес кошелька для реального компендиума
  const user = useWalletStr();
  const [caught, setCaught] = useState<Set<string>>(demoCaught);

  // [ФИКС] Реальный компендиум вместо хардкод-набора
  // (демо остаётся если нет кошелька/бэкенда или коллекция пуста)
  useEffect(() => {
    if (!user) return;
    api.compendium
      .get(user)
      .then((entries: any) => {
        const arr = Array.isArray(entries) ? entries : entries?.entries || [];
        if (arr.length > 0) {
          setCaught(new Set(arr.map((e: any) => `${e.toolType}-${e.rarity}`)));
        }
      })
      .catch(() => {});
  }, [user]);

  const totalCells = toolTypes.length * rarities.length;
  const caughtCount = caught.size;
  const pct = Math.round((caughtCount / totalCells) * 100);

  return (
    <div className="p-4 pt-6 pb-24">
      <h1 className="text-2xl font-bold mb-2">Компендиум</h1>
      <p className="text-straw text-sm mb-4">Дневник фермера: собери все инструменты</p>

      <Card className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-parchment text-sm font-semibold">Прогресс</span>
          <span className="text-wheat-500 font-bold">{pct}%</span>
        </div>
        <div className="h-3 bg-soil-800 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="h-full bg-gradient-to-r from-wheat-700 to-wheat-500 rounded-full"
          />
        </div>
        <p className="text-straw text-xs mt-2">Собрано {caughtCount} из {totalCells}</p>
        
        {/* Milestones клейм */}
        <div className="grid grid-cols-4 gap-2 mt-4">
          {[25, 50, 75, 100].map((milestone) => {
            const reached = pct >= milestone;
            return (
              <button
                key={milestone}
                disabled={!reached}
                className={`py-2 rounded-xl text-xs font-semibold transition-colors ${
                  reached
                    ? "bg-gold text-soil-950 hover:bg-gold/90"
                    : "bg-soil-800 text-straw/40 cursor-not-allowed"
                }`}
                onClick={() => {
                  if (reached) {
                    // TODO: вызвать API для клейма награды
                    alert(`Награда за ${milestone}% компендиума (coming soon)`);
                  }
                }}
              >
                {milestone}%
              </button>
            );
          })}
        </div>
      </Card>

      <div className="space-y-3">
        {toolTypes.map((tool) => (
          <Card key={tool.id}>
            <h3 className="text-parchment text-sm font-semibold mb-2">{tool.icon} {tool.label}</h3>
            <div className="grid grid-cols-5 gap-2">
              {rarities.map((rarity) => {
                const key = `${tool.id}-${rarity.id}`;
                const isCaught = caught.has(key);
                return (
                  <div
                    key={key}
                    className={`aspect-square rounded-xl border-2 flex items-center justify-center text-2xl ${
                      isCaught ? `bg-soil-800 ${rarity.color}` : "bg-soil-900 border-soil-800 opacity-40"
                    }`}
                  >
                    {isCaught ? tool.icon : "?"}
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
