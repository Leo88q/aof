import { ProgressRing } from "../ProgressRing";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../../lib/api";
import { Card } from "./Card";

const WEATHER_ICONS: Record<string, string> = {
  sunny: "☀️",
  rain: "🌧️",
  drought: "🔥",
  harvest_festival: "🎉",
};

const SEASON_ICONS: Record<string, string> = {
  spring: "🌸",
  summer: "☀️",
  autumn: "🍂",
  winter: "❄️",
};

interface WeatherData {
  date: string;
  type: string;
  effect: string;
  season: string;
  seasonIndex: number;
  dayOfSeason: number;
  daysUntilNextSeason: number;
  dayId: number;
}

interface ForecastDay {
  date: string;
  type: string;
  effect: string;
  season: string;
  dayOfSeason: number;
}

export function WeatherWidget() {
  const [current, setCurrent] = useState<WeatherData | null>(null);
  const [forecast, setForecast] = useState<ForecastDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.weather.current().catch(() => null),
      api.weather.forecast().catch(() => null),
    ])
      .then(([currentData, forecastData]) => {
        setCurrent(currentData);
        setForecast(forecastData?.forecast || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card className="p-4 bg-soil-800 border border-straw/10">
        <div className="animate-pulse space-y-2">
          <div className="h-6 bg-soil-700 rounded"></div>
          <div className="h-4 bg-soil-700 rounded"></div>
        </div>
      </Card>
    );
  }

  if (!current) {
    return (
      <Card className="p-4 bg-soil-800 border border-amber-500/20">
        <p className="text-amber-400 text-xs">Погода недоступна из канонической сети</p>
      </Card>
    );
  }

  return (
    <Card className="p-4 bg-gradient-to-br from-soil-800 to-soil-900 border border-straw/10">
      {/* Текущая погода */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <motion.span
            className="text-4xl"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            {WEATHER_ICONS[current.type] || "☀️"}
          </motion.span>
          <div>
            <div className="text-parchment font-semibold capitalize">
              {current.type.replace("_", " ")}
            </div>
            <div className="text-straw text-xs">{current.effect}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl">{SEASON_ICONS[current.season] || "🌸"}</div>
          <div className="text-xs text-straw capitalize">{current.season}</div>
        </div>
      </div>

      {/* Прогресс сезона */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-straw mb-1">
          <span>День {current.dayOfSeason + 1} из 42</span>
          <span>{current.daysUntilNextSeason} до смены</span>
        </div>
        <div className="h-2 bg-soil-700 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-straw/60 to-gold/60"
            initial={{ width: 0 }}
            animate={{ width: `${((current.dayOfSeason + 1) / 42) * 100}%` }}
            transition={{ duration: 1 }}
          />
        </div>
      </div>

      {/* Прогноз на 3 дня */}
      {forecast.length > 0 && (
        <div className="border-t border-straw/10 pt-3">
          <div className="text-xs text-straw mb-2">Прогноз на 3 дня:</div>
          <div className="grid grid-cols-3 gap-2">
            {forecast.map((day, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="text-center p-2 bg-soil-700/50 rounded-lg"
              >
                <div className="text-2xl mb-1">{WEATHER_ICONS[day.type] || "☀️"}</div>
                <div className="text-xs text-straw capitalize">
                  {day.type.replace("_", " ")}
                </div>
                <div className="text-xs text-straw/60 mt-1">
                  День {day.dayOfSeason + 1}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
