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
  { id: "reaper", icon: "🌾", label: "Жнец" },
];

const rarities = [
  { id: "common", label: "Обычный", color: "border-straw/40" },
  { id: "uncommon", label: "Необычный", color: "border-sprout-500/40" },
  { id: "rare", label: "Редкий", color: "border-water-500/40" },
  { id: "epic", label: "Эпический", color: "border-wheat-500/40" },
  { id: "legendary", label: "Легендарный", color: "border-gold/60" },
];

export function CompendiumHome() {
  const user = useWalletStr();
  const [caught, setCaught] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setCaught(new Set());
    setLoaded(false);
    if (!user) return;

    api.compendium.get(user)
      .then((data: any) => {
        const entries = Array.isArray(data)
          ? data
          : data?.entries || data?.grid?.flatMap((row: any) =>
              (row.rarities || []).filter((r: any) => r.seen).map((r: any) => ({
                toolType: row.toolType,
                rarity: r.rarity,
              }))
            ) || [];
        setCaught(new Set(entries.map((e: any) => `${e.toolType}-${e.rarity}`)));
      })
      .catch(() => setCaught(new Set()))
      .finally(() => setLoaded(true));
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
          <span className="text-wheat-500 font-bold">{user && loaded ? `${pct}%` : "—"}</span>
        </div>
        <div className="h-3 bg-soil-800 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: user && loaded ? `${pct}%` : "0%" }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="h-full bg-gradient-to-r from-wheat-700 to-wheat-500 rounded-full"
          />
        </div>
        <p className="text-straw text-xs mt-2">
          {user ? (loaded ? `Собрано ${caughtCount} из ${totalCells}` : "Загрузка данных из backend…") : "Подключите кошелёк для просмотра компендиума"}
        </p>
        <p className="text-straw/70 text-xs mt-3">Награды за этапы: источник клейма не найден.</p>
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
                    title={isCaught ? "Найдено" : "Не найдено"}
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
