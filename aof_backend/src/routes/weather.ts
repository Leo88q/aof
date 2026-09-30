import { Router } from "express";
import { program } from "../provider";
import { weatherStatePda } from "../lib/pda";
import {
  WEATHER_META,
  currentDayId,
  weatherDay,
} from "../lib/weatherSchedule";

const r = Router();

/**
 * Правило дня, по которому считается погода. Совпадает с `weather_crank`:
 * аккаунт `WeatherState` — только кэш сегодняшнего значения, а сама погода
 * определена формулой дня (см. `lib/weatherSchedule.ts`).
 */
const SCHEDULE_RULE = "aof-core/src/state.rs::weather_for_day";
const DEFAULT_FORECAST_DAYS = 3;
const MAX_FORECAST_DAYS = 14;

/** Кэш дня на цепи (`WeatherState`), если он есть и читается. */
async function readCachedDay(): Promise<{ dayId: number; weather: number; updatedAt: number } | null> {
  try {
    const [address] = weatherStatePda();
    const state: any = await (program.account as any).weatherState.fetchNullable(address);
    if (!state) return null;
    return {
      dayId: Number(state.dayId?.toString?.() ?? state.dayId ?? 0),
      weather: Number(state.weather ?? 0),
      updatedAt: Number(state.updatedAt?.toString?.() ?? state.updatedAt ?? 0),
    };
  } catch {
    // RPC недоступен — это не повод объявлять погоду закрытой: значение дня
    // считается той же формулой, что применяет программа при расчёте колодца.
    return null;
  }
}

/**
 * Текущая погода.
 *
 * Погода — чистая функция номера UTC-дня (так её считает и `well_accrual` в
 * ядре), поэтому маршрут отвечает всегда: значение подтверждается аккаунтом
 * `WeatherState`, когда тот обновлён на сегодня, иначе берётся из того же
 * правила дня. Раньше маршрут отдавал 503 «нет аккаунта в сети» — это закрывало
 * работающую механику из-за отсутствия необязательного кэша.
 */
r.get("/current", async (_req, res) => {
  const today = currentDayId();
  const payload = weatherDay(today);
  const cached = await readCachedDay();
  const cranked = Boolean(cached && cached.dayId === today);
  const confirmed = Boolean(cranked && cached && WEATHER_META[cached.weather] && cached.weather === payload.weather);

  res.json({
    ...payload,
    source: confirmed ? "onchain" : "canonical-schedule",
    rule: SCHEDULE_RULE,
    /** Аккаунт WeatherState обновлён на сегодняшний день (`weather_crank`). */
    cranked,
    updatedAt: cached?.updatedAt ?? null,
    onchain: cached
      ? {
          present: true,
          dayId: cached.dayId,
          weather: cached.weather,
          updatedAt: cached.updatedAt,
          knownWeather: Boolean(WEATHER_META[cached.weather]),
          matchesSchedule: confirmed,
        }
      : { present: false },
  });
});

/**
 * Прогноз — не отдельный источник, а прямое следствие расписания дня: погода
 * дня целиком определяется его номером, поэтому следующие дни известны заранее.
 * Правило то же, что у `/current` и у прогноза в интерфейсе.
 */
r.get("/forecast", (req, res) => {
  const requested = Number.parseInt(String(req.query.days ?? DEFAULT_FORECAST_DAYS), 10);
  const days = Number.isFinite(requested)
    ? Math.min(Math.max(requested, 1), MAX_FORECAST_DAYS)
    : DEFAULT_FORECAST_DAYS;
  const fromDayId = currentDayId();
  const list = [];
  for (let offset = 1; offset <= days; offset += 1) {
    list.push(weatherDay(fromDayId + offset));
  }
  res.json({
    fromDayId,
    total: list.length,
    days: list,
    source: "canonical-schedule",
    rule: SCHEDULE_RULE,
  });
});

export default r;
