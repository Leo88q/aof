import { useEffect, useRef, useState } from "react";
import { api } from "../../lib/api";
import { handleTxResponse } from "../../lib/txFlow";
import { actionErrorFeedback } from "../../lib/txResponseFeedback";
import { walletRuntimeCopy } from "../../i18n/walletRuntimeCopy";
import { getMintAsync } from "../../lib/mints";
import { readEconomyBalances, economyResourceName } from "../../lib/economyBalances";
import { WORKSHOP_RECIPES, canCraftRecipe } from "../../lib/workshopRecipes";
import { formatResourceShortage, shortagesFromBalances } from "../../lib/resourceShortageMessage";
import { useEconomyBalances } from "./useEconomyBalances";
import { useLocale } from "../../i18n/LocaleProvider";
import { recipeWorkshopCopy } from "../../i18n/recipeWorkshopCopy";
import { useWalletStore } from "../../store/walletStore";
import { useNav } from "../../nav/NavContext";
import { NavHeader } from "../../components/NavHeader";
import { UI_ICONS, resourceIcon } from "../../lib/visualAssets";
import { ResourceGlyph } from "../../components/visual/ResourceGlyph";
import { NoticeMsg } from "../../components/visual/NoticeMsg";

type Section = "gems" | "flasks" | "transformations" | "timed";
const SECTIONS: readonly { key: Section; icon: string }[] = [
  { key: "gems", icon: UI_ICONS.gems },
  { key: "flasks", icon: UI_ICONS.flasks },
  { key: "transformations", icon: UI_ICONS.transformations },
  { key: "timed", icon: UI_ICONS.workshopTimer },
];

