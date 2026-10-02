'use strict';
/**
 * Погода — правило дня, а не «данные, которых нет в сети».
 *
 * В ядре прямо сказано: `weather_for_day` — чистая функция номера UTC-дня,
 * поэтому погоду любого дня можно пересчитать точно, а `weather_crank` лишь
 * кэширует сегодняшнее значение в `WeatherState` для интерфейсов. Из этого
 * следует два требования, которые и проверяет гейт:
 *
 * 1. Зеркало на бэкенде обязано совпадать с ядром **численно** (множитель,
 *    полосы, ставки колодца, границы суток и сезонов) — по этой же функции
 *    `grid_accrual` начисляет воду за каждую секунду окна. Гейт читает исходник
 *    Rust и считает ожидания сам, а модуль подгружает как ESM-копию, чтобы не
 *    тянуть зависимости бэкенда.
 * 2. Ни в маршруте, ни в таблице ошибок не должно остаться утверждения, что
 *    погода закрыта: значение дня считается всегда, аккаунт в сети — только
 *    подтверждение. Коды «нет аккаунта» и «нет источника прогноза» живы не были
 *    бы ни одного дня: прогноз — прямое следствие того же правила.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const STATE_RS = read('aof-core/src/state.rs');
const CONSTANTS_RS = read('aof-core/src/constants.rs');
const ROUTE = read('aof_backend/src/routes/weather.ts');
const BACKEND_SCHEDULE = read('aof_backend/src/lib/weatherSchedule.ts');
const FRONTEND_SCHEDULE = read('frontend/src/lib/weather.ts');
const API_ERROR_COPY = read('frontend/src/i18n/apiErrorCopy.ts');

/** Значения, разобранные из ядра: ожидания считаются из них, а не из зеркала. */
const MULTIPLIER_HEX = (STATE_RS.match(/wrapping_mul\(0x([0-9A-Fa-f_]+)\)/) || [])[1];
assert.ok(MULTIPLIER_HEX, 'в aof-core/src/state.rs не найден множитель weather_for_day');
const MULTIPLIER = BigInt(`0x${MULTIPLIER_HEX.replace(/_/g, '')}`);

function rustNumber(source, pattern, label) {
  const match = source.match(pattern);
  assert.ok(match, `не найдено в Rust: ${label}`);
  return Number(match[1].replace(/_/g, ''));
}

const BLACKOUT_MAX = rustNumber(STATE_RS, /0\.\.=(\d+)\s*=>\s*WEATHER_BLACKOUT/, 'полоса блэкаута');
const NOMINAL_MAX = rustNumber(STATE_RS, /10\.\.=(\d+)\s*=>\s*WEATHER_NOMINAL/, 'полоса номинала');
const SURGE_MAX = rustNumber(STATE_RS, /60\.\.=(\d+)\s*=>\s*WEATHER_SURGE/, 'полоса скачка');
const RESOURCE_UNIT = rustNumber(CONSTANTS_RS, /pub const RESOURCE_UNIT: u64 = ([\d_]+)/, 'RESOURCE_UNIT');
const RUST_WEATHER_INDICES = [
  rustNumber(CONSTANTS_RS, /pub const WEATHER_BLACKOUT: u8 = (\d+)/, 'WEATHER_BLACKOUT'),
  rustNumber(CONSTANTS_RS, /pub const WEATHER_NOMINAL: u8 = (\d+)/, 'WEATHER_NOMINAL'),
  rustNumber(CONSTANTS_RS, /pub const WEATHER_SURGE: u8 = (\d+)/, 'WEATHER_SURGE'),
  rustNumber(CONSTANTS_RS, /pub const WEATHER_FRENZY: u8 = (\d+)/, 'WEATHER_FRENZY'),
];

/** `GRID_RATE_*` в Rust: либо `0`, либо `N * RESOURCE_UNIT`. */
function rustWellRate(name) {
  const match = CONSTANTS_RS.match(new RegExp(`pub const ${name}: u64 = ([^;]+);`));
  assert.ok(match, `не найдено в Rust: ${name}`);
  const expression = match[1].replace(/(\d)_(?=\d)/g, '$1').trim();
  const withUnit = expression.match(/^(\d+)\s*\*\s*RESOURCE_UNIT$/);
  if (withUnit) return Number(withUnit[1]) * RESOURCE_UNIT;
  assert.match(expression, /^\d+$/, `${name}: выражение не разобрано (${expression})`);
  return Number(expression);
}

