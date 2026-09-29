import { Panel, Readout, Readouts, Lamp, Lamps, Sticker } from "../../ui/forge/kit";
import { useLocale } from "../../i18n/LocaleProvider";
import { wellCopy } from "../../i18n/wellCopy";
import { labHeroCopy } from "../../i18n/labHeroCopy";
import { DrumChart } from "../../ui/forge/devices";

/**
 * К11 · Барограф на «Сетевой станции».
 *
 * Прибор пишет нагрузку сети на бумажную ленту. Данные не выдуманы: сетка
 * нагрузки и прогноз считаются той же формулой, что и в ядре
 * (aof-core/src/state.rs::weather_for_day — зеркало в lib/weather.ts), а
 * текущий день приходит из WeatherState. Перо стоит на реальном дне, лента
 * показывает дни вперёд по расписанию сети, а не «примерные» значения.
 */

const LOAD_BY_TYPE: Record<string, { level: number }> = {
  drought: { level: 0.02 }, sunny: { level: 0.32 },
  rain: { level: 0.68 }, festival: { level: 0.95 },
};

export function WeatherRecorder({
  dayId,
  weatherType,
  rate,
  forecast,
  season,
  dayOfSeason,
}: {
  /** Номер дня сети или null, если WeatherState не прочитан. */
  dayId: number | null;
  weatherType: string | null;
  rate: string | null;
  forecast: { dayOfSeason: number; type: string }[];
  season?: string | null;
  dayOfSeason?: number | null;
}) {
  const { language } = useLocale();
  const copy = wellCopy[language];
  const conditions = labHeroCopy[language].load;
  const label = (type: string) => conditions[type as keyof typeof conditions] ?? '—';
  const seasonName = season && copy.seasonNames[season as keyof typeof copy.seasonNames];
  const known = forecast.filter((d) => LOAD_BY_TYPE[d.type]);
  const points = known.map((d) => LOAD_BY_TYPE[d.type].level);
  const labels = known.map((d) => String(d.dayOfSeason));
  const current = weatherType ? LOAD_BY_TYPE[weatherType] : null;

  return (
    <Panel
      tier="panel"
      device="baro"
      className="mb-4"
      id={<Sticker alt>{copy.recorder}</Sticker>}
      meta={dayId === null ? copy.noTape : `${copy.day} ${dayId}`}
      title={copy.barograph}
      sub={seasonName ? `${copy.season}: ${seasonName}` : copy.unknownSeason}
    >
      <Lamps>
        <Lamp tone={current ? (current.level > 0.5 ? "ok" : "wait") : "wait"}>
          {current ? label(weatherType!) : copy.noConnection}
        </Lamp>
        <Lamp tone={forecast.length ? "ok" : "wait"}>
          {forecast.length ? `${copy.tapeFor} ${forecast.length} ${copy.days}` : copy.noForecast}
        </Lamp>
      </Lamps>

      <div style={{ marginTop: 14 }}>
        <DrumChart
          points={points}
          dayLabels={labels}
          ariaLabel={copy.barograph}
          scaleLabels={(['drought', 'sunny', 'festival'] as const).map(type => label(type).toLocaleUpperCase(language))}
        />
      </div>

      <div style={{ marginTop: 14 }}>
        <Readouts>
          <Readout label={copy.today} value={current ? label(weatherType!) : undefined} dash={!current} hint={`${copy.seasonDay}: ${dayOfSeason ?? "—"}`} />
          <Readout label={copy.flow} value={rate ?? undefined} dash={!rate} hint={copy.flowHint} />
          <Readout label={copy.pen} value={current ? `${Math.round(current.level * 100)}` : undefined} unit="%" dash={!current} hint={copy.penHint} />
        </Readouts>
      </div>
    </Panel>
  );
}
