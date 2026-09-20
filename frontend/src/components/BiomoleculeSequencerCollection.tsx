import { useState } from "react";
import { motion } from "framer-motion";
import {
  BIOMOLECULE_SEQUENCER_NFTS,
  type NftCollectionItem,
} from "../lib/nftCollection";

interface NftCollectionGalleryProps {
  title: string;
  collection: string;
  nfts: readonly NftCollectionItem[];
}

function NftCard({ item, selected, onSelect }: {
  item: NftCollectionItem;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.97 }}
      onClick={onSelect}
      className={`group w-[112px] shrink-0 overflow-hidden rounded-2xl border text-left transition ${
        selected ? "border-wheat-500 shadow-glow" : "border-straw/15 hover:border-straw/40"
      }`}
      aria-pressed={selected}
      aria-label={`${item.name}, ${item.rarityLabel}`}
    >
      <div className="relative aspect-[9/16] overflow-hidden bg-soil-900">
        <img
          src={item.image}
          alt={`${item.name} — ${item.rarityLabel}`}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          loading="lazy"
          draggable={false}
        />
      </div>
      <div className="bg-soil-850 px-2 py-2">
        <div className="truncate text-[11px] font-semibold text-parchment">{item.rarityLabel}</div>
        <div className="mt-0.5 truncate text-[10px] text-straw">{item.collection}</div>
      </div>
    </motion.button>
  );
}

export function NftCollectionGallery({ title, collection, nfts }: NftCollectionGalleryProps) {
  const [selectedId, setSelectedId] = useState(nfts[0]?.id || "");
  const selected = nfts.find((item) => item.id === selectedId) || nfts[0];

  if (!selected) return null;

  return (
    <section className="mb-4 rounded-3xl border border-wheat-500/25 bg-gradient-to-br from-soil-850 to-soil-900 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-wheat-500">NFT collection</div>
          <h2 className="mt-1 text-lg font-bold text-parchment">{title}</h2>
          <p className="mt-1 text-xs text-straw">{collection} · {nfts.length} вариантов редкости</p>
        </div>
        <span className="rounded-full border border-wheat-500/30 px-2 py-1 text-[10px] font-bold text-wheat-500">
          CATALOG
        </span>
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2" role="list" aria-label={`Варианты NFT ${title}`}>
        {nfts.map((item) => (
          <div role="listitem" key={item.id}>
            <NftCard
              item={item}
              selected={item.id === selected.id}
              onSelect={() => setSelectedId(item.id)}
            />
          </div>
        ))}
      </div>

      <motion.div
        key={selected.id}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-3 rounded-2xl border border-straw/10 bg-soil-950/30 p-3"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-parchment">{selected.name}</div>
            <div className="mt-0.5 text-xs" style={{ color: selected.accent }}>
              {selected.rarityLabel} · {selected.collection}
            </div>
          </div>
          <a
            href={selected.metadata}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-straw/20 px-2 py-1 text-[10px] font-semibold text-straw transition hover:border-wheat-500/50 hover:text-wheat-500"
          >
            Metadata
          </a>
        </div>
        <p className="mt-2 text-xs leading-5 text-straw">{selected.description}</p>
      </motion.div>

      <p className="mt-3 text-[10px] leading-4 text-straw/70">
        Каталог использует локальные assets проекта. Минтинг и владение подключаются отдельно к on-chain коллекции.
      </p>
    </section>
  );
}

export function BiomoleculeSequencerCollection() {
  return (
    <NftCollectionGallery
      title="Biomolecule Sequencer"
      collection="Neural Analyzer"
      nfts={BIOMOLECULE_SEQUENCER_NFTS}
    />
  );
}
