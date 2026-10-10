import { useRef, useState } from "react";
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
  const running = useRef(false);

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

  const lines = FINALE_NEED.map(item => {
    const have = balances ? balances[item.key] : null;
    const name = economyResourceName(language, item.key);
    return `${name}: ${have === null || have === undefined ? "—" : have} / ${item.amount}`;
  });

  return (
    <div lang={language} className="p-4 pt-2 pb-24 space-y-4 min-w-0">
      <p className="text-straw text-xs">{copy.intro}</p>
      <p className="text-parchment text-xs">{copy.goal}</p>
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
