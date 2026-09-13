import { useToast } from "../../components/ui/Toast";
import { useState, useEffect } from "react";
import { Card } from "../../components/ui/Card";
import { api } from "../../lib/api";
import { useWalletStr } from "../../lib/useWalletStr";
import { handleTxResponse } from "../../lib/txFlow";
import { getMintAsync } from "../../lib/mints";

const OVEN_SIZES = {
  small:  { label: "Малая",  batchSize: 1, flour: 3,  water: 1, wood: 2, coal: 0, bread: 2,  time: 1800, icon: "🔥" },
  medium: { label: "Средняя", batchSize: 2, flour: 10, water: 3, wood: 0, coal: 2, bread: 8,  time: 3000, icon: "🔥🔥" },
  large:  { label: "Большая", batchSize: 4, flour: 24, water: 6, wood: 0, coal: 5, bread: 20, time: 4800, icon: "🔥🔥🔥" },
};

const FUEL_KIND = { wood: 0, coal: 1 };

interface OvenState {
  active: boolean;
  readyAt: number;
  breadReady: number;
}

export function OvenPanel() {
  const toast = useToast();
  const walletAddr = useWalletStr();
  const [size, setSize] = useState<keyof typeof OVEN_SIZES>("small");
  const [baking, setBaking] = useState(false);
  const [ovenState, setOvenState] = useState<OvenState | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (!ovenState?.active || !ovenState.readyAt) return;
    const interval = setInterval(() => {
      const left = Math.max(0, Math.floor((ovenState.readyAt - Date.now()) / 1000));
      setTimeLeft(left);
      if (left === 0) {
        // Готова!
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [ovenState]);

  async function startBaking() {
    if (!walletAddr) return;
    const m = OVEN_SIZES[size];
    const fuelKind = m.wood > 0 ? FUEL_KIND.wood : FUEL_KIND.coal;
    setBaking(true);
    try {
      const [flourMint, waterMint, woodMint, coalMint] = await Promise.all([
        getMintAsync("FLOUR"),
        getMintAsync("WATER"),
        getMintAsync("WOOD"),
        getMintAsync("COAL"),
      ]);
      if (!flourMint || !waterMint || !woodMint || !coalMint) {
        toast.show("❌ Mint-адреса не найдены");
        return;
      }
      const resp = await api.chain.startBaking({
        user: walletAddr,
        batchSize: m.batchSize,
        fuelKind,
        flourMint, waterMint, woodMint, coalMint,
      });
      const r = await handleTxResponse(resp);
      if (r.success) {
        toast.show(`🔥 Печь запущена! ${m.flour} муки → ${m.bread} хлеба`);
        setOvenState({
          active: true,
          readyAt: Date.now() + m.time * 1000,
          breadReady: m.bread,
        });
        setTimeLeft(m.time);
      } else {
        toast.show(`❌ ${r.error || "Ошибка"}`);
      }
    } catch (e: any) {
      toast.show(`❌ ${e.message || "Ошибка"}`);
    } finally {
      setBaking(false);
    }
  }

  async function collectBread() {
    if (!walletAddr || !ovenState) return;
    setBaking(true);
    try {
      const breadMint = await getMintAsync("BREAD");
      if (!breadMint) { toast.show("❌ Mint BREAD не найден"); return; }
      const resp = await api.chain.collectBread({
        user: walletAddr,
        breadMint,
      });
      const r = await handleTxResponse(resp);
      if (r.success) {
        toast.show(`🍞 Собрано ${ovenState.breadReady} хлеба!`);
        setOvenState(null);
        setTimeLeft(0);
      } else {
        toast.show(`❌ ${r.error || "Ошибка"}`);
      }
    } catch (e: any) {
      toast.show(`❌ ${e.message || "Ошибка"}`);
    } finally {
      setBaking(false);
    }
  }

  const m = OVEN_SIZES[size];
  const isReady = timeLeft === 0 && ovenState?.active;

  const formatTime = (sec: number) => {
    const mm = Math.floor(sec / 60);
    const ss = sec % 60;
    return `${mm}:${ss.toString().padStart(2, "0")}`;
  };

  if (!walletAddr) {
    return (
      <Card className="p-4">
        <h3 className="text-parchment font-bold text-lg">🔥 Печь</h3>
        <p className="text-straw text-sm text-center py-4">Подключите кошелёк</p>
      </Card>
    );
  }

  return (
    <Card className="p-4 space-y-3">
      <h3 className="text-parchment font-bold text-lg">🔥 Печь</h3>

      {!ovenState && (
        <>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(OVEN_SIZES) as Array<keyof typeof OVEN_SIZES>).map((key) => (
              <button
                key={key}
                onClick={() => setSize(key)}
                className={`p-2 rounded-lg text-center transition ${
                  size === key
                    ? "bg-red-600/30 border-2 border-red-500"
                    : "bg-soil-700/50 border border-straw/20 hover:border-red-500"
                }`}
              >
                <div className="text-xl">{OVEN_SIZES[key].icon}</div>
                <div className="text-[10px] text-parchment font-bold">{OVEN_SIZES[key].label}</div>
              </button>
            ))}
          </div>

          <div className="bg-soil-800/50 rounded-lg p-3 space-y-1 text-xs">
            <div className="flex justify-between"><span className="text-straw">Мука:</span><span className="text-parchment">{m.flour} 🥣</span></div>
            <div className="flex justify-between"><span className="text-straw">Вода:</span><span className="text-parchment">{m.water} 💧</span></div>
            {m.wood > 0 && <div className="flex justify-between"><span className="text-straw">Дрова:</span><span className="text-parchment">{m.wood} 🪵</span></div>}
            {m.coal > 0 && <div className="flex justify-between"><span className="text-straw">Уголь:</span><span className="text-parchment">{m.coal} ⬛</span></div>}
            <div className="flex justify-between"><span className="text-straw">На выходе:</span><span className="text-amber-400 font-bold">{m.bread} 🍞</span></div>
            <div className="flex justify-between"><span className="text-straw">Время:</span><span className="text-parchment">{formatTime(m.time)}</span></div>
          </div>

          <button
            onClick={startBaking}
            disabled={baking}
            className="w-full py-2 rounded-lg bg-gradient-to-r from-red-600 to-orange-600 text-parchment font-bold text-sm disabled:opacity-50"
          >
            {baking ? "🔥 Запуск..." : `🔥 Разжечь печь`}
          </button>
        </>
      )}

      {ovenState && (
        <div className="bg-soil-800/50 rounded-lg p-4 space-y-3">
          <div className="text-center">
            <div className="text-4xl mb-2 animate-pulse">🔥</div>
            {timeLeft > 0 ? (
              <>
                <p className="text-parchment font-bold">Выпечка...</p>
                <p className="text-red-400 text-2xl font-bold">{formatTime(timeLeft)}</p>
              </>
            ) : (
              <>
                <p className="text-parchment font-bold">Хлеб готов!</p>
                <p className="text-amber-400 text-2xl font-bold">{ovenState.breadReady} 🍞</p>
              </>
            )}
          </div>

          {isReady && (
            <button
              onClick={collectBread}
              disabled={baking}
              className="w-full py-2 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 text-parchment font-bold text-sm disabled:opacity-50"
            >
              {baking ? "..." : `🍞 Собрать хлеб`}
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
