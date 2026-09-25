import { useState, useEffect } from "react";
import { Card } from "../../components/ui/Card";
import { UI_ICONS } from "../../lib/visualAssets";
import { ResourceGlyph } from "../../components/visual/ResourceGlyph";
import { NoticeMsg } from "../../components/visual/NoticeMsg";
import { api } from "../../lib/api";
import { useWalletStr } from "../../lib/useWalletStr";
import { getMintAsync } from "../../lib/mints";
import { handleTxResponse } from "../../lib/txFlow";

const WEATHER_RATES = {
  drought: { label: "Блэкаут", icon: UI_ICONS.weatherBlackout, rate: 0, color: "#ef4444" },
  sunny: { label: "Номинал", icon: UI_ICONS.weatherNominal, rate: 5, color: "#f59e0b" },
  rain: { label: "Скачок", icon: UI_ICONS.weatherSurge, rate: 15, color: "#3b82f6" },
  festival: { label: "Френзи", icon: UI_ICONS.weatherFrenzy, rate: 20, color: "#a855f7" },
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
  const [well, setWell] = useState<any>(null);
  const [waterMint, setWaterMint] = useState("");
  const [collecting, setCollecting] = useState(false);
  const [cranking, setCranking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loadState() {
    if (!walletAddr) return;
    const [weatherState, wellState, mint] = await Promise.all([
      api.query.weatherState().catch(() => null),
      api.query.wellState(walletAddr).catch(() => null),
      getMintAsync("POWER"),
    ]);
    setWeather(weatherState);
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
      setMessage(result.success ? "✅ Нагрузка сети обновлена on-chain" : `❌ ${result.error}`);
      if (result.success) await loadState();
    } catch (e: any) {
      setMessage(`❌ ${e.message}`);
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
      setMessage(result.success ? "✅ Станция обработана on-chain; баланс обновится после подтверждения" : `❌ ${result.error}`);
      if (result.success) await loadState();
    } catch (e: any) {
      setMessage(`❌ ${e.message}`);
    } finally {
      setCollecting(false);
    }
  }

  if (!walletAddr) {
    return <Card className="p-4"><h3 className="text-parchment font-bold text-lg">🔋 Сетевая станция</h3><p className="text-straw text-sm text-center py-4">Подключите кошелёк</p></Card>;
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-parchment font-bold text-lg flex items-center gap-2">🔋 Сетевая станция</h3>
        <span className="text-xs text-straw">Источник: on-chain</span>
      </div>

      {!weather || !w ? (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 space-y-2">
          <p className="text-straw text-xs">WeatherState не найден. Без него программа не может рассчитать воду.</p>
          <button onClick={crankWeather} disabled={cranking} className="w-full py-2 rounded-lg bg-amber-600 text-parchment text-sm font-bold disabled:opacity-50">
            {cranking ? "Обновляем…" : "Обновить погоду on-chain"}
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <ResourceGlyph icon={w.icon} alt={w.label} className="w-14 h-14 mx-auto" />
            <div className="flex-1">
              <p className="text-straw text-xs">Нагрузка сети: <b style={{ color: w.color }}>{w.label}</b></p>
              <p className="text-straw text-xs">Скорость: <b className="text-parchment">{w.rate}</b> 💧/час</p>
            </div>
          </div>

          <div className="bg-soil-800/50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-straw text-xs">Накопление</span>
              <span className="text-parchment font-bold text-sm">Определяется программой</span>
            </div>
            <p className="text-straw text-[10px] mt-2">
              Итоговое количество воды вычисляется on-chain по времени и погоде;
              локальная оценка не показывается.
            </p>
            {!well && <p className="text-straw text-[10px] mt-2">PDA сетевой станции ещё нет. Первый вызов создаёт её и начинает накопление.</p>}
          </div>

          <button onClick={collect} disabled={!waterMint || collecting} className="w-full py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 text-parchment font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110 transition">
            {collecting ? "⏳ Обрабатываем…" : !well ? "💧 Создать колодец" : "💧 Собрать воду on-chain"}
          </button>
        </>
      )}

      {message && <p className="text-straw text-xs text-center"><NoticeMsg text={message} /></p>}
      <p className="text-straw text-[10px] text-center">Расчёт не является локальным балансом: итоговую эмиссию определяет aof-core.</p>
    </Card>
  );
}
