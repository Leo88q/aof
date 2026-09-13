import { useStore } from "../../store/useStore";
import { useState, useEffect } from "react";
import { Card } from "../../components/ui/Card";

const WEATHER_RATES = {
  drought:  { label: "Засуха", icon: "☀️", rate: 0, color: "#ef4444" },
  sunny:    { label: "Солнечно", icon: "🌤️", rate: 5, color: "#f59e0b" },
  rain:     { label: "Дождь", icon: "🌧️", rate: 12, color: "#3b82f6" },
  festival: { label: "Фестиваль", icon: "🎉", rate: 25, color: "#a855f7" },
};

export function WellPanel() {
  const { weather } = useStore();
  const weatherKey = (weather?.type || "sunny") as keyof typeof WEATHER_RATES;
  const [accumulated, setAccumulated] = useState(42);
  const [lastCollect, setLastCollect] = useState(Date.now() - 3600_000);
  const [collecting, setCollecting] = useState(false);

  // Имитация накопления воды
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsedMin = (Date.now() - lastCollect) / 60_000;
      const rate = WEATHER_RATES[weatherKey].rate;
      setAccumulated(Math.floor(elapsedMin * rate / 60));
    }, 5000);
    return () => clearInterval(interval);
  }, [weatherKey, lastCollect]);

  const handleCollect = () => {
    if (accumulated <= 0) return;
    setCollecting(true);
    setTimeout(() => {
      setAccumulated(0);
      setLastCollect(Date.now());
      setCollecting(false);
    }, 1500);
  };

  const w = WEATHER_RATES[weatherKey];

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-parchment font-bold text-lg flex items-center gap-2">
          💧 Колодец
        </h3>
<div className="text-xs text-straw">Авто из WeatherWidget</div>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-5xl">{w.icon}</div>
        <div className="flex-1">
          <p className="text-straw text-xs">Погода: <b style={{color: w.color}}>{w.label}</b></p>
          <p className="text-straw text-xs">Скорость: <b className="text-parchment">{w.rate}</b> 💧/час</p>
        </div>
      </div>

      <div className="bg-soil-800/50 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-straw text-xs">Накоплено воды</span>
          <span className="text-parchment font-bold text-lg">{accumulated} 💧</span>
        </div>
        <div className="w-full bg-soil-700 rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all"
            style={{ width: `${Math.min(accumulated, 100)}%` }}
          />
        </div>
      </div>

      <button
        onClick={handleCollect}
        disabled={accumulated <= 0 || collecting}
        className="w-full py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 text-parchment font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110 transition"
      >
        {collecting ? "⏳ Собираем..." : `💧 Собрать ${accumulated} воды`}
      </button>

      <p className="text-straw text-[10px] text-center">
        Скорость зависит от погоды. Засуха = 0, Фестиваль = 25/час
      </p>
    </Card>
  );
}
