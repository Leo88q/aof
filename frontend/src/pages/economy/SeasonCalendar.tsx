import { useEffect, useState } from "react";
import { useLocale } from "../../i18n/LocaleProvider";
import { seasonCalendarCopy } from "../../i18n/seasonCalendarCopy";
import { wellCopy } from "../../i18n/wellCopy";
import { labHeroCopy } from "../../i18n/labHeroCopy";
import { Card } from "../../components/ui/Card";
import {
  DAYS_PER_SEASON, SEASON_ICONS, SEASON_ROMAN, WEATHER_BY_INDEX, WEATHER_ICONS, fetchWeatherSnapshot, seasonFromDayId,
  weatherIndexForDay, type WeatherSnapshot,
} from "../../lib/weather";

/** The grid is derived from the verified day ID and the network's deterministic
 * weather function. Never anchor a fictional season to the browser clock. */
export function SeasonCalendar() {
  const { language } = useLocale();
  const copy = seasonCalendarCopy[language];
  const seasonNames = wellCopy[language].seasonNames;
  const loadNames = labHeroCopy[language].load;
  const [snapshot, setSnapshot] = useState<WeatherSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchWeatherSnapshot().then((next) => {
      if (active) {
        // The current-state route can return a weather type without its day ID.
        // Its snapshot then contains dayId 0; do not draw a guessed schedule.
        const valid = next && Number.isSafeInteger(next.dayId) && next.dayId > 0
          && Number.isFinite(new Date(next.dayId * 86400000).getTime())
          && WEATHER_BY_INDEX[next.weatherIndex]?.type === next.type;
        setSnapshot(valid ? next : null);
      }
    }).catch(() => { if (active) setSnapshot(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refreshKey]);

  if (loading) return <div lang={language} role="status" className="economy-empty"><p className="text-straw">{copy.reading}</p></div>;
  if (!snapshot) return (
    <div lang={language} role="status" className="economy-empty">
      <p className="text-gold-400">{copy.unavailable}</p>
      <p className="text-straw text-sm max-w-lg leading-relaxed">{copy.unavailableReason}</p>
      <button type="button" className="nf-key" onClick={() => setRefreshKey(n => n + 1)}>{copy.retry}</button>
    </div>
  );

  const season = seasonFromDayId(snapshot.dayId);
  const firstDayId = snapshot.dayId - season.dayOfSeason;
  const seasonName = seasonNames[season.season];
  const days = Array.from({ length: DAYS_PER_SEASON }, (_, index) => {
    const dayId = firstDayId + index;
    const weatherIndex = weatherIndexForDay(dayId);
    const weather = WEATHER_BY_INDEX[weatherIndex];
    const date = new Date(dayId * 86400000);
    return { dayId, day: index + 1, date, weather, today: dayId === snapshot.dayId };
  });
  const current = WEATHER_BY_INDEX[snapshot.weatherIndex];
  const rate = current.rate;
  const nameFor = (type: keyof typeof loadNames) => loadNames[type];

  const hourly = (value: number) => copy.rate.replace('{rate}', String(value));
  return (
    <div lang={language} className="space-y-6 min-w-0">
      <Card className="p-4 sm:p-6 bg-soil-800 border border-straw/10">
        <div className="flex flex-wrap items-center justify-between gap-4 min-w-0">
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold text-parchment flex flex-wrap items-center gap-2 break-words">
              <img src={SEASON_ICONS[season.season]} alt="" className="w-7 h-7 object-contain shrink-0" />
              {copy.epoch} {SEASON_ROMAN[season.seasonIndex]} · {seasonName}
            </h2>
            <p className="text-straw text-sm mt-1 break-words">
              {copy.dayOfSeason.replace('{day}', String(season.dayOfSeason + 1)).replace('{total}', String(DAYS_PER_SEASON))}
              {' · '}{copy.untilChange.replace('{days}', `${season.daysUntilNextSeason} ${copy.days}`)}
            </p>
          </div>
          <div className="text-sm text-straw">
            <div>{copy.today}</div>
            <div className="text-parchment">{new Date(snapshot.dayId * 86400000).toISOString().slice(0, 10)}</div>
          </div>
        </div>
      </Card>

      <Card className="p-4 bg-soil-800 border border-straw/10">
        <h3 className="text-lg font-semibold text-parchment mb-3">{copy.stationToday}</h3>
        <div className="flex items-center gap-4 min-w-0">
          <img src={WEATHER_ICONS[snapshot.type]} alt="" className="w-12 h-12 object-contain shrink-0" />
          <div className="min-w-0 break-words">
            <div className="text-parchment font-semibold">{nameFor(snapshot.type)}</div>
            <div className="text-straw text-sm">{hourly(rate)} · {copy.source}</div>
          </div>
        </div>
      </Card>

      <Card className="p-4 bg-soil-800 border border-straw/10">
        <h3 className="text-lg font-semibold text-parchment mb-1">{copy.fullSeason}</h3>
        <p className="text-straw text-xs mb-4 leading-relaxed">{copy.schedule}</p>
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5 min-w-0">
          {days.map(d => {
            const label = nameFor(d.weather.type);
            return (
              <div key={d.dayId}
                className={'nf-plate nf-plate--icon rounded-lg p-0.5 sm:p-1.5 text-center min-w-0' + (d.today ? ' outline outline-1 outline-wheat-300' : '')}
                title={`${d.date.toLocaleDateString(language, { day: 'numeric', month: 'short', timeZone: 'UTC' })} · ${label}`}
                aria-label={`${d.today ? copy.today + ': ' : ''}${copy.dayOfSeason.replace('{day}', String(d.day)).replace('{total}', String(DAYS_PER_SEASON))} · ${label}`}>
                <img src={WEATHER_ICONS[d.weather.type]} alt="" className="w-5 h-5 sm:w-6 sm:h-6 object-contain mx-auto max-w-full" />
                <div className="text-[10px] text-straw mt-0.5">{d.date.getUTCDate()}</div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-4 bg-soil-800 border border-straw/10">
        <h3 className="text-lg font-semibold text-parchment mb-3">{copy.networkStates}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Object.entries(WEATHER_BY_INDEX).map(([index, meta]) => (
            <div key={index} className="flex items-center gap-3 min-w-0">
              <img src={WEATHER_ICONS[meta.type]} alt="" className="w-8 h-8 object-contain shrink-0" />
              <div className="min-w-0 break-words">
                <div className="text-parchment text-sm font-semibold">{nameFor(meta.type)}</div>
                <div className="text-straw text-xs">{hourly(meta.rate)}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
