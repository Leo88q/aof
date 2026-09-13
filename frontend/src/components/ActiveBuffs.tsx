import { useState, useEffect } from "react";
import { Card } from "./ui/Card";

const BUFF_TYPES = {
  1: { name: "Зелье энергии", icon: "🧪", color: "#3b82f6", effect: "+20% добыча" },
  2: { name: "Зелье газа", icon: "🧪", color: "#eab308", effect: "+100 газа" },
  3: { name: "Зелье роста", icon: "🧪", color: "#10b981", effect: "×2 скорость" },
  4: { name: "Зелье любви", icon: "🧪", color: "#ec4899", effect: "+3 ❤️" },
  5: { name: "Зелье удачи", icon: "🧪", color: "#a855f7", effect: "+50% Forge" },
};

export function ActiveBuffs() {
  const [activeBuffs, setActiveBuffs] = useState<Array<{type: number, expiresAt: number}>>([]);

  // Mock данные — в реальности нужно получать из player_state
  useEffect(() => {
    // Пример: имитация активного баффа
    const mockBuffs = [
      { type: 3, expiresAt: Date.now() + 1800_000 }, // 30 минут
    ];
    setActiveBuffs(mockBuffs);
  }, []);

  if (activeBuffs.length === 0) return null;

  return (
    <Card className="p-3 mb-3">
      <h4 className="text-parchment text-sm font-bold mb-2">✨ Активные баффы</h4>
      <div className="space-y-2">
        {activeBuffs.map((buff, idx) => {
          const b = BUFF_TYPES[buff.type as keyof typeof BUFF_TYPES];
          const timeLeft = Math.max(0, buff.expiresAt - Date.now());
          const minutes = Math.floor(timeLeft / 60_000);
          
          return (
            <div
              key={idx}
              className="flex items-center gap-2 p-2 rounded-lg"
              style={{ background: b.color + "20", border: `1px solid ${b.color}40` }}
            >
              <span className="text-xl">{b.icon}</span>
              <div className="flex-1">
                <div className="text-parchment text-xs font-bold">{b.name}</div>
                <div className="text-straw text-[10px]">{b.effect}</div>
              </div>
              <div className="text-parchment text-xs font-mono">{minutes}м</div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
