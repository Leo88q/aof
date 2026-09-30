import { strict as assert } from 'assert';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  DAY_HASH_MULTIPLIER,
  RESOURCE_UNIT,
  WEATHER_BLACKOUT,
  WEATHER_FRENZY,
  WEATHER_META,
  WEATHER_NOMINAL,
  WEATHER_SURGE,
  currentDayId,
  dayIdFromUnixSeconds,
  hashDayId,
  seasonFromDayId,
  weatherDay,
  weatherIndexForDay,
  wellRatePerHourUnits,
} from '../src/lib/weatherSchedule';

/**
 * Погода — это правило дня, а не данные из сети. Значит зеркало на бэкенде
 * обязано совпадать с ядром численно, а не «примерно»: по этой же функции
 * `well_accrual` начисляет воду за каждую секунду окна.
 *
 * Тест читает исходники Rust и считает ожидания из них — независимо от таблиц
 * модуля. Любое расхождение (множитель, полосы, ставки, длина дня) валит CI.
 */

const root = resolve(__dirname, '..', '..');
const stateRs = readFileSync(resolve(root, 'aof-core', 'src', 'state.rs'), 'utf8');
const constantsRs = readFileSync(resolve(root, 'aof-core', 'src', 'constants.rs'), 'utf8');
const weatherRoute = readFileSync(resolve(__dirname, '..', 'src', 'routes', 'weather.ts'), 'utf8');

function rustNumber(source: string, pattern: RegExp, label: string): number {
  const match = source.match(pattern);
  assert.ok(match, `не найдено в Rust: ${label}`);
  return Number(match![1].replace(/_/g, ''));
}

// 1. Формула дня из aof-core/src/state.rs.
const rustMultiplierHex = (stateRs.match(/wrapping_mul\(0x([0-9A-Fa-f_]+)\)/) || [])[1];
assert.ok(rustMultiplierHex, 'в state.rs не найден множитель weather_for_day');
const rustMultiplier = BigInt(`0x${rustMultiplierHex.replace(/_/g, '')}`);
assert.equal(DAY_HASH_MULTIPLIER, rustMultiplier,
  'множитель дня разошёлся с aof-core/src/state.rs::weather_for_day');

const blackoutMax = rustNumber(stateRs, /0\.\.=(\d+)\s*=>\s*WEATHER_BLACKOUT/, 'полоса блэкаута');
const nominalMax = rustNumber(stateRs, /10\.\.=(\d+)\s*=>\s*WEATHER_NOMINAL/, 'полоса номинала');
const surgeMax = rustNumber(stateRs, /60\.\.=(\d+)\s*=>\s*WEATHER_SURGE/, 'полоса скачка');
assert.equal(blackoutMax, 9, 'полоса блэкаута изменилась');
assert.equal(nominalMax, 59, 'полоса номинала изменилась');
assert.equal(surgeMax, 89, 'полоса скачка изменилась');
assert.match(stateRs, /hash_val % 100/, 'распределение погоды больше не берётся по модулю 100');

/** Независимый расчёт погоды дня из разобранных констант Rust. */
function expectedWeather(dayId: number): number {
  const hash = ((BigInt.asUintN(32, BigInt(dayId)) * rustMultiplier) & 0xffffffffffffffffn) >> 32n;
  const bucket = Number(hash % 100n);
  if (bucket <= blackoutMax) return 0;
  if (bucket <= nominalMax) return 1;
  if (bucket <= surgeMax) return 2;
  return 3;
}

