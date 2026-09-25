/**
 * NeuroForge visual catalog.
 * Plates are square and padded. UI must use object-fit: contain — never cover.
 *
 * Inventory:
 * - 26 playable resources (economy set). Soul Core is the 27th on-chain kind.
 * - 25 tool NFTs = 5 tools × 5 rarities. Only the Base plate exists so far.
 * - Icons are a separate inset set for chips. Missing icons fall back to the plate.
 */

export const BACKGROUNDS = {
  lab: "/assets/backgrounds/lab.jpg",
  grid: "/assets/backgrounds/grid.jpg",
  forge: "/assets/backgrounds/forge.jpg",
  market: "/assets/backgrounds/market.jpg",
  deep: "/assets/backgrounds/deep.jpg",
  hero: "/assets/backgrounds/hero.jpg",
  blackout: "/assets/backgrounds/blackout.jpg",
  nominal: "/assets/backgrounds/nominal.jpg",
  surge: "/assets/backgrounds/surge.jpg",
  frenzy: "/assets/backgrounds/frenzy.jpg",
} as const;

export const SCENE_BY_TAB: Record<string, string> = {
  farm: BACKGROUNDS.lab,
  tools: BACKGROUNDS.forge,
  economy: BACKGROUNDS.grid,
  market: BACKGROUNDS.market,
  quests: BACKGROUNDS.deep,
  profile: BACKGROUNDS.hero,
};

export type ResourceVisual = {
  id: string;
  name: string;
  en: string;
  plate: string;
  icon?: string;
  group: "playable" | "special";
};

/** 26 playable resources, in economy order. */
export const PLAYABLE_RESOURCES: ResourceVisual[] = [
  { id: "neuron", name: "Нейрон", en: "Neuron", plate: "/assets/nfts/resources/neuron.jpg", icon: "/assets/icons/neuron.jpg", group: "playable" },
  { id: "synapse", name: "Синапс", en: "Synapse", plate: "/assets/nfts/resources/synapse.jpg", icon: "/assets/icons/synapse.jpg", group: "playable" },
  { id: "power", name: "Энергопоток", en: "Power", plate: "/assets/nfts/resources/power.jpg", icon: "/assets/icons/power.jpg", group: "playable" },
  { id: "circuit", name: "Схема", en: "Circuit", plate: "/assets/nfts/resources/circuit.jpg", icon: "/assets/icons/circuit.jpg", group: "playable" },
  { id: "silicon", name: "Кремний", en: "Silicon", plate: "/assets/nfts/resources/silicon.jpg", icon: "/assets/icons/silicon.jpg", group: "playable" },
  { id: "signal", name: "Сигнал", en: "Signal", plate: "/assets/nfts/resources/signal.jpg", icon: "/assets/icons/signal.jpg", group: "playable" },
  { id: "model", name: "Модель", en: "Model", plate: "/assets/nfts/resources/model.jpg", icon: "/assets/icons/model.jpg", group: "playable" },
  { id: "compute", name: "Вычислительный цикл", en: "Compute", plate: "/assets/nfts/resources/compute.jpg", icon: "/assets/icons/compute.jpg", group: "playable" },
  { id: "dataset", name: "Датасет", en: "Dataset", plate: "/assets/nfts/resources/dataset.jpg", icon: "/assets/icons/dataset.jpg", group: "playable" },
  { id: "data", name: "Данные", en: "Data", plate: "/assets/nfts/resources/data.jpg", icon: "/assets/icons/data.jpg", group: "playable" },
  { id: "clearQuartz", name: "Чистый кварц", en: "Clear Quartz", plate: "/assets/nfts/resources/clear-quartz.jpg", icon: "/assets/icons/clear-quartz.jpg", group: "playable" },
  { id: "roseQuartz", name: "Розовый кварц", en: "Rose Quartz", plate: "/assets/nfts/resources/rose-quartz.jpg", icon: "/assets/icons/rose-quartz.jpg", group: "playable" },
  { id: "amberQuartz", name: "Янтарный кварц", en: "Amber Quartz", plate: "/assets/nfts/resources/amber-quartz.jpg", icon: "/assets/icons/amber-quartz.jpg", group: "playable" },
  { id: "blueCore", name: "Синее ядро", en: "Blue Core", plate: "/assets/nfts/resources/blue-core.jpg", icon: "/assets/icons/blue-core.jpg", group: "playable" },
  { id: "purpleCore", name: "Фиолетовое ядро", en: "Purple Core", plate: "/assets/nfts/resources/purple-core.jpg", icon: "/assets/icons/purple-core.jpg", group: "playable" },
  { id: "redCore", name: "Красное ядро", en: "Red Core", plate: "/assets/nfts/resources/red-core.jpg", icon: "/assets/icons/red-core.jpg", group: "playable" },
  { id: "quantumBit", name: "Квантовый бит", en: "Quantum Bit", plate: "/assets/nfts/resources/quantum-bit.jpg", icon: "/assets/icons/quantum-bit.jpg", group: "playable" },
  { id: "neuralChip", name: "Нейрочип", en: "Neural Chip", plate: "/assets/nfts/resources/neural-chip.jpg", icon: "/assets/icons/neural-chip.jpg", group: "playable" },
  { id: "photonBit", name: "Фотонный бит", en: "Photon Bit", plate: "/assets/nfts/resources/photon-bit.jpg", icon: "/assets/icons/photon-bit.jpg", group: "playable" },
  { id: "bioChip", name: "Биочип", en: "Bio Chip", plate: "/assets/nfts/resources/bio-chip.jpg", icon: "/assets/icons/bio-chip.jpg", group: "playable" },
  { id: "cryoFluid", name: "Крио-флюид", en: "Cryo-Fluid", plate: "/assets/nfts/resources/cryo-fluid.jpg", icon: "/assets/icons/cryo-fluid.jpg", group: "playable" },
  { id: "voltFluid", name: "Вольт-флюид", en: "Volt-Fluid", plate: "/assets/nfts/resources/volt-fluid.jpg", icon: "/assets/icons/volt-fluid.jpg", group: "playable" },
  { id: "bioFluid", name: "Био-флюид", en: "Bio-Fluid", plate: "/assets/nfts/resources/bio-fluid.jpg", icon: "/assets/icons/bio-fluid.jpg", group: "playable" },
  { id: "nanoFluid", name: "Нано-флюид", en: "Nano-Fluid", plate: "/assets/nfts/resources/nano-fluid.jpg", icon: "/assets/icons/nano-fluid.jpg", group: "playable" },
  { id: "quantumFluid", name: "Квантовый флюид", en: "Quantum-Fluid", plate: "/assets/nfts/resources/quantum-fluid.jpg", icon: "/assets/icons/quantum-fluid.jpg", group: "playable" },
  { id: "mind", name: "MIND", en: "MIND", plate: "/assets/nfts/resources/mind.jpg", icon: "/assets/icons/mind.jpg", group: "playable" },
];