export function Workshop() {
  const { language } = useLocale();
  const copy = recipeWorkshopCopy[language];
  const { address } = useWalletStore();
  const { push } = useNav();
  const [section, setSection] = useState<Section>("gems");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ language: typeof language; text: string } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const { balances, state } = useEconomyBalances(address, refreshKey);
  const inFlight = useRef(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    setMessage(null);
    return () => { if (flashTimer.current) clearTimeout(flashTimer.current); };
  }, [language]);
  const flash = (text: string) => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setMessage({ language, text });
    flashTimer.current = setTimeout(() => setMessage(null), 6500);
  };

  async function craft(recipeId: number) {
    if (inFlight.current) return;
    if (!address) return flash(copy.connect);
    const recipe = WORKSHOP_RECIPES.find(item => item.id === recipeId);
    if (!recipe) return flash(copy.missingRecipe);
    if (!balances) return flash(copy.unavailable);
    inFlight.current = true;
    setBusy(true);
    try {
      // The inventory displayed on the cards can be stale. Read every input
      // again before handing a transaction to the wallet. A partial response
      // must not look like zero cost or zero balance.
      const fresh = readEconomyBalances(await api.query.balances(address));
      if (!fresh) { flash(copy.unavailable); return; }
      if (!canCraftRecipe(recipe, fresh)) {
        const missing = shortagesFromBalances(fresh, recipe.inputs.map(input => ({ resource: input.key, need: input.amount })));
        flash(missing && missing.length > 0 ? formatResourceShortage(language, missing) : copy.insufficient);
        setRefreshKey(n => n + 1);
        return;
      }
      const [input1Mint, input2Mint, outputMint] = await Promise.all([
        getMintAsync(recipe.inputs[0].key),
        getMintAsync((recipe.inputs[1] || recipe.inputs[0]).key),
        getMintAsync(recipe.output.key),
      ]);
      if (!input1Mint || !input2Mint || !outputMint) { flash(copy.missingRegistry); return; }
      if (useWalletStore.getState().address !== address) { flash(copy.walletChanged); return; }
      flash(copy.submitting);
      const response = await api.chain.craftRecipe({ user: address, recipeId, input1Mint, input2Mint, outputMint });
      if (useWalletStore.getState().address !== address) { flash(copy.walletChanged); return; }
      // This route is wallet co-signed: no tx means no verified craft receipt.
      if (!response?.tx) { flash(copy.failed); return; }
      const result = await handleTxResponse(response);
      if (result.success && result.signature) {
        flash(`${copy.crafted}: ${result.signature.slice(0, 10)}…`);
        setRefreshKey(n => n + 1);
        window.dispatchEvent(new CustomEvent("aof:refresh"));
      } else flash(result.error || walletRuntimeCopy[language].unconfirmedResponse);
    } catch (error) {
      const code = (error as { code?: unknown } | null)?.code;
      flash(code === 'RECIPE_NOT_ON_THIS_PROGRAM' ? copy.programOld : actionErrorFeedback(error, language, walletRuntimeCopy[language].unconfirmedResponse));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <div lang={language} className="workshop min-w-0">
      <div className="sub-tabs">
        {SECTIONS.map(item => (
          <button type="button" key={item.key} aria-pressed={section === item.key}
            className={"sub-tab-btn" + (section === item.key ? " active" : "")}
            onClick={() => setSection(item.key)}>
            <ResourceGlyph icon={item.icon} alt="" className="w-4 h-4 shrink-0" />
            <span>{item.key === 'gems' ? copy.gems : item.key === 'flasks' ? copy.flasks : item.key === 'timed' ? copy.timed : copy.transformations}</span>
          </button>
        ))}
      </div>
      <button type="button" className="btn" onClick={() => {
        void import("../farm/FinalePage").then(({ FinalePage }) => {
          push("farm", "finale", (<><NavHeader headerId="finale" tabKey="farm" /><FinalePage /></>));
        });
      }}>{copy.seal}</button>

      {message?.language === language && <div role="status" className="workshop-msg"><NoticeMsg text={message.text} /></div>}

      {(section === 'gems' || section === 'flasks' || section === 'transformations') ? (
        <>
          <p className="text-straw text-sm leading-relaxed" role="status">
            {state === 'disconnected' ? copy.connect : state === 'loading' ? copy.loading : state === 'error' ? copy.unavailable : ''}
          </p>
          <div className="recipe-grid">
            {WORKSHOP_RECIPES.filter(recipe => recipe.category === section).map(recipe => {
              const name = economyResourceName(language, recipe.output.key);
              const affordable = canCraftRecipe(recipe, balances);
              return (
                <div key={recipe.id} className="recipe-card min-w-0">
                  <div className="flex items-center gap-2 mb-2 min-w-0">
                    <ResourceGlyph icon={resourceIcon(recipe.output.key) || ""} alt="" className="w-7 h-7 shrink-0" />
                    <div className="font-semibold text-sm text-parchment break-words min-w-0">{name}</div>
                  </div>
                  <div className="rounded-md bg-black/20 p-2 mb-2 min-w-0">
                    <div className="text-xs text-straw mb-1">{copy.ingredients}:</div>
                    {recipe.inputs.map(input => (
                      <div key={input.key} className="flex flex-wrap items-center gap-1 text-xs text-parchment min-w-0">
                        <ResourceGlyph icon={resourceIcon(input.key) || ""} alt="" className="w-4 h-4 shrink-0" />
                        <span className="break-words min-w-0">{economyResourceName(language, input.key)}</span>
                        <span className="font-semibold text-cyan-300 ml-auto">×{input.amount}</span>
                        {balances && <span className="w-full text-straw break-words">
                          {copy.balance}: {balances[input.key].toLocaleString(language, { maximumFractionDigits: 9 })}
                        </span>}
                      </div>
                    ))}
                  </div>
                  <div className="text-xs text-straw mb-2">
                    → {name} ×{recipe.output.amount}
                  </div>
                  {balances && !affordable && <p className="text-xs text-gold-400 mb-2">{copy.insufficient}</p>}
                  <button type="button" className="recipe-btn" disabled={!address || !affordable || busy}
                    onClick={() => craft(recipe.id)}>
                    {busy ? copy.crafting : copy.craft}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="text-center py-6 px-4 min-w-0">
          <ResourceGlyph icon={UI_ICONS.locEdge} alt="" className="w-12 h-12 inline-block mb-3" />
          <h3 className="text-lg font-semibold text-parchment mb-2 break-words">{copy.elsewhereTitle}</h3>
          <p className="text-straw text-sm leading-relaxed max-w-lg mx-auto break-words">{copy.elsewhere}</p>
          <div className="flex flex-wrap justify-center gap-2 mt-4 text-xs text-parchment">
            <span>{copy.lab}</span><span aria-hidden="true">→</span><span>{copy.processing}</span><span>{copy.training}</span>
          </div>
          <div className="flex flex-wrap justify-center gap-2 mt-3 text-xs text-straw">
            <span>{copy.station}</span><span>·</span><span>{copy.cultivation}</span>
          </div>
        </div>
      )}
    </div>
  );
}