// 2. Константы ядра: индексы погоды, ставка колодца, единица ресурса.
const rustUnit = rustNumber(constantsRs, /pub const RESOURCE_UNIT: u64 = ([\d_]+)/, 'RESOURCE_UNIT');
assert.equal(RESOURCE_UNIT, BigInt(rustUnit), 'RESOURCE_UNIT разошёлся с aof-core/src/constants.rs');
assert.equal(rustNumber(constantsRs, /pub const WEATHER_BLACKOUT: u8 = (\d+)/, 'WEATHER_BLACKOUT'), WEATHER_BLACKOUT);
assert.equal(rustNumber(constantsRs, /pub const WEATHER_NOMINAL: u8 = (\d+)/, 'WEATHER_NOMINAL'), WEATHER_NOMINAL);
assert.equal(rustNumber(constantsRs, /pub const WEATHER_SURGE: u8 = (\d+)/, 'WEATHER_SURGE'), WEATHER_SURGE);
assert.equal(rustNumber(constantsRs, /pub const WEATHER_FRENZY: u8 = (\d+)/, 'WEATHER_FRENZY'), WEATHER_FRENZY);

/** `WELL_RATE_*` в Rust: либо `0`, либо `N * RESOURCE_UNIT` — читаем выражение как написано. */
function rustWellRate(name: string): number {
  const match = constantsRs.match(new RegExp(`pub const ${name}: u64 = ([^;]+);`));
  assert.ok(match, `не найдено в Rust: ${name}`);
  // Подчёркивания убираем только внутри чисел, чтобы не тронуть `RESOURCE_UNIT`.
  const expression = match![1].replace(/(\d)_(?=\d)/g, '$1').trim();
  const withUnit = expression.match(/^(\d+)\s*\*\s*RESOURCE_UNIT$/);
  if (withUnit) return Number(withUnit[1]) * rustUnit;
  assert.match(expression, /^\d+$/, `${name}: выражение не разобрано (${expression})`);
  return Number(expression);
}

const rustRates = ['WELL_RATE_BLACKOUT', 'WELL_RATE_NOMINAL', 'WELL_RATE_SURGE', 'WELL_RATE_FRENZY']
  .map(rustWellRate);
assert.deepEqual(
  [0, 1, 2, 3].map((index) => wellRatePerHourUnits(index).toString()),
  rustRates.map(String),
  'ставка колодца по погоде разошлась с aof-core/src/constants.rs',
);
assert.deepEqual(
  [0, 1, 2, 3].map((index) => Number(wellRatePerHourUnits(index) / RESOURCE_UNIT)),
  Object.values(WEATHER_META).map((meta) => meta.ratePerHour),
  'человеческая ставка в WEATHER_META разошлась с цепью',
);

// 3. Численное совпадение по дням: 0..5000 плюс границы u32.
for (let day = 0; day <= 5000; day += 1) {
  assert.equal(weatherIndexForDay(day), expectedWeather(day), `погода дня ${day} не совпала с ядром`);
}
for (const day of [0xffffffff, 0x80000000, 0x7fffffff, 1_000_000, 20_260_930]) {
  assert.equal(weatherIndexForDay(day), expectedWeather(day), `погода дня ${day} (граница u32) не совпала`);
}

// 4. Распределение не выродилось: все четыре состояния встречаются, доли — из полос Rust.
const counts = new Map<number, number>();
for (let day = 0; day < 10_000; day += 1) {
  const index = weatherIndexForDay(day);
  counts.set(index, (counts.get(index) ?? 0) + 1);
}
assert.equal(counts.size, 4, 'одно из состояний погоды не встречается за 10 000 дней');
const shares = [0, 1, 2, 3].map((index) => (counts.get(index) ?? 0) / 10_000);
assert.ok(Math.abs(shares[0] - 0.10) < 0.02, `доля блэкаута ${shares[0]}`);
assert.ok(Math.abs(shares[1] - 0.50) < 0.03, `доля номинала ${shares[1]}`);
assert.ok(Math.abs(shares[2] - 0.30) < 0.03, `доля скачка ${shares[2]}`);
assert.ok(Math.abs(shares[3] - 0.10) < 0.02, `доля френзи ${shares[3]}`);

