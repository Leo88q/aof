/**
 * Каноническое расписание погоды — зеркало правил цепи.
 *
 * Источник истины (менять только вместе с ним):
 *  - `aof-core/src/state.rs::weather_for_day` — `hash = day_id.wrapping_mul(0x9E3779B97F4A7C15).wrapping_shr(32)`,
 *    полосы `% 100`: 0..=9 блэкаут, 10..=59 номинал, 60..=89 скачок, 90..=99 френзи;
 *  - `aof-core/src/state.rs::well_rate_per_hour` и `aof-core/src/constants.rs`:
 *    `WELL_RATE_BLACKOUT/NOMINAL/SURGE/FRENZY` = 0/5/15/20 `RESOURCE_UNIT` в час.
 *
 * Почему маршрут не требует аккаунта в сети. В ядре прямо сказано: «Weather is a
 * pure function of the UTC day, so the weather of any past day can be recomputed
 * exactly. `weather_crank` only caches today's value in `WeatherState` for UIs».
 * Это же правило применяет и `well_accrual`: каждая секунда окна оценивается по
 * погоде своего дня, а не по кэшу. Значит погода и прогноз — не «офчейн-источник»,
 * а прямое следствие формулы дня; кэш в сети остаётся лишь подтверждением.
 *
 * Числовое совпадение с Rust проверяет `scripts/weatherScheduleSelfTest.ts`
 * (читает исходники ядра и считает ожидания независимо), а структурное —
 * `tests/readiness/weather-schedule.test.cjs`.
 */

/** Множитель хеша дня из `weather_for_day` (Rust: 0x9E37_79B9_7F4A_7C15). */
export const DAY_HASH_MULTIPLIER = 0x9e3779b97f4a7c15n;

/** Значения `WeatherState.weather` из `aof-core/src/constants.rs`. */
export const WEATHER_BLACKOUT = 0;
export const WEATHER_NOMINAL = 1;
export const WEATHER_SURGE = 2;
export const WEATHER_FRENZY = 3;

/** Базовая единица ресурса (Rust: `RESOURCE_UNIT = 1_000_000_000`). */
export const RESOURCE_UNIT = 1_000_000_000n;

/** `WELL_RATE_*` — выплата колодца в атомах ресурса в час при этой погоде. */
export const WELL_RATE_BLACKOUT = 0n;
export const WELL_RATE_NOMINAL = 5n * RESOURCE_UNIT;
export const WELL_RATE_SURGE = 15n * RESOURCE_UNIT;
export const WELL_RATE_FRENZY = 20n * RESOURCE_UNIT;

/** Длина дня расписания: погода меняется на границе UTC-суток (как `div_euclid(86_400)`). */
export const DAY_SECONDS = 86_400;

/** Сезон — тоже функция дня: 4 сезона по 42 дня (как в UI и в `seasonFromDayId`). */
export const DAYS_PER_SEASON = 42;
export const SEASONS = ["spring", "summer", "autumn", "winter"] as const;
export type SeasonKey = (typeof SEASONS)[number];

export type WeatherType = "drought" | "sunny" | "rain" | "harvest_festival";

export interface WeatherMeta {
  index: number;
  type: WeatherType;
  effect: string;
  ratePerHour: number;
}

/** Таблица WeatherState.weather -> тип/эффект. Человеческие подписи живут в UI. */
export const WEATHER_META: Record<number, WeatherMeta> = {
  [WEATHER_BLACKOUT]: { index: WEATHER_BLACKOUT, type: "drought", effect: "well_water_rate_zero", ratePerHour: 0 },
  [WEATHER_NOMINAL]: { index: WEATHER_NOMINAL, type: "sunny", effect: "well_water_rate_5_per_hour", ratePerHour: 5 },
  [WEATHER_SURGE]: { index: WEATHER_SURGE, type: "rain", effect: "well_water_rate_15_per_hour", ratePerHour: 15 },
  [WEATHER_FRENZY]: { index: WEATHER_FRENZY, type: "harvest_festival", effect: "well_water_rate_20_per_hour", ratePerHour: 20 },
};

