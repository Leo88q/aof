import { PLAYABLE_RESOURCES, SPECIAL_RESOURCES, TOOL_NFTS, TOOL_RARITIES, toolPlate } from "../../lib/visualAssets";
import { ArtPlate } from "../../components/visual/ArtPlate";

const RARITY_RU = ["Базовый", "Усиленный", "Квантовый", "Сингулярность", "Трансцендентный"];

export function CollectionPage() {
  return (
    <div className="p-4 pt-2 pb-24 space-y-6">
      <p className="text-straw text-xs leading-relaxed">
        26 ресурсов и 25 NFT инструментов. Кадр целиком: пластина квадратная, рисунок не обрезается.
      </p>

      <section>
        <h2 className="text-parchment font-semibold mb-3">26 ресурсов</h2>
        <div className="nf-gallery">
          {PLAYABLE_RESOURCES.map((r) => (
            <article key={r.id} className="nf-gallery__card">
              <ArtPlate src={r.plate} alt={r.name} size="100%" />
              <div className="nf-gallery__name">{r.name}</div>
              <div className="nf-gallery__en">{r.en}</div>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-parchment font-semibold mb-3">Особое</h2>
        <div className="nf-gallery">
          {SPECIAL_RESOURCES.map((r) => (
            <article key={r.id} className="nf-gallery__card">
              <ArtPlate src={r.plate} alt={r.name} size="100%" />
              <div className="nf-gallery__name">{r.name}</div>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-parchment font-semibold mb-1">25 NFT · 5 × 5</h2>
        <p className="text-straw text-xs mb-3">Базовая и усиленная пластины готовы. Квантовая, сингулярность и трансцендентная — следующие пачки, без обрезки.</p>
        <div className="space-y-4">
          {TOOL_NFTS.map((tool) => (
            <div key={tool.id}>
              <div className="text-parchment text-sm mb-2">{tool.name}</div>
              <div className="grid grid-cols-5 gap-2">
                {TOOL_RARITIES.map((rarity, i) => (
                  <div key={rarity} className="min-w-0">
                    <ArtPlate
                      src={toolPlate(tool.id, rarity)}
                      alt={`${tool.name} · ${RARITY_RU[i]}`}
                      size="100%"
                    />
                    <div className="nf-gallery__en mt-1">{RARITY_RU[i]}</div>
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
