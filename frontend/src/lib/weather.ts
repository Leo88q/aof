import { api } from "./api";
import { UI_ICONS } from "./visualAssets";
import { labHeroCopy } from "../i18n/labHeroCopy";
import { weatherCopy } from "../i18n/weatherCopy";
import { wellCopy } from "../i18n/wellCopy";
import type { Language } from "../i18n/translations";

/**
 * Погода — зеркало канонических правил цепи, один источник для всех панелей.
 *
 * Источники (не менять по отдельности):
 *  - aof-core/src/constants.rs: WEATHER_BLACKOUT/NOMINAL/SURGE/FRENZY = 0..3,
 *    WELL_RATE_* = 0/5/15/20 ресурса в час;
 *  - aof-core/src/state.rs: weather_for_day() — детерминированное расписание
 *    дня (10% блэкаут, 50% номинал, 30% скачок, 10% френзи) и структура
 *    WeatherState { day_id, weather, updated_at };
 *  - aof_backend/src/routes/weather.ts: WEATHER_META и seasonFromDayId.
 *
 * Значение читается с одного и того же аккаунта WeatherState PDA: сначала
 * канонический роут /weather/current, при его недоступности — /query/weather-state
 * (тот же адрес). Расхождение шапки и панели колодца закрыто именно здесь.
 */

export const DAYS_PER_SEASON = 42;
export const SEASONS = ["spring", "summer", "autumn", "winter"] as const;
export type SeasonKey = (typeof SEASONS)[number];
export type WeatherKey = "drought" | "sunny" | "rain" | "festival";

/** Индекс WeatherState.weather -> тип, код эффекта (как в бэкенде) и ставка. */
export const WEATHER_BY_INDEX: Record<number, { type: WeatherKey; effect: string; rate: number }> = {
  0: { type: "drought", effect: "well_water_rate_zero", rate: 0 },
  1: { type: "sunny", effect: "well_water_rate_5_per_hour", rate: 5 },
  2: { type: "rain", effect: "well_water_rate_15_per_hour", rate: 15 },
  3: { type: "festival", effect: "well_water_rate_20_per_hour", rate: 20 },
};

/** Only effects with an on-chain-defined rate get a human-readable label.
 * This map comes from the same rate table used by the actual weather loader. */
const EFFECT_RATES = new Map(Object.values(WEATHER_BY_INDEX).map(({ effect, rate }) => [effect, rate]));

export function weatherEffectLabel(effect?: string | null, language: Language = 'ru'): string {
  const rate = effect ? EFFECT_RATES.get(effect) : undefined;
  if (rate === undefined) return ''; // Unknown effects are not invented or shown as snake_case.
  const copy = weatherCopy[language];
  return rate === 0 ? copy.stationIdle : `${copy.stationRate} ${rate}${copy.perHour}`;
}