const U64_MASK = 0xffffffffffffffffn;

/**
 * Хеш дня ровно как в Rust: `day_id as u64` (четырёхбайтовое значение),
 * `wrapping_mul`, `wrapping_shr(32)`.
 */
export function hashDayId(dayId: number | bigint): bigint {
  const id = BigInt.asUintN(32, typeof dayId === "bigint" ? dayId : BigInt(Math.trunc(dayId)));
  return ((id * DAY_HASH_MULTIPLIER) & U64_MASK) >> 32n;
}

/** Индекс погоды дня 0..3 (Rust: `weather_for_day`). */
export function weatherIndexForDay(dayId: number | bigint): number {
  const bucket = Number(hashDayId(dayId) % 100n);
  if (bucket <= 9) return WEATHER_BLACKOUT;
  if (bucket <= 59) return WEATHER_NOMINAL;
  if (bucket <= 89) return WEATHER_SURGE;
  return WEATHER_FRENZY;
}

/** Ставка колодца в атомах ресурса в час (Rust: `well_rate_per_hour`). */
export function wellRatePerHourUnits(weather: number): bigint {
  switch (weather) {
    case WEATHER_BLACKOUT:
      return WELL_RATE_BLACKOUT;
    case WEATHER_SURGE:
      return WELL_RATE_SURGE;
    case WEATHER_FRENZY:
      return WELL_RATE_FRENZY;
    default:
      return WELL_RATE_NOMINAL;
  }
}

/** Номер дня по unix-секундам: `floor(seconds / 86_400)` — как `div_euclid(86_400)`. */
export function dayIdFromUnixSeconds(seconds: number): number {
  return Math.floor(Math.trunc(seconds) / DAY_SECONDS);
}

/** Сегодняшний день расписания (UTC), тот же номер, что считает программа. */
export function currentDayId(nowMs: number = Date.now()): number {
  return dayIdFromUnixSeconds(Math.floor(Math.trunc(nowMs) / 1000));
}

/**
 * Календарная дата дня расписания — только для чтения человеком.
 * У далёких u32-дней ISO расширяет год знаком (`+057442-07-26`), поэтому
 * отделяем дату от времени, а не режем первые 10 знаков.
 */
export function dateFromDayId(dayId: number): string {
  return new Date(dayId * DAY_SECONDS * 1000).toISOString().split("T")[0];
}

export function seasonFromDayId(dayId: number) {
  const cycle = DAYS_PER_SEASON * SEASONS.length;
  const id = Math.trunc(dayId);
  const cycleDay = ((id % cycle) + cycle) % cycle;
  const seasonIndex = Math.floor(cycleDay / DAYS_PER_SEASON);
  const dayOfSeason = cycleDay % DAYS_PER_SEASON;
  return {
    season: SEASONS[seasonIndex] as SeasonKey,
    seasonIndex,
    dayOfSeason,
    daysUntilNextSeason: DAYS_PER_SEASON - dayOfSeason,
    dayId: id,
  };
}

/**
 * Полное описание дня: номер, индекс погоды, тип, эффект и сезон.
 * Один источник для `/weather/current` и `/weather/forecast`.
 */
export function weatherDay(dayId: number) {
  const index = weatherIndexForDay(dayId);
  const meta = WEATHER_META[index];
  const season = seasonFromDayId(dayId);
  return {
    date: dateFromDayId(dayId),
    dayId: season.dayId,
    weather: index,
    type: meta.type,
    effect: meta.effect,
    ratePerHour: meta.ratePerHour,
    rateUnitsPerHour: wellRatePerHourUnits(index).toString(),
    season: season.season,
    seasonIndex: season.seasonIndex,
    dayOfSeason: season.dayOfSeason,
    daysUntilNextSeason: season.daysUntilNextSeason,
  };
}
