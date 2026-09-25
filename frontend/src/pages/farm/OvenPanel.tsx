import { useToast } from "../../components/ui/Toast";
import { useState, useEffect } from "react";
import { Card } from "../../components/ui/Card";
import { api } from "../../lib/api";
import { useWalletStr } from "../../lib/useWalletStr";
import { handleTxResponse } from "../../lib/txFlow";
import { getMintAsync } from "../../lib/mints";
import { UI_ICONS, resourceIcon } from "../../lib/visualAssets";
import { ResourceGlyph } from "../../components/visual/ResourceGlyph";

// Must match aof-core/src/instructions/start_baking.rs and constants.rs.
const OVEN_SIZES = {
  small:  { label: "Малая",  batchSize: 1, flour: 4,  water: 3, wood: 5,  coal: 2,  bread: 2,  time: 7200,  icon: UI_ICONS.trainer, sizeCls: "w-4 h-4" },
  medium: { label: "Средняя", batchSize: 2, flour: 12, water: 8, wood: 12, coal: 5,  bread: 7,  time: 18000, icon: "🔥🔥" },
  large:  { label: "Большая", batchSize: 3, flour: 28, water: 18, wood: 25, coal: 10, bread: 18, time: 36000, icon: UI_ICONS.trainer, sizeCls: "w-6 h-6" },
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

  async function loadState() {
    if (!walletAddr) return;
    try {
      const state: any = await api.query.ovenState(walletAddr);
      if (!state?.inProgress) {
        setOvenState(null);
        setTimeLeft(0);
        return;
      }
      const readyAt = Number(state.readyAt || 0) * 1000;
      setOvenState({ active: true, readyAt, breadReady: Number(state.outputBread || 0) });
      setTimeLeft(Math.max(0, Math.floor((readyAt - Date.now()) / 1000)));
    } catch {
      setOvenState(null);
      setTimeLeft(0);
    }
  }

  useEffect(() => {
    loadState();
    const interval = setInterval(loadState, 5000);
    return () => clearInterval(interval);
  }, [walletAddr]);

  async function startBaking() {
    if (!walletAddr) return;
    const m = OVEN_SIZES[size];
    const fuelKind = m.wood > 0 ? FUEL_KIND.wood : FUEL_KIND.coal;
    setBaking(true);
    try {
      const [flourMint, waterMint, woodMint, coalMint] = await Promise.all([
        getMintAsync("SIGNAL"),
        getMintAsync("POWER"),
        getMintAsync("CIRCUIT"),
        getMintAsync("COMPUTE"),
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
        toast.show(`🔥 Тренировка запущена! ${m.flour} сигнала → ${m.bread} модели`);
        await loadState();
      } else {
        toast.show(`❌ ${r.error || "Error"}`);
      }
    } catch (e: any) {
      toast.show(`❌ ${e.message || "Error"}`);
    } finally {
      setBaking(false);
    }
  }

  async function collectBread() {
    if (!walletAddr || !ovenState) return;
    setBaking(true);
    try {
      const breadMint = await getMintAsync("MODEL");
      if (!breadMint) { toast.show("❌ Mint BREAD не найден"); return; }
      const resp = await api.chain.collectBread({
        user: walletAddr,
        breadMint,
      });
      const r = await handleTxResponse(resp);
      if (r.success) {
        toast.show(`🍞 Собрано ${ovenState.breadReady} модели!`);
        await loadState();
      } else {
        toast.show(`❌ ${r.error || "Error"}`);
      }
    } catch (e: any) {
      toast.show(`❌ ${e.message || "Error"}`);
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
        <h3 className="text-parchment font-bold text-lg flex items-center gap-2"><ResourceGlyph icon={UI_ICONS.trainer} alt="" className="w-5 h-5" /> Тренировка</h3>
        <p className="text-straw text-sm text-center py-4">Подключите кошелёк</p>
      </Card>
    );
  }

  return (
    <Card className="p-4 space-y-3">
      <h3 className="text-parchment font-bold text-lg flex items-center gap-2"><ResourceGlyph icon={UI_ICONS.trainer} alt="" className="w-5 h-5" /> Тренировка</h3>

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
                <ResourceGlyph icon={OVEN_SIZES[key].icon} alt="" className={(OVEN_SIZES[key] as any).sizeCls ?? "w-5 h-5"} />
                <div className="text-[10px] text-parchment font-bold">{OVEN_SIZES[key].label}</div>
              </button>
            ))}
          </div>

          <div className="bg-soil-800/50 rounded-lg p-3 space-y-1 text-xs">
            <div className="flex justify-between"><span className="text-straw">Сигнал:</span><span className="text-parchment">{m.flour} 🥣</span></div>
            <div className="flex justify-between"><span className="text-straw">Энергопоток:</span><span className="text-parchment">{m.water} 💧</span></div>
            {m.wood > 0 && <div className="flex justify-between"><span className="text-straw">Дрова:</span><span className="text-parchment">{m.wood} 🪵</span></div>}
            {m.coal > 0 && <div className="flex justify-between"><span className="text-straw">Вычисления:</span><span className="text-parchment">{m.coal} ⬛</span></div>}
            <div className="flex justify-between"><span className="text-straw">На выходе:</span><span className="text-amber-400 font-bold">{m.bread} 🍞</span></div>
            <div className="flex justify-between"><span className="text-straw">Время:</span><span className="text-parchment">{formatTime(m.time)}</span></div>
          </div>

          <button
            onClick={startBaking}
            disabled={baking}
            className="w-full py-2 rounded-lg bg-gradient-to-r from-red-600 to-orange-600 text-parchment font-bold text-sm disabled:opacity-50"
          >
            {baking ? <span className="inline-flex items-center gap-1.5"><ResourceGlyph icon={UI_ICONS.trainer} alt="" className="w-4 h-4" /> Запуск...</span> : <span className="inline-flex items-center gap-1.5"><ResourceGlyph icon={UI_ICONS.trainer} alt="" className="w-4 h-4" /> Запустить тренировку</span>}
          </button>
        </>
      )}

      {ovenState && (
        <div className="bg-soil-800/50 rounded-lg p-4 space-y-3">
          <div className="text-center">
            <ResourceGlyph icon={UI_ICONS.trainer} alt="" className="w-10 h-10 mx-auto animate-pulse" />
            {timeLeft > 0 ? (
              <>
                <p className="text-parchment font-bold">Тренировка модели…</p>
                <p className="text-red-400 text-2xl font-bold">{formatTime(timeLeft)}</p>
              </>
            ) : (
              <>
                <p className="text-parchment font-bold">Модель готов!</p>
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
              {baking ? "..." : `🍞 Собрать модель`}
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
