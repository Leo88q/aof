import { useCallback, useEffect, useState } from "react";
import { useToast } from "../../components/ui/Toast";
import { useLocale } from "../../i18n/LocaleProvider";
import { marketDetailCopy } from "../../i18n/marketDetailCopy";
import { homeResourceNames } from "../../i18n/homeDetail";
import { walletRuntimeCopy } from "../../i18n/walletRuntimeCopy";
import { Card } from "../../components/ui/Card";
import { api } from "../../lib/api";
import { handleTxResponse } from "../../lib/txFlow";
import { actionErrorFeedback } from "../../lib/txResponseFeedback";
import { useWalletStr } from "../../lib/useWalletStr";
import { readEconomyBalances } from "../../lib/economyBalances";
import { formatResourceShortage, shortagesFromBalances } from "../../lib/resourceShortageMessage";
import { resourceIcon, UI_ICONS } from "../../lib/visualAssets";
import { ResourceGlyph } from "../../components/visual/ResourceGlyph";
import { chainMomentCopy } from "../../i18n/chainMomentCopy";
import { FLASK_ENERGY_GAIN as SEAL_FLASK_GAIN } from "../../lib/chainMoments";

/**
 * Фляги и энергия.
 *
 * Каталог — только крафтовые позиции. Дефект 2026-09-28: каталог обещал
 * эффекты («+20% добыча на 1ч», «+100 газа», «×2 скорость»), которых нет ни в
 * одной инструкции aof-core. Теперь у фляг есть единственный объявленный
 * эффект — энергия по тиру (`aof_core::use_flask`), и он же здесь показан.
 *
 * [§3.8] Страница даёт игроку обе новые механики:
 *   * применение фляги (`/tools/use-flask`) — сжигает 1 флягу, начисляет
 *     энергию по тиру, не выше потолка бака;
 *   * обмен DATA → энергия (`/resources/exchange-energy`) — 1 целый DATA за
 *     1 энергию, только в свободное место бака.
 * Баланс энергии читается из сети (`/energy/balance`); неизвестное состояние
 * показывается как неизвестное, а не как ноль.
 */
const FLASKS = [
  { key: "CRYO_FLUID", resourceId: "cryoFluid" },
  { key: "VOLT_FLUID", resourceId: "voltFluid" },
  { key: "BIO_FLUID", resourceId: "bioFluid" },
  { key: "NANO_FLUID", resourceId: "nanoFluid" },
  { key: "QUANTUM_FLUID", resourceId: "quantumFluid" },
] as const;

/** Тир-лестница обязана совпадать с aof-core/constants.rs FLASK_ENERGY_GAIN. */
const FLASK_ENERGY_GAIN = SEAL_FLASK_GAIN;

