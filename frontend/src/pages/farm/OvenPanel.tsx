import { useToast } from "../../components/ui/Toast";
import { useState, useEffect, useCallback, useRef } from "react";
import { useLocale } from "../../i18n/LocaleProvider";
import { labProcessCopy } from "../../i18n/labProcessCopy";
import { homeResourceNames } from "../../i18n/homeDetail";
import { Card } from "../../components/ui/Card";
import { api } from "../../lib/api";
import { useWalletStr } from "../../lib/useWalletStr";
import { handleTxResponse } from "../../lib/txFlow";
import { actionErrorFeedback } from "../../lib/txResponseFeedback";
import { walletRuntimeCopy } from "../../i18n/walletRuntimeCopy";
import { getMintAsync } from "../../lib/mints";
import { readEconomyBalances } from "../../lib/economyBalances";
import { formatResourceShortage, shortagesFromBalances } from "../../lib/resourceShortageMessage";
import { UI_ICONS, resourceIcon } from "../../lib/visualAssets";
import { ChainClocks } from "../../components/ChainClocks";
import { ResourceGlyph } from "../../components/visual/ResourceGlyph";

// Must match aof-core/src/instructions/start_model_training.rs and constants.rs.
const MODEL_SIZES = {
  small:  { batchSize: 1, signal: 4,  power: 3, circuit: 5,  compute: 2,  model: 2,  modelCompute: 3,  time: 7200,  icon: UI_ICONS.trainer, sizeCls: "w-4 h-4" },
  medium: { batchSize: 2, signal: 12, power: 8, circuit: 12, compute: 5,  model: 7,  modelCompute: 9,  time: 18000, icon: UI_ICONS.trainer, sizeCls: "w-5 h-5" },
  large:  { batchSize: 3, signal: 28, power: 18, circuit: 25, compute: 10, model: 18, modelCompute: 22, time: 36000, icon: UI_ICONS.trainer, sizeCls: "w-6 h-6" },
};

const FUEL_KIND = { circuit: 0, compute: 1 };

interface ModelState {
  active: boolean;
  readyAt: number;
  modelReady: number;
}