export const SPECIAL_RESOURCES: ResourceVisual[] = [
  { id: "soulCore", name: "Ядро-душа", en: "Soul Core", plate: "/assets/nfts/resources/soul-core.jpg", group: "special" },
];

export const RESOURCES: ResourceVisual[] = [...PLAYABLE_RESOURCES, ...SPECIAL_RESOURCES];

const LEGACY_RESOURCE_ID: Record<string, string> = {
  food: "data", wood: "circuit", stone: "silicon", potato: "mind",
  seeds: "neuron", wheat: "synapse", flour: "signal", bread: "model",
  water: "power", coal: "compute", meat: "dataset",
  stone_blue: "blueCore", stone_purple: "purpleCore", stone_red: "redCore",
  sand_white: "clearQuartz", sand_pink: "roseQuartz", sand_yellow: "amberQuartz",
  gem_blue: "quantumBit", gem_orange: "neuralChip", gem_white: "photonBit", gem_green: "bioChip",
  flask_blue: "cryoFluid", flask_yellow: "voltFluid", flask_green: "bioFluid",
  flask_pink: "nanoFluid", flask_purple: "quantumFluid",
  love_heart: "soulCore", loveHeart: "soulCore",
  DATA: "data", CIRCUIT: "circuit", SILICON: "silicon", MIND: "mind",
  NEURON: "neuron", SYNAPSE: "synapse", SIGNAL: "signal", MODEL: "model",
  POWER: "power", COMPUTE: "compute", DATASET: "dataset",
};

const BY_ID = new Map(RESOURCES.map((r) => [r.id, r]));

export function resourceVisual(id?: string | null): ResourceVisual | undefined {
  if (!id) return undefined;
  return BY_ID.get(id) || BY_ID.get(LEGACY_RESOURCE_ID[id] || "");
}

/** Chip art: dedicated icon when it exists, otherwise the full plate. */
export function resourceIcon(id?: string | null): string | undefined {
  const visual = resourceVisual(id);
  return visual?.icon || visual?.plate;
}

export function resourcePlate(id?: string | null): string | undefined {
  return resourceVisual(id)?.plate;
}

export const TOOL_RARITIES = ["common", "uncommon", "rare", "epic", "legendary"] as const;
export type ToolRarity = (typeof TOOL_RARITIES)[number];

