import { ProgressRing } from "../ProgressRing";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { fetchWeatherSnapshot, forecastFromDayId, weatherEffectLabel, type WeatherSnapshot, type ForecastDay } from "../../lib/weather";
import { Card } from "./Card";
import { UI_ICONS } from "../../lib/visualAssets";
import { ResourceGlyph } from "../visual/ResourceGlyph";

/**
 * On-chain weather states -> scene artwork. The art is named after the
 * economy effect (Nominal / Surge / Blackout / Frenzy), not after the
 * weather word, so the mapping follows WellPanel's rate table:
 * drought = Blackout (rate 0), sunny = Nominal, rain = Surge, festival = Frenzy.
 */
const WEATHER_ICONS: Record<string, string> = {
  sunny: UI_ICONS.weatherNominal,
  rain: UI_ICONS.weatherSurge,
  drought: UI_ICONS.weatherBlackout,
  festival: UI_ICONS.weatherFrenzy,
  harvest_festival: UI_ICONS.weatherFrenzy,
};

const SEASON_ICONS: Record<string, string> = {
  spring: UI_ICONS.epochInit,
  summer: UI_ICONS.epochTrain,
  autumn: UI_ICONS.epochTune,
  winter: UI_ICONS.epochInfer,
};

const WEATHER_LABELS: Record<string, string> = {
  sunny: "Номинал",
  rain: "Скачок",
  drought: "Блэкаут",
  festival: "Френзи",
  harvest_festival: "Френзи",
};

const SEASON_LABELS: Record<string, string> = {
  spring: "Инициализация",
  summer: "Обучение",
  autumn: "Дообучение",
  winter: "Инференс",
};


export function WeatherWidget({ compact = false }: { compact?: boolean }) {
  const [current, setCurrent] = useState<WeatherSnapshot | null>(null);
  const [forecast, setForecast] = useState<ForecastDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchWeatherSnapshot()
      .then((snapshot) => {
        if (!alive) return;
        setCurrent(snapshot);
        // Прогноз — следствие расписания дня (см. lib/weather.ts), а не
        // отдельный офчейн-источник: /weather/forecast закрыт на бэкенде.
        setForecast(snapshot ? forecastFromDayId(snapshot.dayId, 3) : []);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    if (compact) {
      return <div className="h-8 w-24 rounded-xl bg-soil-800/70 animate-pulse" aria-hidden="true" />;
    }
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
    // Компактный режим (шапка вкладки): одна строка с обрезкой вместо карточки,
    // которая раньше расширяла шапку до 440px и уезжала за край экрана.
    if (compact) {
      return (
        <span
          className="inline-flex items-center gap-1.5 min-w-0 max-w-full h-8 px-2.5 rounded-xl bg-soil-800/80 border border-amber-500/20"
          title="Погода недоступна из сети"
        >
          <ResourceGlyph icon={UI_ICONS.weatherNominal} alt="" className="w-4 h-4 shrink-0 opacity-60" />
          <span className="text-amber-400 text-[10px] truncate">нет данных сети</span>
        </span>
      );
    }
    return (
      <Card className="p-4 bg-soil-800 border border-amber-500/20">
        <p className="text-amber-400 text-xs">Погода недоступна из сети</p>
      </Card>
    );
  }

  const loadChip = (
    <span
      className="inline-flex items-center gap-1.5 min-w-0 max-w-full h-8 px-2.5 rounded-xl bg-soil-800/80 border border-straw/15"
      title={`Нагрузка сети: ${WEATHER_LABELS[current.type] || current.type}`}
    >
      <img
        src={WEATHER_ICONS[current.type] || UI_ICONS.weatherNominal}
        alt=""
        className="w-5 h-5 object-contain shrink-0"
      />
      <span className="text-parchment text-[11px] font-semibold truncate">
        {WEATHER_LABELS[current.type] || current.type}
      </span>
      <span className="text-straw text-[10px] shrink-0">· д.{((current.dayOfSeason ?? 0) + 1)}/42</span>
    </span>
  );

  if (compact) return loadChip;

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
              {WEATHER_LABELS[current.type || ""] || current.type || "—"}
            </div>
            <div className="text-straw text-xs">{weatherEffectLabel(current.effect)}</div>
          </div>
        </div>
        <div className="text-right">
          <img src={SEASON_ICONS[current.season || ""] || UI_ICONS.epochInit} alt="" className="w-8 h-8 object-contain ml-auto" />
          <div className="text-xs text-straw">Эпоха: {SEASON_LABELS[current.season || ""] || "—"}</div>
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
          <div className="text-xs text-straw mb-2">Прогноз на 3 дня · расписание дня из цепи:</div>
          <div className="grid grid-cols-3 gap-2">
            {forecast.map((day, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="text-center p-2 bg-soil-700/50 rounded-lg"
              >
                <img src={WEATHER_ICONS[day.type] || UI_ICONS.weatherNominal} alt="" className="w-6 h-6 object-contain mx-auto mb-1" />
                <div className="text-xs text-straw capitalize">
                  {WEATHER_LABELS[day.type] || day.type}
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
