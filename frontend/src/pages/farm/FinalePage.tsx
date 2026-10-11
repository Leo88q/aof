import { useEffect, useRef, useState } from "react";
import { useLocale } from "../../i18n/LocaleProvider";
import { finaleCopy } from "../../i18n/finaleCopy";
import { economyResourceName } from "../../lib/economyBalances";
import { formatResourceShortage, shortagesFromBalances } from "../../lib/resourceShortageMessage";
import { getMintAsync } from "../../lib/mints";
import { api } from "../../lib/api";
import { handleTxResponse } from "../../lib/txFlow";
import { actionErrorFeedback } from "../../lib/txResponseFeedback";
import { walletRuntimeCopy } from "../../i18n/walletRuntimeCopy";
import { useWalletStore } from "../../store/walletStore";
import { useNav } from "../../nav/NavContext";
import { NavHeader } from "../../components/NavHeader";
import { Workshop } from "../economy/Workshop";
import { useEconomyBalances } from "../economy/useEconomyBalances";
import { NoticeMsg } from "../../components/visual/NoticeMsg";
import { ChainClocks } from "../../components/ChainClocks";
import { chainMomentCopy } from "../../i18n/chainMomentCopy";
import { FLASK_ENERGY_GAIN } from "../../lib/chainMoments";

const FINALE_NEED = [
  { key: "MODEL", amount: 1 },
  { key: "CRYO_FLUID", amount: 1 },
  { key: "VOLT_FLUID", amount: 1 },
  { key: "BIO_FLUID", amount: 1 },
  { key: "NANO_FLUID", amount: 1 },
  { key: "QUANTUM_FLUID", amount: 1 },
  { key: "AMBER_QUARTZ", amount: 1 },
] as const;

