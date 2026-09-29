import { PLAYABLE_RESOURCES, SPECIAL_RESOURCES, TOOL_NFTS, TOOL_RARITIES, toolPlate } from "../../lib/visualAssets";
import { ArtPlate } from "../../components/visual/ArtPlate";
import { useLocale } from "../../i18n/LocaleProvider";
import { homeResourceNames, type ResourceId } from "../../i18n/homeDetail";
import { toolName, toolsCopy } from "../../i18n/toolsCopy";

export function CollectionPage() {
  const { language } = useLocale();
  const copy = toolsCopy[language].collectionPage;
  const resourceName = (id: string, fallback: string) => homeResourceNames[language][id as ResourceId] || fallback;
  return (
    <div lang={language} className="p-4 pt-2 pb-24 space-y-6 min-w-0">
      <p className="text-straw text-xs leading-relaxed">
        {copy.intro}
      </p>

      <section>
        <h2 className="text-parchment font-semibold mb-3">{copy.resources}</h2>
        <div className="nf-gallery">
          {PLAYABLE_RESOURCES.map((r) => (
            <article key={r.id} className="nf-gallery__card">
              <ArtPlate src={r.plate} alt={resourceName(r.id, language === 'ru' ? r.name : r.en)} size="100%" />
              <div className="nf-gallery__name">{resourceName(r.id, language === 'ru' ? r.name : r.en)}</div>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-parchment font-semibold mb-3">{copy.special}</h2>
        <div className="nf-gallery">
          {SPECIAL_RESOURCES.map((r) => (
            <article key={r.id} className="nf-gallery__card">
              <ArtPlate src={r.plate} alt={resourceName(r.id, language === 'ru' ? r.name : r.en)} size="100%" />
              <div className="nf-gallery__name">{resourceName(r.id, language === 'ru' ? r.name : r.en)}</div>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-parchment font-semibold mb-1">{copy.nfts}</h2>
        <p className="text-straw text-xs mb-3">{copy.caption}</p>
        <div className="space-y-4">
          {TOOL_NFTS.map((tool) => (
            <div key={tool.id}>
              <div className="text-parchment text-sm mb-2 break-words">{toolName(language, tool.id)}</div>
              <div className="grid grid-cols-5 gap-2">
                {TOOL_RARITIES.map((rarity, i) => (
                  <div key={rarity} className="min-w-0">
                    <ArtPlate
                      src={toolPlate(tool.id, rarity)}
                      alt={`${toolName(language, tool.id)} · ${copy.rarities[i]}`}
                      size="100%"
                    />
                    <div className="nf-gallery__en mt-1">{copy.rarities[i]}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
