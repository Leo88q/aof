import { ProgressRing } from "../ProgressRing";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../../lib/api";
import { Card } from "./Card";
import { UI_ICONS } from "../../lib/visualAssets";

const WEATHER_ICONS: Record<string, string> = {
  sunny: UI_ICONS.weatherNominal,
  rain: UI_ICONS.weatherSurge,
  drought: UI_ICONS.weatherBlackout,
  harvest_festival: UI_ICONS.weatherFrenzy,
};

const SEASON_ICONS: Record<string, string> = {
  spring: UI_ICONS.seasonSpring,
  summer: UI_ICONS.seasonSummer,
  autumn: UI_ICONS.seasonAutumn,
  winter: UI_ICONS.seasonWinter,
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
        if (currentData && typeof currentData === "object" && typeof currentData.type === "string") {
          setCurrent(currentData);
        } else {
          setCurrent(null);
        }
        if (forecastData && Array.isArray(forecastData.forecast)) {
          setForecast(forecastData.forecast.filter((d: any) => d && typeof d.type === "string"));
        } else {
          setForecast([]);
        }
        setLoading(false);
      })
      .catch(() => {
        setCurrent(null);
        setForecast([]);
        setLoading(false);
      });
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

  if (!current || typeof current !== "object" || !current.type || typeof current.type !== "string") {
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
            className="inline-flex"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            <img src={WEATHER_ICONS[current.type] || UI_ICONS.weatherNominal} alt="" className="w-10 h-10 object-contain" />
          </motion.span>
          <div>
            <div className="text-parchment font-semibold capitalize">
              {current.type?.replace?.("_", " ") || current.type || "—"}
            </div>
            <div className="text-straw text-xs">{current.effect || ""}</div>
          </div>
        </div>
        <div className="text-right">
          <img src={SEASON_ICONS[current.season || ""] || UI_ICONS.seasonSpring} alt="" className="w-8 h-8 object-contain ml-auto" />
          <div className="text-xs text-straw capitalize">{current.season || "—"}</div>
        </div>
      </div>

      {/* Прогресс сезона */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-straw mb-1">
          <span>День {((current.dayOfSeason ?? 0) + 1)} из 42</span>
          <span>{current.daysUntilNextSeason ?? 0} до смены</span>
        </div>
        <div className="h-2 bg-soil-700 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-straw/60 to-gold/60"
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, Math.max(0, (((current.dayOfSeason ?? 0) + 1) / 42) * 100))}%` }}
            transition={{ duration: 1 }}
          />
        </div>
      </div>

      {/* Прогноз на 3 дня */}
      {Array.isArray(forecast) && forecast.length > 0 && (
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
                <img src={(day?.type && WEATHER_ICONS[day.type]) || UI_ICONS.weatherNominal} alt="" className="w-6 h-6 object-contain mx-auto mb-1" />
                <div className="text-xs text-straw capitalize">
                  {day?.type ? day.type.replace("_", " ") : "—"}
                </div>
                <div className="text-xs text-straw/60 mt-1">
                  День {((day?.dayOfSeason ?? 0) + 1)}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