const RUST_RATES = ['GRID_RATE_BLACKOUT', 'GRID_RATE_NOMINAL', 'GRID_RATE_SURGE', 'GRID_RATE_FRENZY']
  .map(rustWellRate);

/** Независимая реализация `weather_for_day` по разобранным значениям Rust. */
function rustWeatherForDay(dayId) {
  const id = BigInt.asUintN(32, BigInt(dayId));
  const bucket = Number((((id * MULTIPLIER) & 0xffffffffffffffffn) >> 32n) % 100n);
  if (bucket <= BLACKOUT_MAX) return 0;
  if (bucket <= NOMINAL_MAX) return 1;
  if (bucket <= SURGE_MAX) return 2;
  return 3;
}

/** Копия модуля как `.mts`, чтобы Node исполнил исходник без сборки и зависимостей. */
async function loadBackendSchedule() {
  const copy = path.join(os.tmpdir(), `aof-weather-schedule-${process.pid}.mts`);
  fs.writeFileSync(copy, BACKEND_SCHEDULE, 'utf8');
  try {
    return await import(pathToFileURL(copy).href);
  } finally {
    fs.rmSync(copy, { force: true });
  }
}

test('формула дня в бэкенде совпадает с aof-core численно', async () => {
  const schedule = await loadBackendSchedule();
  assert.equal(String(schedule.DAY_HASH_MULTIPLIER), String(MULTIPLIER),
    'множитель дня разошёлся с aof-core/src/state.rs::weather_for_day');
  for (let day = 0; day <= 5000; day += 1) {
    assert.equal(schedule.weatherIndexForDay(day), rustWeatherForDay(day),
      `погода дня ${day} не совпала с ядром`);
  }
  for (const day of [0xffffffff, 0x80000000, 0x7fffffff, 1_000_000, 20_260_930]) {
    assert.equal(schedule.weatherIndexForDay(day), rustWeatherForDay(day),
      `погода дня ${day} (граница u32) не совпала с ядром`);
  }

  // Номер дня: та же граница UTC-суток, что `div_euclid(86_400)` в Rust.
  assert.equal(schedule.dayIdFromUnixSeconds(86_399), 0);
  assert.equal(schedule.dayIdFromUnixSeconds(86_400), 1);
  assert.equal(schedule.dayIdFromUnixSeconds(-1), -1, 'до эпохи div_euclid округляет вниз');
  assert.equal(schedule.dayIdFromUnixSeconds(-86_401), -2);
  assert.equal(schedule.currentDayId(172_800 * 1000 - 1), 1);
  assert.equal(schedule.currentDayId(172_800 * 1000), 2);

  // Сезон — тоже функция дня: 4 сезона по 42 дня, как в календаре эпох.
  assert.deepEqual(
    [0, 41, 42, 83, 84, 125, 126].map((day) => schedule.seasonFromDayId(day).season),
    ['spring', 'spring', 'summer', 'summer', 'autumn', 'autumn', 'winter'],
  );
  assert.equal(schedule.seasonFromDayId(-1).season, 'winter', 'дни до эпохи не ломают сезон');
});

