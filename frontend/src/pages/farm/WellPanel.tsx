import { useState, useEffect } from "react";
import { Card } from "../../components/ui/Card";
import { UI_ICONS, resourceIcon } from "../../lib/visualAssets";
import { ResourceGlyph } from "../../components/visual/ResourceGlyph";
import { NoticeMsg } from "../../components/visual/NoticeMsg";
import { api } from "../../lib/api";
import { fetchWeatherSnapshot } from "../../lib/weather";
import { useWalletStr } from "../../lib/useWalletStr";
import { getMintAsync } from "../../lib/mints";
import { handleTxResponse } from "../../lib/txFlow";
import { WeatherRecorder } from "../../components/farm/WeatherRecorder";
import { forecastFromDayId } from "../../lib/weather";

const WEATHER_RATES = {
  drought: { label: "Блэкаут", icon: UI_ICONS.weatherBlackout, rate: 0, color: "#E2685F" },
  sunny: { label: "Номинал", icon: UI_ICONS.weatherNominal, rate: 5, color: "#E0708A" },
  rain: { label: "Скачок", icon: UI_ICONS.weatherSurge, rate: 15, color: "#8FB3DE" },
  festival: { label: "Френзи", icon: UI_ICONS.weatherFrenzy, rate: 20, color: "#A99BEC" },
} as const;

type WeatherKey = keyof typeof WEATHER_RATES;

function weatherKey(value: any): WeatherKey | null {
  const n = Number(value);
  if (n === 0) return "drought";
  if (n === 1) return "sunny";
  if (n === 2) return "rain";
  if (n === 3) return "festival";
  return null;
}

export function WellPanel() {
  const walletAddr = useWalletStr();
  const [weather, setWeather] = useState<any>(null);
  // Снимок канонической погоды: им питаются и ставка колодца, и барограф.
  const [snapshot, setSnapshot] = useState<any>(null);
  const [well, setWell] = useState<any>(null);
  const [waterMint, setWaterMint] = useState("");
  const [collecting, setCollecting] = useState(false);
  const [cranking, setCranking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loadState() {
    if (!walletAddr) return;
    // /weather/current и /query/weather-state читают один и тот же WeatherState PDA.
    // Берём первый: он же питает чип нагрузки в шапке, поэтому панель и шапка
    // больше не показывают разные состояния одного аккаунта.
    const [snap, wellState, mint] = await Promise.all([
      fetchWeatherSnapshot(),
      api.query.wellState(walletAddr).catch(() => null),
      getMintAsync("POWER"),
    ]);
    // Погода и ставка колодца приходят из lib/weather.ts, поэтому панель и
    // чип нагрузки в шапке всегда показывают одно и то же состояние.
    setSnapshot(snap ?? null);
    setWeather(snap ? { weather: snap.weatherIndex } : null);
    setWell(wellState);
    setWaterMint(mint);
  }

  useEffect(() => {
    loadState();
    const refresh = setInterval(loadState, 15000);
    return () => {
      clearInterval(refresh);
    };
  }, [walletAddr]);

  const key = weatherKey(weather?.weather);
  const w = key ? WEATHER_RATES[key] : null;


  async function crankWeather() {
    if (!walletAddr || cranking) return;
    setCranking(true);
    try {
      const response = await api.chain.weatherCrank({ cranker: walletAddr });
      const result = await handleTxResponse(response);
      setMessage(result.success ? "Нагрузка сети обновлена" : `${result.error}`);
      if (result.success) await loadState();
    } catch (e: any) {
      setMessage(`${e.message}`);
    } finally {
      setCranking(false);
    }
  }

  async function collect() {
    if (!walletAddr || !waterMint || collecting || !weather) return;
    setCollecting(true);
    try {
      const response = await api.chain.collectWellWater({ user: walletAddr, waterMint });
      const result = await handleTxResponse(response);
      setMessage(result.success ? "Станция обработана; баланс обновится после подтверждения" : `${result.error}`);
      if (result.success) await loadState();
    } catch (e: any) {
      setMessage(`${e.message}`);
    } finally {
      setCollecting(false);
    }
  }

  if (!walletAddr) {
    return <Card className="p-4"><h3 className="text-parchment font-bold text-lg flex items-center gap-2"><ResourceGlyph icon={UI_ICONS.gridStation} alt="" className="w-5 h-5" /> Сетевая станция</h3><p className="text-straw text-sm text-center py-4">Подключите кошелёк</p></Card>;
  }

  const forecast = typeof snapshot?.dayId === "number" ? forecastFromDayId(snapshot.dayId, 6) : [];

  return (
    <>
    <WeatherRecorder
      dayId={typeof snapshot?.dayId === "number" ? snapshot.dayId : null}
      weatherType={snapshot?.type ?? null}
      rate={typeof snapshot?.ratePerHour === "number" ? `${snapshot.ratePerHour} / час` : null}
      forecast={forecast}
      season={snapshot?.season ?? null}
      dayOfSeason={typeof snapshot?.dayOfSeason === "number" ? snapshot.dayOfSeason : null}
    />
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-parchment font-bold text-lg flex items-center gap-2"><ResourceGlyph icon={UI_ICONS.gridStation} alt="" className="w-5 h-5" /> Сетевая станция</h3>
        <span className="text-xs text-straw">Источник: сеть</span>
      </div>

      {!weather || !w ? (
        <div className="bg-gold-500/10 border border-gold-500/30 rounded-lg p-3 space-y-2">
          <p className="text-straw text-xs">WeatherState не найден. Без него программа не может рассчитать энергопоток.</p>
          <button onClick={crankWeather} disabled={cranking} className="w-full py-2 rounded-lg bg-gold-600 text-parchment text-sm font-bold disabled:opacity-50">
            {cranking ? "Обновляем…" : "Обновить нагрузку в сети"}
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <ResourceGlyph icon={w.icon} alt={w.label} className="w-14 h-14 mx-auto" />
            <div className="flex-1">
              <p className="text-straw text-xs">Нагрузка сети: <b style={{ color: w.color }}>{w.label}</b></p>
              <p className="text-straw text-xs inline-flex items-center gap-1">Скорость: <b className="text-parchment">{w.rate}</b> <ResourceGlyph icon={resourceIcon("POWER") || ""} alt="" className="w-3.5 h-3.5" />/час</p>
            </div>
          </div>

          <div className="bg-soil-800/50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-straw text-xs">Накопление</span>
              <span className="text-parchment font-bold text-sm">Определяется программой</span>
            </div>
            <p className="text-straw text-[10px] mt-2">
              Итоговый энергопоток считает сама сеть по времени и нагрузке;
              локальная оценка не показывается.
            </p>
            {!well && <p className="text-straw text-[10px] mt-2">Станции ещё нет в сети. Первый вызов создаёт её и начинает накопление.</p>}
          </div>

          <button onClick={collect} disabled={!waterMint || collecting} className="w-full py-2.5 rounded-lg bg-gradient-to-r from-water-600 to-wheat-600 text-parchment font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110 transition">
            {collecting ? "Обрабатываем…" : !well ? "Создать сетевую станцию" : "Собрать энергопоток"}
          </button>
        </>
      )}

      {message && <p className="text-straw text-xs text-center"><NoticeMsg text={message} /></p>}
      <p className="text-straw text-[10px] text-center">Итог считает сама сеть: локальная оценка не показывается.</p>
    </Card>
    </>
  );
}
