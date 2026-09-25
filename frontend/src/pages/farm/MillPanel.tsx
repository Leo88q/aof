import { useToast } from "../../components/ui/Toast";
import { useState, useEffect } from "react";
import { Card } from "../../components/ui/Card";
import { api } from "../../lib/api";
import { useWalletStr } from "../../lib/useWalletStr";
import { handleTxResponse } from "../../lib/txFlow";
import { getMintAsync } from "../../lib/mints";
import { UI_ICONS, resourceIcon } from "../../lib/visualAssets";
import { ResourceGlyph } from "../../components/visual/ResourceGlyph";

// Must match aof-core/src/instructions/start_milling.rs and constants.rs.
const MILL_SIZES = {
  small:  { label: "Малая",  batchSize: 1, wheat: 6,  stone: 1, flour: 3,  time: 3600, icon: UI_ICONS.mill, sizeCls: "w-4 h-4" },
  medium: { label: "Средняя", batchSize: 2, wheat: 18, stone: 2, flour: 10, time: 10800, icon: UI_ICONS.mill, sizeCls: "w-5 h-5" },
  large:  { label: "Большая", batchSize: 3, wheat: 40, stone: 4, flour: 24, time: 21600, icon: UI_ICONS.mill, sizeCls: "w-6 h-6" },
};

interface MillState {
  active: boolean;
  readyAt: number;  // timestamp в ms
  flourReady: number;
}