test('ставка колодца и описание дня собираются из правила цепи', async () => {
  const schedule = await loadBackendSchedule();
  assert.deepEqual(
    RUST_WEATHER_INDICES,
    [0, 1, 2, 3],
    'индексы WEATHER_* в ядре разъехались с таблицей WeatherState',
  );
  assert.deepEqual(
    [0, 1, 2, 3].map((index) => schedule.gridRatePerHourUnits(index).toString()),
    RUST_RATES.map(String),
    'ставка колодца по погоде разошлась с aof-core/src/constants.rs',
  );
  for (const day of [0, 1, 2, 3, 42, 1234, 20_260_930]) {
    const payload = schedule.weatherDay(day);
    const index = rustWeatherForDay(day);
    assert.equal(payload.weather, index);
    assert.equal(payload.dayId, day);
    assert.equal(schedule.WEATHER_META[index].type, payload.type);
    assert.equal(schedule.WEATHER_META[index].effect, payload.effect);
    assert.equal(payload.rateUnitsPerHour, String(RUST_RATES[index]));
    assert.equal(payload.season, schedule.seasonFromDayId(day).season);
    // u32-дни далеко за 10 000 годом дают расширенный ISO-год со знаком — это
    // допустимо: маршрут работает с текущим днём, а не с произвольным.
    assert.match(payload.date, /^[+-]?\d{4,6}-\d{2}-\d{2}$/);
  }
});

test('маршрут погоды больше не закрыт: значение дня считается всегда', () => {
  assert.ok(!/status\(503\)/.test(ROUTE), 'маршрут погоды снова отдаёт 503');
  assert.ok(!/WEATHER_STATE_UNAVAILABLE_FROM_CANONICAL_CHAIN/.test(ROUTE),
    'вернулся код «погода недоступна из сети» — это утверждение ложное');
  assert.ok(!/WEATHER_FORECAST_UNAVAILABLE_WITHOUT_CANONICAL_SOURCE/.test(ROUTE),
    'вернулся код «нет канонического источника прогноза»: источник — правило дня');
  assert.match(ROUTE, /currentDayId/, 'маршрут должен сам определять текущий день');
  assert.match(ROUTE, /canonical-schedule/, 'маршрут обязан называть источник значения');
  assert.match(ROUTE, /aof-core\/src\/state\.rs::weather_for_day/,
    'маршрут обязан называть правило, по которому считает день');
  assert.match(ROUTE, /weatherState/, 'аккаунт в сети остаётся подтверждением дня (кэш weather_crank)');
  assert.match(ROUTE, /forecast/, 'прогноз остаётся отдельным маршрутом');

  // Коды, обещавшие игроку закрытую погоду, удалены из словаря отказов: они
  // не возвращаются ни одним маршрутом и не должны висеть в семи языках.
  for (const code of [
    'WEATHER_STATE_UNAVAILABLE_FROM_CANONICAL_CHAIN',
    'WEATHER_FORECAST_UNAVAILABLE_WITHOUT_CANONICAL_SOURCE',
    'UNKNOWN_CANONICAL_WEATHER_VALUE',
  ]) {
    assert.ok(!API_ERROR_COPY.includes(code), `мёртвый код ${code} остался в apiErrorCopy`);
  }
});

test('зеркало в интерфейсе — то же правило дня', () => {
  const frontendMultiplier = (FRONTEND_SCHEDULE.match(/0x([0-9a-fA-F]+)n/) || [])[1];
  assert.ok(frontendMultiplier, 'в frontend/src/lib/weather.ts нет множителя дня');
  assert.equal(frontendMultiplier.toLowerCase(), MULTIPLIER_HEX.replace(/_/g, '').toLowerCase(),
    'множитель дня в интерфейсе разошёлся с ядром');
  for (const band of ['bucket <= 9) return 0', 'bucket <= 59) return 1', 'bucket <= 89) return 2']) {
    assert.ok(FRONTEND_SCHEDULE.includes(band), `в интерфейсе нет полосы "${band}"`);
  }
  // Если ни роут, ни аккаунт не ответили, интерфейс считает день тем же правилом,
  // а не показывает «нет данных сети» для работающей механики.
  assert.match(FRONTEND_SCHEDULE, /currentDayId/, 'у интерфейса нет номера дня из часов');
  assert.match(FRONTEND_SCHEDULE, /source: "canonical-schedule"/,
    'интерфейс обязан помечать значение, посчитанное правилом дня');
  assert.ok(!/Promise<WeatherSnapshot \| null>/.test(FRONTEND_SCHEDULE),
    'загрузчик погоды снова может вернуть «нет данных» для вычисляемой погоды');
  assert.match(FRONTEND_SCHEDULE, /currentDayId\(\)/, 'запасной путь по правилу дня пропал');
});