export const TOOL_NFTS = [
  { id: "plasma_cutter", name: "Плазменный резчик", base: "/assets/nfts/plasma-cutter.jpg" },
  { id: "silicon_extractor", name: "Кремниевый экстрактор", base: "/assets/nfts/silicon-extractor.jpg" },
  { id: "data_harvester", name: "Дата-харвестер", base: "/assets/nfts/data-harvester.jpg" },
  { id: "quantum_transmitter", name: "Квантовый передатчик", base: "/assets/nfts/quantum-transmitter.jpg" },
  { id: "neural_seeder", name: "Нейральный сеятель", base: "/assets/nfts/neural-seeder.jpg" },
] as const;

const LEGACY_TOOL_ID: Record<string, string> = {
  axe: "plasma_cutter",
  pick: "silicon_extractor",
  spear: "data_harvester",
  bow: "quantum_transmitter",
  reaper: "neural_seeder",
};

/** Rarity plates that exist on disk. Missing rarities fall back to Base.
 *  common = Base, uncommon = Enhanced, rare = Quantum, epic = Singularity, legendary = Transcendent.
 */
const TOOL_RARITY_PLATE: Record<string, Partial<Record<ToolRarity, string>>> = {
  plasma_cutter: {
    uncommon: "/assets/nfts/plasma-cutter-uncommon.jpg",
    rare: "/assets/nfts/plasma-cutter-rare.jpg",
    epic: "/assets/nfts/plasma-cutter-epic.jpg",
    legendary: "/assets/nfts/plasma-cutter-legendary.jpg",
  },
  silicon_extractor: {
    uncommon: "/assets/nfts/silicon-extractor-uncommon.jpg",
    rare: "/assets/nfts/silicon-extractor-rare.jpg",
    epic: "/assets/nfts/silicon-extractor-epic.jpg",
    legendary: "/assets/nfts/silicon-extractor-legendary.jpg",
  },
  data_harvester: {
    uncommon: "/assets/nfts/data-harvester-uncommon.jpg",
    rare: "/assets/nfts/data-harvester-rare.jpg",
    epic: "/assets/nfts/data-harvester-epic.jpg",
    legendary: "/assets/nfts/data-harvester-legendary.jpg",
  },
  quantum_transmitter: {
    uncommon: "/assets/nfts/quantum-transmitter-uncommon.jpg",
    rare: "/assets/nfts/quantum-transmitter-rare.jpg",
    epic: "/assets/nfts/quantum-transmitter-epic.jpg",
    legendary: "/assets/nfts/quantum-transmitter-legendary.jpg",
  },
  neural_seeder: {
    uncommon: "/assets/nfts/neural-seeder-uncommon.jpg",
    rare: "/assets/nfts/neural-seeder-rare.jpg",
    epic: "/assets/nfts/neural-seeder-epic.jpg",
    legendary: "/assets/nfts/neural-seeder-legendary.jpg",
  },
};

/** Interface icons. Missing slots stay emoji until the next batches. */
export const UI_ICONS = {
  mill: "/assets/icons/ui/mill.jpg",
  trainer: "/assets/icons/ui/trainer.jpg",
  gridStation: "/assets/icons/ui/grid-station.jpg",
  marketListing: "/assets/icons/ui/market-listing.jpg",
  marketAuction: "/assets/icons/ui/market-auction.jpg",
  marketOffer: "/assets/icons/ui/market-offer.jpg",
  marketRental: "/assets/icons/ui/market-rental.jpg",
  marketOrderbook: "/assets/icons/ui/market-orderbook.jpg",
  marketHot: "/assets/icons/ui/market-hot.jpg",
  rewardDaily: "/assets/icons/ui/reward-daily.jpg",
  menuLab: "/assets/icons/ui/menu-lab.jpg",
  menuWorkshop: "/assets/icons/ui/menu-workshop.jpg",
  menuEconomy: "/assets/icons/ui/menu-economy.jpg",
  menuMarket: "/assets/icons/ui/menu-market.jpg",
  menuQuests: "/assets/icons/ui/menu-quests.jpg",
  menuProfile: "/assets/icons/ui/menu-profile.jpg",
  rankNovice: "/assets/icons/ui/rank-novice.jpg",
  rankOperator: "/assets/icons/ui/rank-operator.jpg",
  rankExperienced: "/assets/icons/ui/rank-experienced.jpg",
  rankVeteran: "/assets/icons/ui/rank-veteran.jpg",
} as const;

/** 5×5 = 25. Every rarity plate exists. Common uses the Base file. */
export function toolPlate(toolId?: string | null, rarity: string = "common"): string | undefined {
  if (!toolId) return undefined;
  const raw = toolId.toLowerCase();
  const id = LEGACY_TOOL_ID[raw] || raw;
  const tool = TOOL_NFTS.find((t) => t.id === id);
  if (!tool) return undefined;
  const key = rarity.toLowerCase() as ToolRarity;
  return TOOL_RARITY_PLATE[id]?.[key] || tool.base;
}

export const RESOURCE_ART: Record<string, string> = Object.fromEntries(
  RESOURCES.map((r) => [r.id, r.plate]),
);
