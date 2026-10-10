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
import { ResourceGlyph } from "../../components/visual/ResourceGlyph";

// Must match aof-core/src/instructions/start_signal_processing.rs and constants.rs.
const SIGNAL_SIZES = {
  small:  { batchSize: 1, synapse: 6,  silicon: 1, signal: 3,  time: 3600, icon: UI_ICONS.mill, sizeCls: "w-4 h-4" },
  medium: { batchSize: 2, synapse: 18, silicon: 2, signal: 10, time: 10800, icon: UI_ICONS.mill, sizeCls: "w-5 h-5" },
  large:  { batchSize: 3, synapse: 40, silicon: 4, signal: 24, time: 21600, icon: UI_ICONS.mill, sizeCls: "w-6 h-6" },
};

interface SignalState {
  active: boolean;
  readyAt: number;  // timestamp в ms
  signalReady: number;
}

export function MillPanel() {
  const { language } = useLocale();
  const copy = labProcessCopy[language];
  const resources = homeResourceNames[language];
  const toast = useToast();
  const walletAddr = useWalletStr();
  const [size, setSize] = useState<keyof typeof SIGNAL_SIZES>("small");
  const [milling, setMilling] = useState(false);
  const [signalState, setSignalState] = useState<SignalState | null>(null);
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
      const state: any = await api.query.signalState(walletAddr);
      if (request !== requestSeq.current) return;
      if (!state?.inProgress) {
        setSignalState(null);
        setTimeLeft(0);
      } else {
        const readyAt = Number(state.readyAt) * 1000;
        const result = Number(state.outputSignal);
        if (!Number.isFinite(readyAt) || readyAt <= 0 || !Number.isFinite(result) || result < 0) {
          throw new Error('Invalid on-chain process state');
        }
        setSignalState({ active: true, readyAt, signalReady: result });
        setTimeLeft(Math.max(0, Math.floor((readyAt - Date.now()) / 1000)));
      }
      setReadStatus('ready');
    } catch {
      if (request !== requestSeq.current) return;
      // Только сбой сети или битый счёт. Пустой PDA сюда больше не попадает.
      setSignalState(null);
      setReadStatus('unavailable');
    } finally {
      if (request === requestSeq.current) inFlight.current = null;
    }
  }, [walletAddr]);

  useEffect(() => {
    setSignalState(null);
    setReadStatus('loading');
    if (walletAddr) loadState();
    const interval = walletAddr ? setInterval(loadState, 5000) : null;
    return () => { requestSeq.current += 1; inFlight.current = null; if (interval) clearInterval(interval); };
  }, [walletAddr, loadState]);

  useEffect(() => {
    if (!signalState?.active || !signalState.readyAt) return;
    const interval = setInterval(() => {
      setTimeLeft(Math.max(0, Math.floor((signalState.readyAt - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [signalState]);

  useEffect(() => {
    if (!walletAddr || readStatus !== 'ready' || signalState) {
      setShortage(null);
      return;
    }
    let alive = true;
    const m = SIGNAL_SIZES[size];
    Promise.all([
      api.query.balances(walletAddr).catch(() => null),
      api.energy.balance(walletAddr).catch(() => null),
    ]).then(([raw, energy]) => {
      if (!alive) return;
      const balances = readEconomyBalances(raw);
      const current = energy && typeof energy.amount === 'number' ? energy.amount : null;
      const missing = shortagesFromBalances(
        balances,
        [{ resource: 'SYNAPSE', need: m.synapse }, { resource: 'SILICON', need: m.silicon }],
        current === null ? null : { current, need: 2 },
      );
      setShortage(missing && missing.length > 0 ? formatResourceShortage(language, missing) : null);
    });
    return () => { alive = false; };
  }, [walletAddr, readStatus, signalState, size, language]);

  async function startSignalProcessing() {
    if (!walletAddr) return;
    const m = SIGNAL_SIZES[size];
    setMilling(true);
    try {
      const balances = readEconomyBalances(await api.query.balances(walletAddr).catch(() => null));
      const energy = await api.energy.balance(walletAddr).catch(() => null);
      const current = energy && typeof energy.amount === 'number' ? energy.amount : null;
      const missing = shortagesFromBalances(
        balances,
        [{ resource: 'SYNAPSE', need: m.synapse }, { resource: 'SILICON', need: m.silicon }],
        current === null ? null : { current, need: 2 },
      );
      if (missing && missing.length > 0) {
        const text = formatResourceShortage(language, missing);
        setShortage(text);
        toast.show(text, "error", language);
        return;
      }
      const [synapseMint, siliconMint] = await Promise.all([
        getMintAsync("SYNAPSE"),
        getMintAsync("SILICON"),
      ]);
      if (!synapseMint || !siliconMint) {
        toast.show(copy.missingMints, "error", language);
        return;
      }
      const resp = await api.chain.startSignalProcessing({
        user: walletAddr,
        batchSize: m.batchSize,
        synapseMint,
        siliconMint,
      });
      const r = await handleTxResponse(resp);
      if (r.success) {
        toast.show(copy.mill.started(m.synapse, m.signal), "success", language);
        await loadState();
      } else {
        toast.show(`${r.error || copy.failed}`, "error", language);
      }
    } catch (e: any) {
      toast.show(actionErrorFeedback(e, language, walletRuntimeCopy[language].unconfirmedResponse), "error", language);
    } finally {
      setMilling(false);
    }
  }

  async function collectSignal() {
    if (!walletAddr || !signalState) return;
    setMilling(true);
    try {
      const signalMint = await getMintAsync("SIGNAL");
      if (!signalMint) { toast.show(copy.missingResultMint, "error", language); return; }
      const resp = await api.chain.collectSignal({
        user: walletAddr,
        signalMint,
      });
      const r = await handleTxResponse(resp);
      if (r.success) {
        toast.show(`🥣 ${copy.mill.collected(signalState.signalReady)}`, "success", language);
        await loadState();
      } else {
        toast.show(`${r.error || copy.failed}`, "error", language);
      }
    } catch (e: any) {
      toast.show(actionErrorFeedback(e, language, walletRuntimeCopy[language].unconfirmedResponse), "error", language);
    } finally {
      setMilling(false);
    }
  }

  const m = SIGNAL_SIZES[size];
  const isReady = readStatus === 'ready' && timeLeft === 0 && signalState?.active;

  const formatTime = (sec: number) => {
    const mm = Math.floor(sec / 60);
    const ss = sec % 60;
    const hh = Math.floor(mm / 60);
    return hh > 0 ? `${hh}:${(mm % 60).toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}` : `${mm}:${ss.toString().padStart(2, "0")}`;
  };

  if (!walletAddr) {
    return <div lang={language}><Card className="p-4">
      <h3 className="text-parchment font-bold text-lg flex items-center gap-2"><ResourceGlyph icon={UI_ICONS.mill} alt="" className="w-5 h-5" /> {copy.mill.title}</h3>
      <p className="text-straw text-sm text-center py-4">{copy.connectWallet}</p>
    </Card></div>;
  }

  return (
    <div lang={language}><Card className="p-4 space-y-3">
      <h3 className="text-parchment font-bold text-lg flex items-center gap-2"><ResourceGlyph icon={UI_ICONS.mill} alt="" className="w-5 h-5" /> {copy.mill.title}</h3>
      {readStatus === 'loading' && <p role="status" className="text-straw text-sm text-center py-4">{copy.loading}</p>}
      {readStatus === 'unavailable' && <p role="alert" className="text-straw text-sm text-center py-4">{copy.unavailable}</p>}
      {readStatus === 'ready' && !signalState && (
        <>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(SIGNAL_SIZES) as Array<keyof typeof SIGNAL_SIZES>).map((key) => (
              <button type="button" key={key} aria-pressed={size === key} onClick={() => setSize(key)}
                className={`min-w-0 p-2 rounded-lg text-center transition [overflow-wrap:anywhere] ${size === key
                  ? "bg-gold-600/30 border-2 border-gold-500" : "bg-soil-700/50 border border-straw/20 hover:border-gold-500"}`}>
                <ResourceGlyph icon={SIGNAL_SIZES[key].icon} alt="" className={SIGNAL_SIZES[key].sizeCls} />
                <div className="text-[10px] text-parchment font-bold">{copy.sizes[key]}</div>
              </button>
            ))}
          </div>
          <div className="bg-soil-800/50 rounded-lg p-3 space-y-1 text-xs">
            <div className="flex flex-wrap justify-between gap-1"><span className="text-straw">{resources.synapse}:</span><span className="text-parchment inline-flex items-center gap-1">{m.synapse} <ResourceGlyph icon={resourceIcon("SYNAPSE") || ""} alt="" className="w-3.5 h-3.5" /></span></div>
            <div className="flex flex-wrap justify-between gap-1"><span className="text-straw">{resources.silicon}:</span><span className="text-parchment inline-flex items-center gap-1">{m.silicon} <ResourceGlyph icon={resourceIcon("SILICON") || ""} alt="" className="w-3.5 h-3.5" /></span></div>
            <div className="flex flex-wrap justify-between gap-1"><span className="text-straw">{copy.output}:</span><span className="text-accent-500 font-bold inline-flex items-center gap-1">{m.signal} <ResourceGlyph icon={resourceIcon("SIGNAL") || ""} alt="" className="w-3.5 h-3.5" /></span></div>
            <div className="flex flex-wrap justify-between gap-1"><span className="text-straw">{copy.energy}:</span><span className="text-parchment">2</span></div>
            <div className="flex flex-wrap justify-between gap-1"><span className="text-straw">{copy.duration}:</span><span className="text-parchment">{copy.hours(m.time / 3600)}</span></div>
          </div>
          {shortage && <p role="alert" className="text-gold-400 text-xs [overflow-wrap:anywhere]">{shortage}</p>}
          <button type="button" onClick={startSignalProcessing} disabled={milling}
            className="w-full py-2 rounded-lg bg-gold-600 text-parchment font-bold text-sm disabled:opacity-50 [overflow-wrap:anywhere]">
            {milling ? copy.mill.starting : copy.mill.start}
          </button>
        </>
      )}
      {readStatus === 'ready' && signalState && (
        <div className="bg-soil-800/50 rounded-lg p-4 space-y-3">
          <div className="text-center">
            <ResourceGlyph icon={UI_ICONS.mill} alt="" className="w-10 h-10 mx-auto animate-spin" />
            {timeLeft > 0 ? <>
              <p className="text-parchment font-bold">{copy.mill.running}</p>
              <p className="text-accent-500 text-2xl font-bold">{formatTime(timeLeft)}</p>
            </> : <>
              <p className="text-parchment font-bold">{copy.mill.ready}</p>
              <p className="text-accent-500 text-2xl font-bold">{signalState.signalReady} <ResourceGlyph icon={resourceIcon("SIGNAL")} alt="" className="inline-block w-5 h-5 align-text-bottom" /></p>
            </>}
          </div>
          {isReady && <button type="button" onClick={collectSignal} disabled={milling} className="btn btn-primary">
            {milling ? copy.mill.starting : copy.mill.collect}
          </button>}
        </div>
      )}
    </Card></div>
  );
}
