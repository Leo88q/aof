import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../../lib/api";
import { toolPlate } from "../../lib/visualAssets";
import { Card } from "../../components/ui/Card";
import { useWalletStr } from "../../lib/useWalletStr";
import { useLocale } from "../../i18n/LocaleProvider";
import { compendiumCopy } from "../../i18n/compendiumCopy";
import { toolName, toolsCopy } from "../../i18n/toolsCopy";
import { COMPENDIUM_RARITIES, COMPENDIUM_TOOL_IDS, readCompendiumGrid } from "../../lib/compendiumReadings";

type Read = { owner: string; state: 'loading' | 'ready' | 'error'; entries?: Set<string> };
const rarityColors = ['border-straw/40', 'border-sprout-500/40', 'border-info-500/40', 'border-accent-500/40', 'border-gold/60'] as const;

export function CompendiumHome() {
  const user = useWalletStr();
  const { language } = useLocale();
  const copy = compendiumCopy[language];
  const [reading, setReading] = useState<Read | null>(null);

  useEffect(() => {
    let active = true;
    if (!user) { setReading(null); return () => { active = false; }; }
    setReading({ owner: user, state: 'loading' });
    api.compendium.get(user)
      .then((raw: unknown) => {
        if (!active) return;
        const entries = readCompendiumGrid(raw);
        setReading(entries ? { owner: user, state: 'ready', entries } : { owner: user, state: 'error' });
      })
      .catch(() => { if (active) setReading({ owner: user, state: 'error' }); });
    return () => { active = false; };
  }, [user]);

  const state = !user ? 'disconnected' : reading?.owner !== user ? 'loading' : reading.state;
  const caught = state === 'ready' && reading?.owner === user ? reading.entries ?? null : null;
  const totalCells = COMPENDIUM_TOOL_IDS.length * COMPENDIUM_RARITIES.length;
  const pct = caught ? Math.round((caught.size / totalCells) * 100) : null;
  const message = state === 'disconnected' ? copy.connect : state === 'loading' ? copy.loading :
    state === 'error' ? copy.unavailable : copy.recorded((caught?.size ?? 0).toLocaleString(language), totalCells.toLocaleString(language));

  return (
    <div lang={language} className="p-4 pt-6 pb-24 min-w-0">
      <h1 className="text-2xl font-bold mb-2 break-words">{copy.title}</h1>
      <p className="text-straw text-sm mb-4 break-words">{copy.intro}</p>

      <Card className="mb-4">
        <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
          <span className="text-parchment text-sm font-semibold break-words">{copy.progress}</span>
          <span className="text-accent-500 font-bold">{pct === null ? '—' : `${pct.toLocaleString(language)}%`}</span>
        </div>
        <div className="h-3 bg-soil-800 rounded-full overflow-hidden">
          <motion.div initial={{ width: 0 }} animate={{ width: pct === null ? '0%' : `${pct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-accent-700 to-accent-500 rounded-full" />
        </div>
        <p role="status" className="text-straw text-xs mt-2 break-words">{message}</p>
        <p className="text-straw/70 text-xs mt-3 break-words">{copy.milestone}</p>
      </Card>

      {caught && <div className="space-y-3">
        {COMPENDIUM_TOOL_IDS.map((toolId) => {
          const tool = { id: toolId, label: toolName(language, toolId) };
          return <Card key={tool.id}>
            <h2 className="text-parchment text-sm font-semibold mb-2 break-words">{tool.label}</h2>
            <div className="grid grid-cols-5 gap-1.5 sm:gap-2 min-w-0">
              {COMPENDIUM_RARITIES.map((rarityId, index) => {
                const rarity = { id: rarityId, label: toolsCopy[language].collectionPage.rarities[index], color: rarityColors[index] };
                const key = `${tool.id}-${rarity.id}`;
                const isCaught = caught.has(key);
                const label = isCaught ? copy.found(tool.label, rarity.label) : copy.notFound(tool.label, rarity.label);
                return <div key={key} role="img" aria-label={label} title={label}
                  className={`min-w-0 aspect-square overflow-hidden rounded-xl border-2 flex items-center justify-center text-2xl ${
                    isCaught ? `bg-soil-900 ${rarity.color}` : 'bg-soil-900 border-soil-800 opacity-40'
                  }`}>
                  {isCaught ? (
                    <img src={toolPlate(tool.id, rarity.id)} alt="" loading="lazy" draggable={false}
                      className="h-full w-full object-cover" />
                  ) : '?'}
                </div>;
              })}
            </div>
          </Card>;
        })}
      </div>}
    </div>
  );
}
