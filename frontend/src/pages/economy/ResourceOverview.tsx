import { useLocale } from "../../i18n/LocaleProvider";
import { economyDetailCopy } from "../../i18n/economyDetailCopy";
import { economyResourceName } from "../../lib/economyBalances";
import { useEconomyBalances } from "./useEconomyBalances";
import { useWalletStore } from "../../store/walletStore";
import { resourceIcon, UI_ICONS } from "../../lib/visualAssets";
import { ResourceGlyph } from "../../components/visual/ResourceGlyph";
import { Panel, Readout, Readouts, Sticker, Note } from "../../ui/forge/kit";
import { GelLanes, type GelLane, type GelBand } from "../../ui/forge/devices";

// One tile per resource; colors and the category grouping are presentation,
// never a fallback for an unavailable balance. Resource names come from the
// same canonical IDs used in the lab, collection and pantry.
type CategoryKey = keyof (typeof economyDetailCopy)['ru']['categories'];
type OverviewCategory = { key: CategoryKey; icon: string; items: readonly { key: string; accent: string }[] };
const CATEGORIES: readonly OverviewCategory[] = [
  { key: "lab", icon: UI_ICONS.labOverview, items: [
    { key: "DATA", accent: "#5FC9DA" }, { key: "CIRCUIT", accent: "#5FD3A8" },
    { key: "SILICON", accent: "#A99BEC" }, { key: "NEURON", accent: "#8FB3DE" },
    { key: "SYNAPSE", accent: "#5FC9DA" }, { key: "SIGNAL", accent: "#8FE3F0" },
    { key: "MODEL", accent: "#E0708A" }, { key: "POWER", accent: "#A99BEC" },
  ] },
  { key: "consumables", icon: UI_ICONS.transformations, items: [
    { key: "COMPUTE", accent: "#E0708A" }, { key: "DATASET", accent: "#E2685F" }, { key: "MIND", accent: "#C9A227" },
  ] },
  { key: "cores", icon: UI_ICONS.gems, items: [
    { key: "BLUE_CORE", accent: "#8FB3DE" }, { key: "PURPLE_CORE", accent: "#A99BEC" }, { key: "RED_CORE", accent: "#E2685F" },
    { key: "SOUL_CORE", accent: "#E6C15A" },
  ] },
  { key: "quartz", icon: UI_ICONS.locCoolLake, items: [
    { key: "CLEAR_QUARTZ", accent: "#E6EBF0" }, { key: "ROSE_QUARTZ", accent: "#E0708A" }, { key: "AMBER_QUARTZ", accent: "#E0708A" },
  ] },
  { key: "chips", icon: UI_ICONS.transformations, items: [
    { key: "QUANTUM_BIT", accent: "#8FB3DE" }, { key: "NEURAL_CHIP", accent: "#5FC9DA" },
    { key: "PHOTON_BIT", accent: "#E6EBF0" }, { key: "BIO_CHIP", accent: "#5FD3A8" },
  ] },
  { key: "fluids", icon: UI_ICONS.flasks, items: [
    { key: "CRYO_FLUID", accent: "#8FB3DE" }, { key: "VOLT_FLUID", accent: "#E0708A" },
    { key: "BIO_FLUID", accent: "#5FD3A8" }, { key: "NANO_FLUID", accent: "#E0708A" }, { key: "QUANTUM_FLUID", accent: "#A99BEC" },
  ] },
];

/** Bands use relative, logarithmic heights, but only for verified positive
 * balances. No band is ever drawn for an unreadable or zero-valued resource. */
function gelLanes(categories: typeof CATEGORIES, balances: Record<string, number>, language: keyof typeof economyDetailCopy): GelLane[] {
  const all = categories.flatMap(c => c.items);
  const top = Math.max(1, ...all.map(i => balances[i.key]));
  const logTop = Math.log1p(top);
  return categories.map(cat => {
    const filled = cat.items.filter(i => balances[i.key] > 0);
    const bands: GelBand[] = filled.map(i => {
      const amount = balances[i.key];
      const ratio = logTop > 1 ? Math.log1p(amount) / logTop : 1;
      return {
        at: 0.06 + 0.82 * (1 - Math.min(1, Math.max(0, ratio))),
        kind: amount < top * 0.05 ? "weak" : "fresh",
      };
    });
    return {
      key: cat.key,
      name: economyDetailCopy[language].lanes[cat.key],
      title: economyDetailCopy[language].categories[cat.key],
      bands,
    };
  }).filter(lane => lane.bands.length > 0);
}

export function ResourceOverview() {
  const { language } = useLocale();
  const copy = economyDetailCopy[language];
  const { address } = useWalletStore();
  const { balances, state } = useEconomyBalances(address);
  if (!balances) {
    return (
      <div lang={language} className="economy-empty" role="status">
        <p className={state === 'error' ? "text-gold-400" : "text-straw"}>
          {state === 'disconnected' ? copy.connect : state === 'loading' ? copy.loading : copy.unavailable}
        </p>
      </div>
    );
  }

  const lanes = gelLanes(CATEGORIES, balances, language);
  const allItems = CATEGORIES.flatMap(c => c.items);
  const withStock = allItems.filter(i => balances[i.key] > 0);
  const fullest = withStock.reduce<{ key: string; amount: number } | null>((acc, i) => {
    const amount = balances[i.key];
    return !acc || amount > acc.amount ? { key: i.key, amount } : acc;
  }, null);
  const format = (amount: number) => amount.toLocaleString(language, { maximumFractionDigits: 9 });

  return (
    <div lang={language} className="economy-overview min-w-0">
      <Panel tier="panel" device="gel" id={<Sticker>{copy.rack}</Sticker>}
        meta={copy.analysis} title={copy.gelTitle} sub={copy.gelSub} className="mb-2">
        {lanes.length > 0 ? <GelLanes lanes={lanes} /> : <Note quiet>{copy.noBands}</Note>}
        <div style={{ marginTop: 16 }}>
          <Readouts>
            <Readout label={copy.positions} value={String(withStock.length)} hint={copy.totalPositions.replace('{count}', String(allItems.length))} />
            <Readout label={copy.fullest} value={fullest ? format(fullest.amount) : undefined} dash={!fullest}
              hint={fullest ? economyResourceName(language, fullest.key) : copy.noStock} />
          </Readouts>
        </div>
      </Panel>

      {CATEGORIES.map(cat => (
        <div key={cat.key} className="resource-category">
          <h3 className="category-title">
            <span className="category-icon"><ResourceGlyph icon={cat.icon} alt="" className="w-5 h-5" /></span>
            {copy.categories[cat.key]}
            {cat.key === 'lab' && <span className="category-hint">{copy.labHint}</span>}
          </h3>
          <div className="resource-grid">
            {cat.items.map(item => {
              const amount = balances[item.key]; // complete on-chain response, validated by useEconomyBalances
              const name = economyResourceName(language, item.key);
              return (
                <div key={item.key} className="resource-card" style={{ borderColor: item.accent + "66" }}>
                  <div className="resource-icon" style={{ background: item.accent + "26" }}>
                    <ResourceGlyph icon={resourceIcon(item.key) || ""} alt="" className="w-8 h-8" />
                  </div>
                  <div className="resource-info">
                    <div className="resource-label">{name}</div>
                    <div className="resource-amount" style={{ color: item.accent }}>{format(amount)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