export function FinalePage() {
  const { language } = useLocale();
  const copy = finaleCopy[language];
  const { address } = useWalletStore();
  const { push } = useNav();
  const [refreshKey, setRefreshKey] = useState(0);
  const { balances, state } = useEconomyBalances(address, refreshKey);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [seals, setSeals] = useState<{ status: "loading" | "unread" | "ready"; count: number | null }>({ status: "loading", count: null });
  const running = useRef(false);

  useEffect(() => {
    if (!address) {
      setSeals({ status: "unread", count: null });
      return;
    }
    let cancelled = false;
    setSeals({ status: "loading", count: null });
    api.query.laboratoryFinale(address).then((read) => {
      if (cancelled) return;
      const count = read?.seals;
      if (typeof count === "number" && Number.isInteger(count) && count >= 0) setSeals({ status: "ready", count });
      else setSeals({ status: "unread", count: null });
    }).catch(() => {
      if (!cancelled) setSeals({ status: "unread", count: null });
    });
    return () => { cancelled = true; };
  }, [address, refreshKey]);

  const [clocks, setClocks] = useState({ energy: "", signal: "", model: "", soul: "" });
  useEffect(() => {
    let cancelled = false;
    const moment = chainMomentCopy[language];
    const when = (value: unknown) => {
      const seconds = Number(value);
      if (!Number.isFinite(seconds) || seconds <= 0) return null;
      return new Date(seconds * 1000).toLocaleString(language);
    };
    setClocks({ energy: moment.energyMissing, signal: moment.clocksUnread, model: moment.clocksUnread, soul: moment.soulUnread });
    const energy = address
      ? api.energy.balance(address).then((read: any) => {
          const amount = Number(read?.amount);
          const cap = Number(read?.cap);
          return Number.isFinite(amount) && Number.isFinite(cap) ? moment.energyLine(amount, cap) : moment.energyMissing;
        }).catch(() => moment.energyMissing)
      : Promise.resolve(moment.energyMissing);
    const signal = address
      ? api.query.signalState(address).then((read: any) => {
          if (!read || read.inProgress === false && read.readyAt == null && read.ready_at == null) return moment.signalIdle;
          const ready = when(read.readyAt ?? read.ready_at);
          return ready ? moment.signalReady(ready) : moment.clocksUnread;
        }).catch(() => moment.clocksUnread)
      : Promise.resolve(moment.clocksUnread);
    const model = address
      ? api.query.modelState(address).then((read: any) => {
          if (!read || read.inProgress === false && read.readyAt == null && read.ready_at == null) return moment.modelIdle;
          const ready = when(read.readyAt ?? read.ready_at);
          return ready ? moment.modelReady(ready) : moment.clocksUnread;
        }).catch(() => moment.clocksUnread)
      : Promise.resolve(moment.clocksUnread);
    const soul = api.query.soulCoreSupply().then((read: any) => {
      const cores = Number(read?.cores);
      return Number.isInteger(cores) && cores >= 0 ? moment.soulSupply(cores) : moment.soulUnread;
    }).catch(() => moment.soulUnread);
    Promise.all([energy, signal, model, soul]).then(([energyText, signalText, modelText, soulText]) => {
      if (!cancelled) setClocks({ energy: energyText, signal: signalText, model: modelText, soul: soulText });
    });
    return () => { cancelled = true; };
  }, [address, language, refreshKey]);

  async function seal() {
    if (running.current) return;
    if (!address) return setMessage(copy.connect);
    if (!balances) return setMessage(copy.unavailable);
    const missing = shortagesFromBalances(balances, FINALE_NEED.map(item => ({ resource: item.key, need: item.amount })));
    if (missing && missing.length > 0) return setMessage(formatResourceShortage(language, missing));
    running.current = true;
    setBusy(true);
    try {
      const [modelMint, cryoMint, voltMint, bioMint, nanoMint, quantumMint, amberMint, soulMint] = await Promise.all([
        getMintAsync("MODEL"), getMintAsync("CRYO_FLUID"), getMintAsync("VOLT_FLUID"), getMintAsync("BIO_FLUID"),
        getMintAsync("NANO_FLUID"), getMintAsync("QUANTUM_FLUID"), getMintAsync("AMBER_QUARTZ"), getMintAsync("SOUL_CORE"),
      ]);
      if (![modelMint, cryoMint, voltMint, bioMint, nanoMint, quantumMint, amberMint, soulMint].every(Boolean)) {
        setMessage(copy.missingRegistry);
        return;
      }
      if (useWalletStore.getState().address !== address) return;
      setMessage(copy.sealing);
      const response = await api.chain.sealLaboratory({
        user: address, modelMint, cryoMint, voltMint, bioMint, nanoMint, quantumMint, amberMint, soulMint,
      });
      if (!response?.tx) { setMessage(copy.unavailable); return; }
      const result = await handleTxResponse(response);
      if (result.success && result.signature) {
        setMessage(`${copy.sealed}: ${result.signature.slice(0, 10)}…`);
        setRefreshKey(n => n + 1);
      } else setMessage(result.error || walletRuntimeCopy[language].unconfirmedResponse);
    } catch (error) {
      const code = (error as { code?: unknown } | null)?.code;
      setMessage(code === "SEAL_NOT_ON_THIS_PROGRAM" ? copy.programOld : actionErrorFeedback(error, language, walletRuntimeCopy[language].unconfirmedResponse));
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  const moment = chainMomentCopy[language];
  const lines = FINALE_NEED.map(item => {
    const have = balances ? balances[item.key] : null;
    const name = economyResourceName(language, item.key);
    const fluidIndex = ["CRYO_FLUID", "VOLT_FLUID", "BIO_FLUID", "NANO_FLUID", "QUANTUM_FLUID"].indexOf(item.key);
    const drink = fluidIndex >= 0 ? ` · ${moment.flaskLeavesSeal(FLASK_ENERGY_GAIN[fluidIndex])}` : "";
    return `${name}: ${have === null || have === undefined ? "—" : have} / ${item.amount}${drink}`;
  });

  return (
    <div lang={language} className="p-4 pt-2 pb-24 space-y-4 min-w-0">
      <p className="text-straw text-xs">{copy.intro}</p>
      <p className="text-parchment text-xs">{copy.goal}</p>
      <ChainClocks />
      <p className="text-straw text-xs break-words">{moment.drinkOrSeal}</p>
      <p className="text-parchment text-xs break-words">{clocks.energy}</p>
      <p className="text-parchment text-xs break-words">{clocks.signal}</p>
      <p className="text-parchment text-xs break-words">{clocks.model}</p>
      <p className="text-parchment text-xs break-words">{clocks.soul}</p>
      {address && seals.status !== "loading" && <p className="text-parchment text-xs">{seals.status === "unread" || seals.count === null ? copy.sealsUnread : seals.count === 0 ? copy.sealsNone : copy.sealsHeld(seals.count)}</p>}
      <p className="text-straw text-xs">{copy.chain}</p>
      <div className="text-xs text-parchment space-y-1">
        <p>{copy.need}</p>
        {lines.map(line => <p key={line}>{line}</p>)}
        {state === "loading" && <p>{copy.unavailable}</p>}
      </div>
      {message && <NoticeMsg text={message} />}
      <button type="button" className="btn btn-primary" disabled={!address || busy} onClick={seal}>{copy.seal}</button>
      <button type="button" className="btn" onClick={() => push("economy", "workshop", (<><NavHeader headerId="finale" tabKey="economy" /><Workshop /></>))}>{copy.workshop}</button>
    </div>
  );
}