function toInt(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/** Канонический тип погоды -> ключ UI. Бэкенд отдаёт festival как harvest_festival. */
function normalizeType(raw: unknown): WeatherKey | null {
  if (typeof raw !== "string") return null;
  if (raw === "harvest_festival") return "festival";
  if (raw === "drought" || raw === "sunny" || raw === "rain" || raw === "festival") return raw;
  return null;
}

export function seasonFromDayId(dayId: number) {
  const cycle = DAYS_PER_SEASON * SEASONS.length;
  const cycleDay = ((Math.trunc(dayId) % cycle) + cycle) % cycle;
  const seasonIndex = Math.floor(cycleDay / DAYS_PER_SEASON);
  const dayOfSeason = cycleDay % DAYS_PER_SEASON;
  return {
    season: SEASONS[seasonIndex] as SeasonKey,
    seasonIndex,
    dayOfSeason,
    // Как в aof_backend/src/routes/weather.ts: сколько дней осталось до смены сезона.
    daysUntilNextSeason: DAYS_PER_SEASON - dayOfSeason,
  };
}

/**
 * Зеркало `weather_for_day` из aof-core/src/state.rs.
 * Дрейф формулы проверяет tests/ui-regressions.test.ts по исходнику Rust.
 */
export const DAY_HASH_MULTIPLIER = 0x9e3779b97f4a7c15n;

export function weatherIndexForDay(dayId: number): number {
  const id = BigInt(Math.trunc(dayId) >>> 0);
  const hashed = (id * DAY_HASH_MULTIPLIER) & 0xffffffffffffffffn;
  const bucket = Number((hashed >> 32n) % 100n);
  if (bucket <= 9) return 0; // blackout
  if (bucket <= 59) return 1; // nominal
  if (bucket <= 89) return 2; // surge
  return 3; // frenzy
}

/** Подписи и значки состояний — один источник для шапки, колодца и календаря эпох. */
export const WEATHER_LABELS: Record<string, string> = {
  ...labHeroCopy.ru.load,
  harvest_festival: labHeroCopy.ru.load.festival,
};

export const WEATHER_ICONS: Record<string, string> = {
  sunny: UI_ICONS.weatherNominal,
  rain: UI_ICONS.weatherSurge,
  drought: UI_ICONS.weatherBlackout,
  festival: UI_ICONS.weatherFrenzy,
  harvest_festival: UI_ICONS.weatherFrenzy,
};

export const SEASON_LABELS: Record<string, string> = wellCopy.ru.seasonNames;

export const SEASON_ICONS: Record<string, string> = {
  spring: UI_ICONS.epochInit,
  summer: UI_ICONS.epochTrain,
  autumn: UI_ICONS.epochTune,
  winter: UI_ICONS.epochInfer,
};

/** Римская нумерация эпохи: Эпоха I..IV — как в летописи сети. */
export const SEASON_ROMAN = ["I", "II", "III", "IV"] as const;

export function seasonTitle(seasonIndex: number, language: Language = 'ru'): string {
  const index = ((seasonIndex % SEASONS.length) + SEASONS.length) % SEASONS.length;
  const key = SEASONS[index];
  return `${weatherCopy[language].epoch} ${SEASON_ROMAN[index]} · ${wellCopy[language].seasonNames[key]}`;
}

export interface ForecastDay {
  dayId: number;
  dayOfSeason: number;
  season: SeasonKey;
  type: WeatherKey;
}

/**
 * Прогноз — не отдельный офчейн-источник, а прямое следствие расписания дня:
 * погода дня целиком определяется его day_id, поэтому следующие дни известны
 * заранее. /weather/forecast закрыт именно потому, что раньше отдавал другую
 * (офчейн) формулу; здесь формула та же, что у цепи.
 */
export function forecastFromDayId(dayId: number, days = 3): ForecastDay[] {
  const out: ForecastDay[] = [];
  for (let i = 1; i <= days; i += 1) {
    const next = Math.trunc(dayId) + i;
    const index = weatherIndexForDay(next);
    out.push({
      dayId: next,
      dayOfSeason: seasonFromDayId(next).dayOfSeason,
      season: seasonFromDayId(next).season,
      type: WEATHER_BY_INDEX[index].type,
    });
  }
  return out;
}

export interface WeatherSnapshot {
  type: WeatherKey;
  weatherIndex: number;
  effect: string;
  ratePerHour: number;
  dayId: number;
  season: SeasonKey;
  seasonIndex: number;
  dayOfSeason: number;
  daysUntilNextSeason: number;
  /** Откуда пришло состояние: канонический роут или чтение того же PDA. */
  source: "current" | "weather-state";
}

/**
 * Единственный загрузчик погоды для UI. Возвращает null только если
 * канонического состояния нет вообще — тогда панели обязаны честно сказать
 * «нет данных сети», а не рисовать выдуманную погоду.
 */
export async function fetchWeatherSnapshot(): Promise<WeatherSnapshot | null> {
  const current: any = await api.weather.current().catch(() => null);

  const currentType = normalizeType(current?.type);
  if (current?.type && currentType) {
    const dayId = toInt(current.dayId);
    const fromIndex = Object.entries(WEATHER_BY_INDEX).find(([, v]) => v.type === currentType)?.[0];
    const weatherIndex = toInt(current.weather) ?? (fromIndex !== undefined ? Number(fromIndex) : null);
    const season =
      dayId !== null
        ? seasonFromDayId(dayId)
        : {
            season: (SEASONS.includes(current.season) ? current.season : SEASONS[0]) as SeasonKey,
            seasonIndex: toInt(current.seasonIndex) ?? 0,
            dayOfSeason: toInt(current.dayOfSeason) ?? 0,
            daysUntilNextSeason: toInt(current.daysUntilNextSeason) ?? DAYS_PER_SEASON,
          };
    const meta = weatherIndex !== null ? WEATHER_BY_INDEX[weatherIndex] : undefined;
    return {
      type: currentType,
      weatherIndex: weatherIndex ?? 0,
      effect: meta?.effect || current.effect || "",
      ratePerHour: meta?.rate ?? 0,
      dayId: dayId ?? 0,
      source: "current",
      ...season,
    };
  }

  // Тот же WeatherState PDA, но через публичный /query: работает, когда
  // канонический роут не смог отдать аккаунт.
  const state: any = await api.query.weatherState().catch(() => null);
  const dayId = toInt(state?.dayId ?? state?.day_id);
  const weatherIndex = toInt(state?.weather ?? state?.weatherIndex);
  const meta = weatherIndex !== null ? WEATHER_BY_INDEX[weatherIndex] : undefined;
  if (dayId === null || !meta) return null;

  return {
    type: meta.type,
    weatherIndex: weatherIndex as number,
    effect: meta.effect,
    ratePerHour: meta.rate,
    dayId,
    source: "weather-state",
    ...seasonFromDayId(dayId),
  };
}