// 5. Номер дня: как `div_euclid(86_400)` в Rust, включая время до эпохи.
assert.equal(dayIdFromUnixSeconds(0), 0);
assert.equal(dayIdFromUnixSeconds(86_399), 0);
assert.equal(dayIdFromUnixSeconds(86_400), 1);
assert.equal(dayIdFromUnixSeconds(-1), -1, 'отрицательные секунды округляются как div_euclid');
assert.equal(dayIdFromUnixSeconds(-86_400), -1);
assert.equal(dayIdFromUnixSeconds(-86_401), -2);
assert.equal(currentDayId(86_400 * 1000 - 1), 0);
assert.equal(currentDayId(86_400 * 1000), 1);
assert.equal(currentDayId(172_800 * 1000 - 1), 1);
assert.equal(currentDayId(172_800 * 1000), 2);

// 6. Хеш дня и сезон: границы сезонов по 42 дня, номер дня сохраняется.
assert.equal(hashDayId(0), 0n * DAY_HASH_MULTIPLIER);
assert.deepEqual(
  [0, 41, 42, 83, 84, 125, 126].map((day) => seasonFromDayId(day).season),
  ['spring', 'spring', 'summer', 'summer', 'autumn', 'autumn', 'winter'],
);
assert.equal(seasonFromDayId(0).daysUntilNextSeason, 42);
assert.equal(seasonFromDayId(41).daysUntilNextSeason, 1);
assert.equal(seasonFromDayId(-1).season, 'winter', 'дни до эпохи не должны ломать сезон');

// 7. Описание дня, которое отдаёт маршрут, собирается из того же правила.
for (const day of [0, 1, 2, 3, 42, 1234]) {
  const payload = weatherDay(day);
  const index = weatherIndexForDay(day);
  assert.equal(payload.weather, index);
  assert.equal(payload.type, WEATHER_META[index].type);
  assert.equal(payload.effect, WEATHER_META[index].effect);
  assert.equal(payload.rateUnitsPerHour, String(rustRates[index]));
  assert.equal(payload.dayId, day);
  assert.equal(payload.season, seasonFromDayId(day).season);
  assert.match(payload.date, /^\d{4}-\d{2}-\d{2}$/, 'дата дня должна быть календарной');
}

// 8. Маршрут больше не объявляет погоду закрытой: значение дня считается всегда,
//    а 503 не остаётся ни на «нет аккаунта», ни на «нет источника прогноза».
assert.ok(!/status\(503\)/.test(weatherRoute), 'маршрут погоды снова отдаёт 503');
assert.ok(!/WEATHER_STATE_UNAVAILABLE_FROM_CANONICAL_CHAIN/.test(weatherRoute),
  'в маршруте погоды остался код «погода недоступна из сети»');
assert.ok(!/WEATHER_FORECAST_UNAVAILABLE_WITHOUT_CANONICAL_SOURCE/.test(weatherRoute),
  'в маршруте прогноза остался код «нет канонического источника»');
assert.match(weatherRoute, /canonical-schedule/, 'маршрут должен называть источник значения');
assert.match(weatherRoute, /aof-core\/src\/state\.rs::weather_for_day/, 'маршрут должен называть правило дня');

// 9. Зеркало в интерфейсе — то же правило (одна формула на бэкенд и на клиент).
const frontendWeather = readFileSync(resolve(root, 'frontend', 'src', 'lib', 'weather.ts'), 'utf8');
const frontendMultiplier = (frontendWeather.match(/0x([0-9a-fA-F]+)n/) || [])[1];
assert.equal(frontendMultiplier?.toLowerCase(), rustMultiplierHex.replace(/_/g, '').toLowerCase(),
  'множитель в frontend/src/lib/weather.ts разошёлся с ядром');
for (const band of ['bucket <= 9) return 0', 'bucket <= 59) return 1', 'bucket <= 89) return 2']) {
  assert.ok(frontendWeather.includes(band), `в интерфейсе нет полосы "${band}"`);
}

console.log(
  'Weather schedule: формула дня, ставки колодца, границы суток и сезонов совпадают с aof-core ' +
  '(дни 0..5000, границы u32, распределение 10/50/30/10, прогноз считается из правила дня)',
);
