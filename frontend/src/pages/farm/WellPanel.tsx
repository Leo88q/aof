import { useState, useEffect } from "react";
import { useLocale } from "../../i18n/LocaleProvider";
import { wellCopy } from "../../i18n/wellCopy";
import { labHeroCopy } from "../../i18n/labHeroCopy";
import { Card } from "../../components/ui/Card";
import { UI_ICONS, resourceIcon } from "../../lib/visualAssets";
import { ResourceGlyph } from "../../components/visual/ResourceGlyph";
import { NoticeMsg } from "../../components/visual/NoticeMsg";
import { api } from "../../lib/api";
import { fetchWeatherSnapshot } from "../../lib/weather";
import { useWalletStr } from "../../lib/useWalletStr";
import { getMintAsync } from "../../lib/mints";
import { handleTxResponse } from "../../lib/txFlow";
import { actionErrorFeedback } from "../../lib/txResponseFeedback";
import { walletRuntimeCopy } from "../../i18n/walletRuntimeCopy";
import { WeatherRecorder } from "../../components/farm/WeatherRecorder";
import { forecastFromDayId } from "../../lib/weather";
import { stationLastCollectedAt } from "./wellReadings";
import { WellHall } from "./WellHall";

const WEATHER_RATES = {
  drought: { icon: UI_ICONS.weatherBlackout, rate: 0, color: "#E2685F" },
  sunny: { icon: UI_ICONS.weatherNominal, rate: 5, color: "#E0708A" },
  rain: { icon: UI_ICONS.weatherSurge, rate: 15, color: "#8FB3DE" },
  festival: { icon: UI_ICONS.weatherFrenzy, rate: 20, color: "#A99BEC" },
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
  const { language } = useLocale();
  const copy = wellCopy[language];
  const conditions = labHeroCopy[language].load;
  const walletAddr = useWalletStr();
  const [weather, setWeather] = useState<any>(null);
  // Снимок канонической погоды: им питаются и ставка колодца, и барограф.
  const [snapshot, setSnapshot] = useState<any>(null);
  const [well, setWell] = useState<any>(null);
  const [powerMint, setPowerMint] = useState("");
  const [collecting, setCollecting] = useState(false);
  const [cranking, setCranking] = useState(false);
  const [message, setMessage] = useState<{ language: typeof language; text: string } | null>(null);

  async function loadState() {
    if (!walletAddr) return;
    // /weather/current и /query/weather-state читают один и тот же WeatherState PDA.
    // Берём первый: он же питает чип нагрузки в шапке, поэтому панель и шапка
    // больше не показывают разные состояния одного аккаунта.
    const [snap, gridState, mint] = await Promise.all([
      fetchWeatherSnapshot(),
      api.query.gridState(walletAddr).catch(() => null),
      getMintAsync("POWER"),
    ]);
    // Погода и ставка колодца приходят из lib/weather.ts, поэтому панель и
    // чип нагрузки в шапке всегда показывают одно и то же состояние.
    setSnapshot(snap ?? null);
    // A day-rule reading is not the WeatherState account. Collect requires that account.
    setWeather(snap && snap.weatherAccountPresent !== false ? { weather: snap.weatherIndex } : null);
    setWell(gridState);
    setPowerMint(mint);
  }

  useEffect(() => {
    loadState();
    const refresh = setInterval(() => {
      if (document.hidden) return;
      void loadState();
    }, 15000);
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
      setMessage({ language, text: result.success ? copy.loadUpdated : (result.error || copy.failed) });
      if (result.success) await loadState();
    } catch (e: any) {
      setMessage({ language, text: actionErrorFeedback(e, language, walletRuntimeCopy[language].unconfirmedResponse) });
    } finally {
      setCranking(false);
    }
  }

  async function collect() {
    if (!walletAddr || !powerMint || collecting || !weather) return;
    setCollecting(true);
    try {
      const response = await api.chain.collectPower({ user: walletAddr, powerMint });
      const result = await handleTxResponse(response);
      setMessage({ language, text: result.success ? copy.collectionSubmitted : (result.error || copy.failed) });
      if (result.success) await loadState();
    } catch (e: any) {
      setMessage({ language, text: actionErrorFeedback(e, language, walletRuntimeCopy[language].unconfirmedResponse) });
    } finally {
      setCollecting(false);
    }
  }

  if (!walletAddr) {
    return <div lang={language}><WellHall language={language} active={false} lastCollectedAt={null} /><Card className="p-4"><h3 className="text-parchment font-bold text-lg flex items-center gap-2"><ResourceGlyph icon={UI_ICONS.gridStation} alt="" className="w-5 h-5" /> {copy.station}</h3><p className="text-straw text-sm text-center py-4">{copy.connectWallet}</p></Card></div>;
  }

  const forecast = typeof snapshot?.dayId === "number" ? forecastFromDayId(snapshot.dayId, 6) : [];

  return (
    <div lang={language}>
    <WellHall language={language} active={Boolean(well)} lastCollectedAt={stationLastCollectedAt(well)} />
    <WeatherRecorder
      dayId={typeof snapshot?.dayId === "number" ? snapshot.dayId : null}
      weatherType={snapshot?.type ?? null}
      rate={typeof snapshot?.ratePerHour === "number" ? `${snapshot.ratePerHour} ${copy.perHour}` : null}
      forecast={forecast}
      season={snapshot?.season ?? null}
      dayOfSeason={typeof snapshot?.dayOfSeason === "number" ? snapshot.dayOfSeason : null}
    />
    <Card className="p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-parchment font-bold text-lg flex items-center gap-2"><ResourceGlyph icon={UI_ICONS.gridStation} alt="" className="w-5 h-5" /> {copy.station}</h3>
        <span className="text-xs text-straw">{copy.sourceNetwork}</span>
      </div>

      {!weather || !w ? (
        <div className="bg-gold-500/10 border border-gold-500/30 rounded-lg p-3 space-y-2">
          <p className="text-straw text-xs">{copy.missingState}</p>
          <button onClick={crankWeather} disabled={cranking} className="w-full py-2 rounded-lg bg-gold-600 text-parchment text-sm font-bold disabled:opacity-50">
            {cranking ? copy.refreshing : copy.refresh}
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <ResourceGlyph icon={w.icon} alt={conditions[key!]} className="w-14 h-14 mx-auto" />
            <div className="flex-1">
              <p className="text-straw text-xs">{copy.load}: <b style={{ color: w.color }}>{conditions[key!]}</b></p>
              <p className="text-straw text-xs inline-flex items-center gap-1">{copy.rate}: <b className="text-parchment">{w.rate}</b> <ResourceGlyph icon={resourceIcon("POWER") || ""} alt="" className="w-3.5 h-3.5" />{copy.perHour}</p>
            </div>
          </div>

          <div className="bg-soil-800/50 rounded-lg p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="text-straw text-xs">{copy.accumulation}</span>
              <span className="text-parchment font-bold text-sm">{copy.onChain}</span>
            </div>
            <p className="text-straw text-[10px] mt-2">
              {copy.networkCalculation}
            </p>
            {!well && <p className="text-straw text-[10px] mt-2">{copy.noStation}</p>}
          </div>

          <button onClick={collect} disabled={!powerMint || collecting} className="w-full py-2.5 rounded-lg bg-gradient-to-r from-info-600 to-accent-600 text-parchment font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110 transition">
            {collecting ? copy.processing : !well ? copy.create : copy.collect}
          </button>
        </>
      )}

      {message?.language === language && <p className="text-straw text-xs text-center"><NoticeMsg text={message.text} /></p>}
      <p className="text-straw text-[10px] text-center">{copy.noLocalEstimate}</p>
    </Card>
    </div>
  );
}
