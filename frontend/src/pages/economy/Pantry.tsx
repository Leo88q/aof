import { useState } from "react";
import { useLocale } from "../../i18n/LocaleProvider";
import { economyDetailCopy } from "../../i18n/economyDetailCopy";
import { economyResourceName } from "../../lib/economyBalances";
import { useEconomyBalances } from "./useEconomyBalances";
import { useWalletStore } from "../../store/walletStore";
import { resourceIcon, UI_ICONS } from "../../lib/visualAssets";
import { ResourceGlyph } from "../../components/visual/ResourceGlyph";

const FILTERS = [
  { key: "raw", icon: UI_ICONS.gems, items: [
    "BLUE_CORE", "PURPLE_CORE", "RED_CORE", "CLEAR_QUARTZ", "ROSE_QUARTZ", "AMBER_QUARTZ", "COMPUTE", "DATASET", "MIND",
  ] },
  { key: "materials", icon: UI_ICONS.transformations, items: [
    "QUANTUM_BIT", "NEURAL_CHIP", "PHOTON_BIT", "BIO_CHIP", "SYNAPSE", "SIGNAL",
  ] },
  { key: "flasks", icon: UI_ICONS.flasks, items: [
    "CRYO_FLUID", "VOLT_FLUID", "BIO_FLUID", "NANO_FLUID", "QUANTUM_FLUID",
  ] },
  { key: "special", icon: UI_ICONS.gems, items: ["SOUL_CORE"] },
] as const;

export function Pantry() {
  const { language } = useLocale();
  const copy = economyDetailCopy[language];
  const { address } = useWalletStore();
  const { balances, state } = useEconomyBalances(address);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>("raw");
  const activeFilter = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];

  if (!balances) {
    return (
      <div lang={language} role="status" className="economy-empty">
        <p className={state === 'error' ? "text-gold-400" : "text-straw"}>
          {state === 'disconnected' ? copy.connect : state === 'loading' ? copy.loading : copy.unavailable}
        </p>
      </div>
    );
  }

  return (
    <div lang={language} className="pantry min-w-0">
      <div className="pantry-filters">
        {FILTERS.map((f) => (
          <button key={f.key} type="button" aria-pressed={filter === f.key}
            className={"pantry-filter" + (filter === f.key ? " active" : "")}
            onClick={() => setFilter(f.key)}>
            <ResourceGlyph icon={f.icon} alt="" className="w-5 h-5 shrink-0" />
            <span>{copy.pantry[f.key]}</span>
          </button>
        ))}
      </div>
      {filter === 'flasks' && <p className="text-straw text-xs leading-relaxed">{copy.vialNotice}</p>}
      <div className="pantry-grid">
        {activeFilter.items.map((key) => {
          const amount = balances[key]; // all keys verified by readEconomyBalances
          const name = economyResourceName(language, key);
          return (
            <div key={key} className={"pantry-item" + (amount > 0 ? " has" : " empty")}>
              <div className="pantry-item-icon"><ResourceGlyph icon={resourceIcon(key) || ""} alt="" className="w-8 h-8" /></div>
              <div className="pantry-item-info"><div className="pantry-item-label">{name}</div></div>
              <div className="pantry-item-amount">{amount.toLocaleString(language, { maximumFractionDigits: 9 })}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