export function OvenPanel() {
  const { language } = useLocale();
  const copy = labProcessCopy[language];
  const resources = homeResourceNames[language];
  const toast = useToast();
  const walletAddr = useWalletStr();
  const [size, setSize] = useState<keyof typeof MODEL_SIZES>("small");
  const [fuel, setFuel] = useState<'circuit' | 'compute'>('circuit');
  const [baking, setBaking] = useState(false);
  const [modelState, setModelState] = useState<ModelState | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [readStatus, setReadStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [shortage, setShortage] = useState<string | null>(null);
  const requestSeq = useRef(0);
  const inFlight = useRef<string | null>(null);

  const loadState = useCallback(async () => {
    if (!walletAddr || inFlight.current === walletAddr) return;
    inFlight.current = walletAddr;
    const request = ++requestSeq.current;
    try {
      const state: any = await api.query.modelState(walletAddr);
      if (request !== requestSeq.current) return;
      if (!state?.inProgress) {
        setModelState(null);
        setTimeLeft(0);
      } else {
        const readyAt = Number(state.readyAt) * 1000;
        const result = Number(state.outputModel);
        if (!Number.isFinite(readyAt) || readyAt <= 0 || !Number.isFinite(result) || result < 0) {
          throw new Error('Invalid on-chain process state');
        }
        setModelState({ active: true, readyAt, modelReady: result });
        setTimeLeft(Math.max(0, Math.floor((readyAt - Date.now()) / 1000)));
      }
      setReadStatus('ready');
    } catch {
      if (request !== requestSeq.current) return;
      // Только сбой сети или битый счёт. Пустой PDA сюда больше не попадает.
      setModelState(null);
      setReadStatus('unavailable');
    } finally {
      if (request === requestSeq.current) inFlight.current = null;
    }
  }, [walletAddr]);

  useEffect(() => {
    setModelState(null);
    setReadStatus('loading');
    if (walletAddr) loadState();
    const interval = walletAddr ? setInterval(loadState, 5000) : null;
    return () => { requestSeq.current += 1; inFlight.current = null; if (interval) clearInterval(interval); };
  }, [walletAddr, loadState]);

  useEffect(() => {
    if (!modelState?.active || !modelState.readyAt) return;
    const interval = setInterval(() => {
      setTimeLeft(Math.max(0, Math.floor((modelState.readyAt - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [modelState]);

  useEffect(() => {
    if (!walletAddr || readStatus !== 'ready' || modelState) {
      setShortage(null);
      return;
    }
    let alive = true;
    const m = MODEL_SIZES[size];
    const fuelNeed = fuel === 'circuit'
      ? { resource: 'CIRCUIT', need: m.circuit }
      : { resource: 'COMPUTE', need: m.compute };
    Promise.all([
      api.query.balances(walletAddr).catch(() => null),
      api.energy.balance(walletAddr).catch(() => null),
    ]).then(([raw, energy]) => {
      if (!alive) return;
      const balances = readEconomyBalances(raw);
      const current = energy && typeof energy.amount === 'number' ? energy.amount : null;
      const missing = shortagesFromBalances(
        balances,
        [{ resource: 'SIGNAL', need: m.signal }, { resource: 'POWER', need: m.power }, fuelNeed],
        current === null ? null : { current, need: 2 },
      );
      setShortage(missing && missing.length > 0 ? formatResourceShortage(language, missing) : null);
    });
    return () => { alive = false; };
  }, [walletAddr, readStatus, modelState, size, fuel, language]);

  async function startModelTraining() {
    if (!walletAddr) return;
    const m = MODEL_SIZES[size];
    const fuelKind = FUEL_KIND[fuel];
    const resultAmount = fuel === 'circuit' ? m.model : m.modelCompute;
    const fuelNeed = fuel === 'circuit'
      ? { resource: 'CIRCUIT', need: m.circuit }
      : { resource: 'COMPUTE', need: m.compute };
    setBaking(true);
    try {
      const balances = readEconomyBalances(await api.query.balances(walletAddr).catch(() => null));
      const energy = await api.energy.balance(walletAddr).catch(() => null);
      const current = energy && typeof energy.amount === 'number' ? energy.amount : null;
      const missing = shortagesFromBalances(
        balances,
        [{ resource: 'SIGNAL', need: m.signal }, { resource: 'POWER', need: m.power }, fuelNeed],
        current === null ? null : { current, need: 2 },
      );
      if (missing && missing.length > 0) {
        const text = formatResourceShortage(language, missing);
        setShortage(text);
        toast.show(text, "error", language);
        return;
      }
      const [signalMint, powerMint, circuitMint, computeMint] = await Promise.all([
        getMintAsync("SIGNAL"),
        getMintAsync("POWER"),
        getMintAsync("CIRCUIT"),
        getMintAsync("COMPUTE"),
      ]);
      if (!signalMint || !powerMint || !circuitMint || !computeMint) {
        toast.show(copy.missingMints, "error", language);
        return;
      }
      const resp = await api.chain.startModelTraining({
        user: walletAddr,
        batchSize: m.batchSize,
        fuelKind,
        signalMint, powerMint, circuitMint, computeMint,
      });
      const r = await handleTxResponse(resp);
      if (r.success) {
        toast.show(`✅ ${copy.oven.started(m.signal, resultAmount)}`, "success", language);
        await loadState();
      } else {
        toast.show(`${r.error || copy.failed}`, "error", language);
      }
    } catch (e: any) {
      toast.show(actionErrorFeedback(e, language, walletRuntimeCopy[language].unconfirmedResponse), "error", language);
    } finally {
      setBaking(false);
    }
  }

  async function collectModel() {
    if (!walletAddr || !modelState) return;
    setBaking(true);
    try {
      const modelMint = await getMintAsync("MODEL");
      if (!modelMint) { toast.show(copy.missingResultMint, "error", language); return; }
      const resp = await api.chain.collectModel({
        user: walletAddr,
        modelMint,
      });
      const r = await handleTxResponse(resp);
      if (r.success) {
        toast.show(`🍞 ${copy.oven.collected(modelState.modelReady)}`, "success", language);
        await loadState();
      } else {
        toast.show(`${r.error || copy.failed}`, "error", language);
      }
    } catch (e: any) {
      toast.show(actionErrorFeedback(e, language, walletRuntimeCopy[language].unconfirmedResponse), "error", language);
    } finally {
      setBaking(false);
    }
  }

  const m = MODEL_SIZES[size];
  const isReady = readStatus === 'ready' && timeLeft === 0 && modelState?.active;
  const resultAmount = fuel === 'circuit' ? m.model : m.modelCompute;

  const formatTime = (sec: number) => {
    const mm = Math.floor(sec / 60);
    const ss = sec % 60;
    const hh = Math.floor(mm / 60);
    return hh > 0 ? `${hh}:${(mm % 60).toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}` : `${mm}:${ss.toString().padStart(2, "0")}`;
  };

  if (!walletAddr) {
    return <div lang={language}><Card className="p-4">
      <h3 className="text-parchment font-bold text-lg flex items-center gap-2"><ResourceGlyph icon={UI_ICONS.trainer} alt="" className="w-5 h-5" /> {copy.oven.title}</h3>
      <p className="text-straw text-sm text-center py-4">{copy.connectWallet}</p>
    </Card></div>;
  }

  return (
    <div lang={language}><Card className="p-4 space-y-3">
      <h3 className="text-parchment font-bold text-lg flex items-center gap-2"><ResourceGlyph icon={UI_ICONS.trainer} alt="" className="w-5 h-5" /> {copy.oven.title}</h3>
      {readStatus === 'loading' && <p role="status" className="text-straw text-sm text-center py-4">{copy.loading}</p>}
      {readStatus === 'unavailable' && <p role="alert" className="text-straw text-sm text-center py-4">{copy.unavailable}</p>}
      {readStatus === 'ready' && !modelState && (
        <>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(MODEL_SIZES) as Array<keyof typeof MODEL_SIZES>).map((key) => (
              <button type="button" key={key} aria-pressed={size === key} onClick={() => setSize(key)}
                className={`min-w-0 p-2 rounded-lg text-center transition [overflow-wrap:anywhere] ${size === key
                  ? "bg-ember-600/30 border-2 border-ember-500" : "bg-soil-700/50 border border-straw/20 hover:border-ember-500"}`}>
                <ResourceGlyph icon={MODEL_SIZES[key].icon} alt="" className={MODEL_SIZES[key].sizeCls} />
                <div className="text-[10px] text-parchment font-bold">{copy.sizes[key]}</div>
              </button>
            ))}
          </div>
          <fieldset className="flex flex-wrap gap-2 text-xs text-straw">
            <legend className="mb-1">{copy.oven.fuel}</legend>
            {(['circuit', 'compute'] as const).map(option => (
              <label key={option} className="inline-flex items-center gap-1 rounded-lg bg-soil-800 px-2 py-1.5 [overflow-wrap:anywhere]">
                <input type="radio" name="training-fuel" checked={fuel === option} onChange={() => setFuel(option)} />
                {resources[option === 'circuit' ? 'circuit' : 'compute']}
              </label>
            ))}
          </fieldset>
          <div className="bg-soil-800/50 rounded-lg p-3 space-y-1 text-xs">
            <div className="flex flex-wrap justify-between gap-1"><span className="text-straw">{resources.signal}:</span><span className="text-parchment inline-flex items-center gap-1">{m.signal} <ResourceGlyph icon={resourceIcon("SIGNAL") || ""} alt="" className="w-4 h-4" /></span></div>
            <div className="flex flex-wrap justify-between gap-1"><span className="text-straw">{resources.power}:</span><span className="text-parchment inline-flex items-center gap-1">{m.power} <ResourceGlyph icon={resourceIcon("POWER") || ""} alt="" className="w-4 h-4" /></span></div>
            <div className="flex flex-wrap justify-between gap-1"><span className="text-straw">{resources[fuel === 'circuit' ? 'circuit' : 'compute']}:</span><span className="text-parchment inline-flex items-center gap-1">{fuel === 'circuit' ? m.circuit : m.compute} <ResourceGlyph icon={resourceIcon(fuel === 'circuit' ? "CIRCUIT" : "COMPUTE") || ""} alt="" className="w-4 h-4" /></span></div>
            <div className="flex flex-wrap justify-between gap-1"><span className="text-straw">{copy.output}:</span><span className="text-gold-400 font-bold inline-flex items-center gap-1">{resultAmount} <ResourceGlyph icon={resourceIcon("MODEL") || ""} alt="" className="w-4 h-4" /></span></div>
            <div className="flex flex-wrap justify-between gap-1"><span className="text-straw">{copy.energy}:</span><span className="text-parchment">2</span></div>
            <div className="flex flex-wrap justify-between gap-1"><span className="text-straw">{copy.duration}:</span><span className="text-parchment">{copy.hours(m.time / 3600)}</span></div>
          </div>
          {shortage && <p role="alert" className="text-gold-400 text-xs [overflow-wrap:anywhere]">{shortage}</p>}
          <ChainClocks />
          <button type="button" onClick={startModelTraining} disabled={baking}
            className="w-full py-2 rounded-lg bg-gradient-to-r from-ember-600 to-gold-600 text-parchment font-bold text-sm disabled:opacity-50 [overflow-wrap:anywhere]">
            {baking ? copy.oven.starting : copy.oven.start}
          </button>
        </>
      )}
      {readStatus === 'ready' && modelState && (
        <div className="bg-soil-800/50 rounded-lg p-4 space-y-3">
          <div className="text-center">
            <ResourceGlyph icon={UI_ICONS.trainer} alt="" className="w-10 h-10 mx-auto animate-pulse" />
            {timeLeft > 0 ? <>
              <p className="text-parchment font-bold">{copy.oven.running}</p>
              <p className="text-ember-400 text-2xl font-bold">{formatTime(timeLeft)}</p>
            </> : <>
              <p className="text-parchment font-bold">{copy.oven.ready}</p>
              <p className="text-gold-400 text-2xl font-bold inline-flex items-center gap-2 justify-center">{modelState.modelReady} <ResourceGlyph icon={resourceIcon("MODEL") || ""} alt="" className="w-6 h-6" /></p>
            </>}
          </div>
          {isReady && <button type="button" onClick={collectModel} disabled={baking} className="btn btn-primary">
            {baking ? copy.oven.starting : copy.oven.collect}
          </button>}
        </div>
      )}
    </Card></div>
  );
}