export function FlaskMarketplace() {
  const { language } = useLocale();
  const copy = marketDetailCopy[language];
  const toast = useToast();
  const walletAddr = useWalletStr();
  const [energy, setEnergy] = useState<{ amount: number; cap: number } | null>(null);
  const [dataAmount, setDataAmount] = useState(1);
  const [exchanging, setExchanging] = useState(false);
  const [usingFlask, setUsingFlask] = useState<number | null>(null);

  const refreshEnergy = useCallback(async (addr: string) => {
    try {
      const data: any = await api.energy.balance(addr);
      const amount = Number(data?.amount);
      const cap = Number(data?.cap);
      setEnergy(Number.isFinite(amount) && Number.isFinite(cap) ? { amount, cap } : null);
    } catch {
      // An RPC or account-read failure is not an empty tank. Keep it unknown.
      setEnergy(null);
    }
  }, []);

  useEffect(() => {
    if (!walletAddr) {
      setEnergy(null);
      return;
    }
    refreshEnergy(walletAddr);
    const interval = setInterval(() => refreshEnergy(walletAddr), 30000);
    return () => clearInterval(interval);
  }, [walletAddr, refreshEnergy]);

  async function handleExchange() {
    if (!walletAddr) {
      toast.show(walletRuntimeCopy[language].connectWallet, "error", language);
      return;
    }
    const whole = Number(dataAmount);
    if (!Number.isInteger(whole) || whole < 1) {
      toast.show(copy.exchangeFailed, "error", language);
      return;
    }
    setExchanging(true);
    try {
      const [raw, energyNow] = await Promise.all([
        api.query.balances(walletAddr).catch(() => null),
        api.energy.balance(walletAddr).catch(() => null),
      ]);
      const current = energyNow && typeof energyNow.amount === "number" ? energyNow.amount : null;
      const cap = energyNow && typeof energyNow.cap === "number" ? energyNow.cap : null;
      if (current !== null && cap !== null && current + whole > cap) {
        toast.show(copy.tankFull, "error", language);
        return;
      }
      const missing = shortagesFromBalances(readEconomyBalances(raw), [{ resource: "DATA", need: whole }]);
      if (missing && missing.length > 0) {
        toast.show(formatResourceShortage(language, missing), "error", language);
        return;
      }
      const resp = await api.resources.exchangeEnergy({ user: walletAddr, dataAmount: whole });
      const r = await handleTxResponse(resp);
      if (r.success) {
        toast.show(copy.exchangeSuccess(whole), "success", language);
        setTimeout(() => refreshEnergy(walletAddr), 2000);
      } else {
        toast.show(`${r.error || copy.exchangeFailed}`, "error", language);
      }
    } catch (e: any) {
      toast.show(actionErrorFeedback(e, language, copy.exchangeFailed), "error", language);
    } finally {
      setExchanging(false);
    }
  }

  async function handleUseFlask(flaskType: number, gain: number, flaskKey: string) {
    if (!walletAddr) {
      toast.show(walletRuntimeCopy[language].connectWallet, "error", language);
      return;
    }
    setUsingFlask(flaskType);
    try {
      const [raw, energyNow] = await Promise.all([
        api.query.balances(walletAddr).catch(() => null),
        api.energy.balance(walletAddr).catch(() => null),
      ]);
      const current = energyNow && typeof energyNow.amount === "number" ? energyNow.amount : null;
      const cap = energyNow && typeof energyNow.cap === "number" ? energyNow.cap : null;
      if (current !== null && cap !== null && current + gain > cap) {
        toast.show(copy.tankFull, "error", language);
        return;
      }
      const missing = shortagesFromBalances(readEconomyBalances(raw), [{ resource: flaskKey, need: 1 }]);
      if (missing && missing.length > 0) {
        toast.show(formatResourceShortage(language, missing), "error", language);
        return;
      }
      const resp = await api.tools.useFlask({ user: walletAddr, flaskType });
      const r = await handleTxResponse(resp);
      if (r.success) {
        toast.show(copy.useSuccess(gain), "success", language);
        setTimeout(() => refreshEnergy(walletAddr), 2000);
      } else {
        toast.show(`${r.error || copy.useFailed}`, "error", language);
      }
    } catch (e: any) {
      toast.show(actionErrorFeedback(e, language, copy.useFailed), "error", language);
    } finally {
      setUsingFlask(null);
    }
  }

  return (
    <div lang={language} className="space-y-3 min-w-0">
      <Card className="p-4">
        <h3 className="text-parchment font-bold text-lg mb-2 flex items-center gap-2">
          <ResourceGlyph icon={UI_ICONS.flasks} alt="" className="w-5 h-5" /> {copy.flaskTitle}
        </h3>
        <p className="text-straw text-sm leading-relaxed">
          {copy.flaskExplanation}
        </p>
        <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-soil-800/60 border border-straw/10 px-3 py-2">
          <span className="text-straw text-xs inline-flex items-center gap-1">
            <ResourceGlyph icon={resourceIcon("power") || ""} alt="" className="w-3.5 h-3.5" /> {copy.energyTitle}
          </span>
          <span className="text-parchment text-sm font-bold">
            {energy ? `${energy.amount}/${energy.cap}` : copy.energyUnavailable}
          </span>
        </div>
      </Card>

      <Card className="p-4 space-y-2">
        <h3 className="text-parchment font-bold text-sm">{copy.exchangeTitle}</h3>
        <p className="text-straw text-xs leading-relaxed">{copy.exchangeHint}</p>
        <div className="flex items-center gap-2">
          <label className="text-straw text-xs flex-1" htmlFor="exchange-data-amount">{copy.exchangeAmount}</label>
          <input
            id="exchange-data-amount"
            aria-label={copy.exchangeAmount}
            type="number"
            min="1"
            step="1"
            value={dataAmount}
            onChange={(e) => setDataAmount(Number(e.target.value))}
            className="w-20 bg-soil-900/60 border border-straw/20 rounded px-2 py-1 text-parchment text-sm"
          />
        </div>
        <button
          onClick={handleExchange}
          disabled={exchanging}
          className="btn btn-primary w-full"
        >
          {exchanging ? copy.exchangePending : copy.exchangeSubmit}
        </button>
      </Card>

      <Card className="p-4">
        <h3 className="text-parchment font-bold text-sm mb-3">{copy.flaskCatalog}</h3>
        <p className="text-straw text-xs break-words mb-3">{chainMomentCopy[language].drinkOrSeal}</p>
        <div className="space-y-2">
          {FLASKS.map((flask, index) => {
            const gain = FLASK_ENERGY_GAIN[index];
            const flaskType = index + 1;
            return (
              <div key={flask.key} className="flex items-center gap-3 p-3 rounded-lg bg-soil-800/60 border border-straw/10">
                <ResourceGlyph icon={resourceIcon(flask.key) || ""} alt="" className="w-6 h-6" />
                <div className="flex-1 min-w-0">
                  <div className="text-parchment text-sm font-bold">{homeResourceNames[language][flask.resourceId]}</div>
                  <div className="text-straw text-xs">{copy.flaskRecipe}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-straw text-xs max-w-[45%] break-words text-right">{copy.flaskNoPrice}</span>
                  <span className="text-sprout-500 text-xs font-bold">{chainMomentCopy[language].flaskLeavesSeal(gain)}</span>
                  <button
                    onClick={() => handleUseFlask(flaskType, gain, flask.key)}
                    disabled={usingFlask !== null}
                    className="btn btn-sm"
                  >
                    {usingFlask === flaskType ? copy.usePending : copy.useSubmit}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
