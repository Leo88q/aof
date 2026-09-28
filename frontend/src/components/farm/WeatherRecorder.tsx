import { Panel, Readout, Readouts, Lamp, Lamps, Sticker } from "../../ui/forge/kit";
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

const LOAD_BY_TYPE: Record<string, { label: string; level: number; rate: string }> = {
  drought: { label: "Блэкаут", level: 0.02, rate: "0 / час" },
  sunny: { label: "Номинал", level: 0.32, rate: "5 / час" },
  rain: { label: "Скачок", level: 0.68, rate: "15 / час" },
  festival: { label: "Френзи", level: 0.95, rate: "20 / час" },
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
  const known = forecast.filter((d) => LOAD_BY_TYPE[d.type]);
  const points = known.map((d) => LOAD_BY_TYPE[d.type].level);
  const labels = known.map((d) => String(d.dayOfSeason));
  const current = weatherType ? LOAD_BY_TYPE[weatherType] : null;

  return (
    <Panel
      tier="panel"
      device="baro"
      className="mb-4"
      id={<Sticker alt>НАГРУЗКА СЕТИ</Sticker>}
      meta={dayId === null ? "ЛЕНТА НЕ ЗАПРАВЛЕНА" : `ДЕНЬ ${dayId}`}
      title="Барограф нагрузки"
      sub={season ? `сезон: ${season}` : "сезон неизвестен"}
    >
      <Lamps>
        <Lamp tone={current ? (current.level > 0.5 ? "ok" : "wait") : "wait"}>
          {current ? current.label : "нет связи с сетью"}
        </Lamp>
        <Lamp tone={forecast.length ? "ok" : "wait"}>
          {forecast.length ? `лента на ${forecast.length} дн.` : "прогноза нет"}
        </Lamp>
      </Lamps>

      <div style={{ marginTop: 14 }}>
        <DrumChart
          points={points}
          dayLabels={labels}
          scaleLabels={["БЛЭКАУТ", "НОМИНАЛ", "ФРЕНЗИ"]}
        />
      </div>

      <div style={{ marginTop: 14 }}>
        <Readouts>
          <Readout label="Сегодня" value={current ? current.label : undefined} dash={!current} hint={`день сезона: ${dayOfSeason ?? "—"}`} />
          <Readout label="Поток" value={rate ?? undefined} dash={!rate} hint="энергопоток в час" />
          <Readout label="Перо" value={current ? `${Math.round(current.level * 100)}` : undefined} unit="%" dash={!current} hint="высота записи" />
        </Readouts>
      </div>
    </Panel>
  );
}