export function MillPanel() {
  const toast = useToast();
  const walletAddr = useWalletStr();
  const [size, setSize] = useState<keyof typeof MILL_SIZES>("small");
  const [milling, setMilling] = useState(false);
  const [millState, setMillState] = useState<MillState | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (!walletAddr) return;
    loadState();
    const interval = setInterval(loadState, 5000);
    return () => clearInterval(interval);
  }, [walletAddr]);

  useEffect(() => {
    if (!millState?.active || !millState.readyAt) return;
    const interval = setInterval(() => {
      const left = Math.max(0, Math.floor((millState.readyAt - Date.now()) / 1000));
      setTimeLeft(left);
      if (left === 0) {
        loadState();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [millState]);

  async function loadState() {
    if (!walletAddr) return;
    try {
      const state: any = await api.query.millState(walletAddr);
      if (!state?.inProgress) {
        setMillState(null);
        setTimeLeft(0);
        return;
      }
      const readyAt = Number(state.readyAt || 0) * 1000;
      setMillState({
        active: true,
        readyAt,
        flourReady: Number(state.outputFlour || 0),
      });
      setTimeLeft(Math.max(0, Math.floor((readyAt - Date.now()) / 1000)));
    } catch (e) {
      // A missing PDA is an empty mill, not a fabricated local timer.
      setMillState(null);
      setTimeLeft(0);
    }
  }

  async function startMilling() {
    if (!walletAddr) return;
    const m = MILL_SIZES[size];
    setMilling(true);
    try {
      const [wheatMint, stoneMint] = await Promise.all([
        getMintAsync("SYNAPSE"),
        getMintAsync("SILICON"),
      ]);
      if (!wheatMint || !stoneMint) {
        toast.show("❌ Mint-адреса не найдены");
        return;
      }
      const resp = await api.chain.startMilling({
        user: walletAddr,
        batchSize: m.batchSize,
        wheatMint,
        stoneMint,
      });
      const r = await handleTxResponse(resp);
      if (r.success) {
        toast.show(`✅ Переработка запущена: ${m.wheat} синапсов → ${m.flour} сигнала`);
        await loadState();
      } else {
        toast.show(`❌ ${r.error || "Error запуска"}`);
      }
    } catch (e: any) {
      toast.show(`❌ ${e.message || "Error"}`);
    } finally {
      setMilling(false);
    }
  }

  async function collectFlour() {
    if (!walletAddr || !millState) return;
    setMilling(true);
    try {
      const flourMint = await getMintAsync("SIGNAL");
      if (!flourMint) { toast.show("❌ Mint FLOUR не найден"); return; }
      const resp = await api.chain.collectFlour({
        user: walletAddr,
        flourMint,
      });
      const r = await handleTxResponse(resp);
      if (r.success) {
        toast.show(`🥣 Собрано ${millState.flourReady} сигнала!`);
        await loadState();
      } else {
        toast.show(`❌ ${r.error || "Error сбора"}`);
      }
    } catch (e: any) {
      toast.show(`❌ ${e.message || "Error"}`);
    } finally {
      setMilling(false);
    }
  }

  const m = MILL_SIZES[size];
  const isReady = timeLeft === 0 && millState?.active;

  const formatTime = (sec: number) => {
    const mm = Math.floor(sec / 60);
    const ss = sec % 60;
    return `${mm}:${ss.toString().padStart(2, "0")}`;
  };

  if (!walletAddr) {
    return (
      <Card className="p-4">
        <h3 className="text-parchment font-bold text-lg flex items-center gap-2"><ResourceGlyph icon={UI_ICONS.mill} alt="" className="w-5 h-5" /> Переработка</h3>
        <p className="text-straw text-sm text-center py-4">Подключите кошелёк</p>
      </Card>
    );
  }

  return (
    <Card className="p-4 space-y-3">
      <h3 className="text-parchment font-bold text-lg flex items-center gap-2"><ResourceGlyph icon={UI_ICONS.mill} alt="" className="w-5 h-5" /> Переработка</h3>

      {!millState && (
        <>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(MILL_SIZES) as Array<keyof typeof MILL_SIZES>).map((key) => (
              <button
                key={key}
                onClick={() => setSize(key)}
                className={`p-2 rounded-lg text-center transition ${
                  size === key
                    ? "bg-amber-600/30 border-2 border-amber-500"
                    : "bg-soil-700/50 border border-straw/20 hover:border-amber-500"
                }`}
              >
                <ResourceGlyph icon={MILL_SIZES[key].icon} alt="" className={(MILL_SIZES[key] as any).sizeCls ?? "w-5 h-5"} />
                <div className="text-[10px] text-parchment font-bold">{MILL_SIZES[key].label}</div>
              </button>
            ))}
          </div>

          <div className="bg-soil-800/50 rounded-lg p-3 space-y-1 text-xs">
            <div className="flex justify-between"><span className="text-straw">Синапс:</span><span className="text-parchment inline-flex items-center gap-1">{m.wheat} <ResourceGlyph icon={resourceIcon("wheat") || ""} alt="" className="w-3.5 h-3.5" /></span></div>
            <div className="flex justify-between"><span className="text-straw">Кремний:</span><span className="text-parchment inline-flex items-center gap-1">{m.stone} <ResourceGlyph icon={resourceIcon("stone") || ""} alt="" className="w-3.5 h-3.5" /></span></div>
            <div className="flex justify-between"><span className="text-straw">На выходе:</span><span className="text-wheat-500 font-bold inline-flex items-center gap-1">{m.flour} <ResourceGlyph icon={resourceIcon("flour") || ""} alt="" className="w-3.5 h-3.5" /></span></div>
            <div className="flex justify-between"><span className="text-straw">Время:</span><span className="text-parchment">{formatTime(m.time)}</span></div>
          </div>

          <button
            onClick={startMilling}
            disabled={milling}
            className="w-full py-2 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 text-parchment font-bold text-sm disabled:opacity-50"
          >
            {milling ? <span className="inline-flex items-center gap-1.5"><ResourceGlyph icon={UI_ICONS.mill} alt="" className="w-4 h-4" /> Запуск...</span> : <span className="inline-flex items-center gap-1.5"><ResourceGlyph icon={UI_ICONS.mill} alt="" className="w-4 h-4" /> Запустить помол</span>}
          </button>
        </>
      )}

      {millState && (
        <div className="bg-soil-800/50 rounded-lg p-4 space-y-3">
          <div className="text-center">
            <ResourceGlyph icon={UI_ICONS.mill} alt="" className="w-10 h-10 mx-auto animate-spin" />
            {timeLeft > 0 ? (
              <>
                <p className="text-parchment font-bold">Помол в процессе...</p>
                <p className="text-wheat-500 text-2xl font-bold">{formatTime(timeLeft)}</p>
              </>
            ) : (
              <>
                <p className="text-parchment font-bold">Сигнал готова!</p>
                <p className="text-wheat-500 text-2xl font-bold">{millState.flourReady} <ResourceGlyph icon={resourceIcon("FLOUR")} alt="" className="inline-block w-5 h-5 align-text-bottom" /></p>
              </>
            )}
          </div>

          {isReady && (
            <button
              onClick={collectFlour}
              disabled={milling}
              className="w-full py-2 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 text-parchment font-bold text-sm disabled:opacity-50"
            >
              {milling ? "..." : <span className="inline-flex items-center gap-1.5"><ResourceGlyph icon={resourceIcon("FLOUR")} alt="" className="w-4 h-4" /> Собрать муку</span>}
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
