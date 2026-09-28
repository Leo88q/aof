import { useEffect, useState } from "react";
import { Card } from "../../components/ui/Card";
import {
  DAYS_PER_SEASON,
  SEASON_ICONS,
  WEATHER_BY_INDEX,
  WEATHER_ICONS,
  WEATHER_LABELS,
  fetchWeatherSnapshot,
  seasonFromDayId,
  seasonTitle,
  weatherIndexForDay,
  type WeatherSnapshot,
} from "../../lib/weather";

/**
 * Календарь эпох.
 *
 * Дефект 2026-09-28: страница считала погоду дней сама — по своему хешу
 * (`dayId * 0x9E3779B9` с долями 20/30/40/10), из-за чего расписание не
 * совпадало с цепью ни в один день, а эффекты («Данные +10%») были выдуманы.
 * Теперь состояние дня читается из канонического WeatherState PDA, а сетка
 * эпохи строится функцией `weatherIndexForDay` — тем же правилом, что и в
 * aof-core (`weather_for_day`, 10/50/30/10). Сеть не хранит отдельного
 * прогноза: погода любого дня — чистая функция его номера, и это сказано игроку.
 */

interface DayCell {
  dayId: number;
  date: string;
  weatherIndex: number;
  isToday: boolean;
}

export function SeasonCalendar() {
  const [snapshot, setSnapshot] = useState<WeatherSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [alive, setAlive] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetchWeatherSnapshot()
      .then((data) => {
        if (!mounted) return;
        setSnapshot(data);
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [alive]);

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="text-parchment">Читаем состояние дня…</div>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <Card className="p-6 bg-soil-800 border border-straw/10 space-y-3">
        <h2 className="text-lg font-semibold text-parchment">Состояние дня недоступно</h2>
        <p className="text-straw text-sm leading-relaxed">
          Сеть не отдала аккаунт погоды. Календарь пуст намеренно: без данных сети
          расписание не достраивается.
        </p>
        <button className="nf-key" type="button" onClick={() => { setLoading(true); setAlive((v) => !v); }}>
          Прочитать ещё раз
        </button>
      </Card>
    );
  }

  const season = seasonFromDayId(snapshot.dayId);
  const todayIso = new Date(snapshot.dayId * 86_400_000).toISOString().slice(0, 10);
  const epochStart = snapshot.dayId - season.dayOfSeason;
  const days: DayCell[] = Array.from({ length: DAYS_PER_SEASON }, (_, i) => {
    const dayId = epochStart + i;
    return {
      dayId,
      date: new Date(dayId * 86_400_000).toISOString().slice(0, 10),
      weatherIndex: weatherIndexForDay(dayId),
      isToday: dayId === snapshot.dayId,
    };
  });

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-soil-800 border border-straw/10">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-parchment flex items-center gap-2">
              {SEASON_ICONS[season.season] && (
                <img src={SEASON_ICONS[season.season]} alt="" className="w-7 h-7 object-contain" />
              )}
              {seasonTitle(season.seasonIndex)}
            </h2>
            <p className="text-straw text-sm mt-1">
              День {season.dayOfSeason + 1} из {DAYS_PER_SEASON} · до смены эпохи {season.daysUntilNextSeason} дн.
            </p>
          </div>
          <div className="text-right text-xs text-straw">
            <div>Сегодня</div>
            <div className="text-parchment">{todayIso}</div>
          </div>
        </div>
      </Card>

      <Card className="p-4 bg-soil-800 border border-straw/10">
        <h3 className="text-lg font-semibold text-parchment mb-3">Состояние станции сегодня</h3>
        <div className="flex items-center gap-4">
          <img
            src={WEATHER_ICONS[snapshot.type]}
            alt=""
            className="w-12 h-12 object-contain"
          />
          <div>
            <div className="text-parchment font-semibold">{WEATHER_LABELS[snapshot.type]}</div>
            <div className="text-straw text-sm">
              {WEATHER_BY_INDEX[snapshot.weatherIndex]?.rate ?? 0} единиц ресурса в час
              {snapshot.source === "weather-state" ? " · чтение напрямую из аккаунта сети" : ""}
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4 bg-soil-800 border border-straw/10">
        <h3 className="text-lg font-semibold text-parchment mb-1">Эпоха целиком</h3>
        <p className="text-straw text-xs mb-4 leading-relaxed">
          Погода дня — следствие его номера, а не отдельный прогноз: доля блэкаута 10%,
          номинала 50%, скачка 30%, френзи 10%. Так же считает сеть, поэтому строку завтрашнего
          дня можно прочитать заранее.
        </p>
        <div className="grid grid-cols-7 gap-1.5">
          {days.map((day) => (
            <div
              key={day.dayId}
              className={
                "nf-plate nf-plate--icon rounded-lg p-1.5 text-center" +
                (day.isToday ? " outline outline-1 outline-wheat-300" : "")
              }
              title={`${day.date} · ${WEATHER_LABELS[WEATHER_BY_INDEX[day.weatherIndex].type]}`}
            >
              <img
                src={WEATHER_ICONS[WEATHER_BY_INDEX[day.weatherIndex].type]}
                alt=""
                className="w-6 h-6 object-contain mx-auto"
              />
              <div className="text-[10px] text-straw mt-0.5">{day.weatherIndex >= 0 ? day.date.slice(8) : "—"}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4 bg-soil-800 border border-straw/10">
        <h3 className="text-lg font-semibold text-parchment mb-3">Состояния сети</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Object.entries(WEATHER_BY_INDEX).map(([index, meta]) => (
            <div key={index} className="flex items-center gap-3">
              <img src={WEATHER_ICONS[meta.type]} alt="" className="w-8 h-8 object-contain" />
              <div>
                <div className="text-parchment text-sm font-semibold">{WEATHER_LABELS[meta.type]}</div>
                <div className="text-straw text-xs">{meta.rate} единиц ресурса в час</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
