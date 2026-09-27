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
  { id: "neuron", name: "Нейрон", en: "Neuron", plate: "/assets/nfts/resources/neuron.jpg", icon: "/assets/icons/neuron.png", group: "playable" },
  { id: "synapse", name: "Синапс", en: "Synapse", plate: "/assets/nfts/resources/synapse.jpg", icon: "/assets/icons/synapse.png", group: "playable" },
  { id: "power", name: "Энергопоток", en: "Power", plate: "/assets/nfts/resources/power.jpg", icon: "/assets/icons/power.png", group: "playable" },
  { id: "circuit", name: "Схема", en: "Circuit", plate: "/assets/nfts/resources/circuit.jpg", icon: "/assets/icons/circuit.png", group: "playable" },
  { id: "silicon", name: "Кремний", en: "Silicon", plate: "/assets/nfts/resources/silicon.jpg", icon: "/assets/icons/silicon.png", group: "playable" },
  { id: "signal", name: "Сигнал", en: "Signal", plate: "/assets/nfts/resources/signal.jpg", icon: "/assets/icons/signal.png", group: "playable" },
  { id: "model", name: "Модель", en: "Model", plate: "/assets/nfts/resources/model.jpg", icon: "/assets/icons/model.png", group: "playable" },
  { id: "compute", name: "Вычислительный цикл", en: "Compute", plate: "/assets/nfts/resources/compute.jpg", icon: "/assets/icons/compute.png", group: "playable" },
  { id: "dataset", name: "Датасет", en: "Dataset", plate: "/assets/nfts/resources/dataset.jpg", icon: "/assets/icons/dataset.png", group: "playable" },
  { id: "data", name: "Данные", en: "Data", plate: "/assets/nfts/resources/data.jpg", icon: "/assets/icons/data.png", group: "playable" },
  { id: "clearQuartz", name: "Чистый кварц", en: "Clear Quartz", plate: "/assets/nfts/resources/clear-quartz.jpg", icon: "/assets/icons/clear-quartz.png", group: "playable" },
  { id: "roseQuartz", name: "Розовый кварц", en: "Rose Quartz", plate: "/assets/nfts/resources/rose-quartz.jpg", icon: "/assets/icons/rose-quartz.png", group: "playable" },
  { id: "amberQuartz", name: "Янтарный кварц", en: "Amber Quartz", plate: "/assets/nfts/resources/amber-quartz.jpg", icon: "/assets/icons/amber-quartz.png", group: "playable" },
  { id: "blueCore", name: "Синее ядро", en: "Blue Core", plate: "/assets/nfts/resources/blue-core.jpg", icon: "/assets/icons/blue-core.png", group: "playable" },
  { id: "purpleCore", name: "Фиолетовое ядро", en: "Purple Core", plate: "/assets/nfts/resources/purple-core.jpg", icon: "/assets/icons/purple-core.png", group: "playable" },
  { id: "redCore", name: "Красное ядро", en: "Red Core", plate: "/assets/nfts/resources/red-core.jpg", icon: "/assets/icons/red-core.png", group: "playable" },
  { id: "quantumBit", name: "Квантовый бит", en: "Quantum Bit", plate: "/assets/nfts/resources/quantum-bit.jpg", icon: "/assets/icons/quantum-bit.png", group: "playable" },
  { id: "neuralChip", name: "Нейрочип", en: "Neural Chip", plate: "/assets/nfts/resources/neural-chip.jpg", icon: "/assets/icons/neural-chip.png", group: "playable" },
  { id: "photonBit", name: "Фотонный бит", en: "Photon Bit", plate: "/assets/nfts/resources/photon-bit.jpg", icon: "/assets/icons/photon-bit.png", group: "playable" },
  { id: "bioChip", name: "Биочип", en: "Bio Chip", plate: "/assets/nfts/resources/bio-chip.jpg", icon: "/assets/icons/bio-chip.png", group: "playable" },
  { id: "cryoFluid", name: "Крио-флюид", en: "Cryo-Fluid", plate: "/assets/nfts/resources/cryo-fluid.jpg", icon: "/assets/icons/cryo-fluid.png", group: "playable" },
  { id: "voltFluid", name: "Вольт-флюид", en: "Volt-Fluid", plate: "/assets/nfts/resources/volt-fluid.jpg", icon: "/assets/icons/volt-fluid.png", group: "playable" },
  { id: "bioFluid", name: "Био-флюид", en: "Bio-Fluid", plate: "/assets/nfts/resources/bio-fluid.jpg", icon: "/assets/icons/bio-fluid.png", group: "playable" },
  { id: "nanoFluid", name: "Нано-флюид", en: "Nano-Fluid", plate: "/assets/nfts/resources/nano-fluid.jpg", icon: "/assets/icons/nano-fluid.png", group: "playable" },
  { id: "quantumFluid", name: "Квантовый флюид", en: "Quantum-Fluid", plate: "/assets/nfts/resources/quantum-fluid.jpg", icon: "/assets/icons/quantum-fluid.png", group: "playable" },
  { id: "mind", name: "MIND", en: "MIND", plate: "/assets/nfts/resources/mind.jpg", icon: "/assets/icons/mind.png", group: "playable" },
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
  // Russian display names, so recipe outputs resolve by label too.
  "Крио-флюид": "cryoFluid", "Вольт-флюид": "voltFluid", "Био-флюид": "bioFluid",
  "Нано-флюид": "nanoFluid", "Квантовый флюид": "quantumFluid",
  "Квантовый бит": "quantumBit", "Нейрочип": "neuralChip", "Фотон-бит": "photonBit",
  "Фотонный бит": "photonBit", "Био-чип": "bioChip", "Ядро-душа": "soulCore",
  "Ядро души": "soulCore", "Чистый кварц": "clearQuartz", "Розовый кварц": "roseQuartz",
  "Янтарный кварц": "amberQuartz", "Синее ядро": "blueCore", "Голубое ядро": "blueCore",
  "Фиолетовое ядро": "purpleCore", "Красное ядро": "redCore",
  DATA: "data", CIRCUIT: "circuit", SILICON: "silicon", MIND: "mind",
  NEURON: "neuron", SYNAPSE: "synapse", SIGNAL: "signal", MODEL: "model",
  POWER: "power", COMPUTE: "compute", DATASET: "dataset",
};

const BY_ID = new Map(RESOURCES.map((r) => [r.id, r]));

/** Canonical id -> UPPER_SNAKE form used by on-chain balance keys ("clearQuartz" -> "CLEAR_QUARTZ"). */
const BY_UPPER = new Map(
  RESOURCES.map((r) => [r.id.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase(), r]),
);

/**
 * Legacy alias -> resource. Aliases are stored lowercase, but balance and
 * portfolio keys arrive as FOOD / GEM_GREEN / FLASK_PINK, so the alias table
 * is indexed in upper case as well.
 */
const LEGACY_BY_UPPER = new Map<string, ResourceVisual>();
for (const [alias, canon] of Object.entries(LEGACY_RESOURCE_ID)) {
  const visual = BY_ID.get(canon);
  if (visual) LEGACY_BY_UPPER.set(alias.toUpperCase(), visual);
}

export function resourceVisual(id?: string | null): ResourceVisual | undefined {
  if (!id) return undefined;
  return (
    BY_ID.get(id) ||
    BY_UPPER.get(id) ||
    BY_ID.get(LEGACY_RESOURCE_ID[id] || "") ||
    BY_UPPER.get(LEGACY_RESOURCE_ID[id] || "") ||
    LEGACY_BY_UPPER.get(id.toUpperCase())
  );
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
  mill: "/assets/icons/ui/mill.png",
  trainer: "/assets/icons/ui/trainer.png",
  gridStation: "/assets/icons/ui/grid-station.png",
  marketListing: "/assets/icons/ui/market-listing.png",
  marketAuction: "/assets/icons/ui/market-auction.png",
  marketOffer: "/assets/icons/ui/market-offer.png",
  marketRental: "/assets/icons/ui/market-rental.png",
  marketOrderbook: "/assets/icons/ui/market-orderbook.png",
  marketHot: "/assets/icons/ui/market-hot.png",
  rewardDaily: "/assets/icons/ui/reward-daily.png",
  menuLab: "/assets/icons/ui/menu-lab.png",
  menuWorkshop: "/assets/icons/ui/menu-workshop.png",
  menuEconomy: "/assets/icons/ui/menu-economy.png",
  menuMarket: "/assets/icons/ui/menu-market.png",
  menuQuests: "/assets/icons/ui/menu-quests.png",
  menuProfile: "/assets/icons/ui/menu-profile.png",
  rankNovice: "/assets/icons/ui/rank-novice.png",
  rankOperator: "/assets/icons/ui/rank-operator.png",
  rankExperienced: "/assets/icons/ui/rank-experienced.png",
  rankVeteran: "/assets/icons/ui/rank-veteran.png",
  rankLegend: "/assets/icons/ui/rank-legend.png",
  plant: "/assets/icons/ui/plant.png",
  inbox: "/assets/icons/ui/inbox.png",
  catalog: "/assets/icons/ui/catalog.png",
  expedition: "/assets/icons/ui/expedition.png",
  packs: "/assets/icons/ui/packs.png",
  craft: "/assets/icons/ui/craft.png",
  repair: "/assets/icons/ui/repair.png",
  seasonPass: "/assets/icons/ui/season-pass.png",
  achievements: "/assets/icons/ui/achievements.png",
  pantry: "/assets/icons/ui/pantry.png",
  epochs: "/assets/icons/ui/epochs.png",
  economyOverview: "/assets/icons/ui/economy-overview.png",
  economyWorkshop: "/assets/icons/ui/economy-workshop.png",
  drum: "/assets/icons/ui/drum.png",
  lottery: "/assets/icons/ui/lottery.png",
  questsDaily: "/assets/icons/ui/quests-daily.png",
  challenges: "/assets/icons/ui/challenges.png",
  flasks: "/assets/icons/ui/flasks.png",
  labOverview: "/assets/icons/ui/lab-overview.png",
  gems: "/assets/icons/ui/gems.png",
  transformations: "/assets/icons/ui/transformations.png",
  workshopTimer: "/assets/icons/ui/workshop-timer.png",
  inboxReward: "/assets/icons/ui/inbox-reward.png",
  privileges: "/assets/icons/ui/privileges.png",
  weatherNominal: "/assets/icons/ui/weather-nominal.png",
  weatherSurge: "/assets/icons/ui/weather-surge.png",
  weatherBlackout: "/assets/icons/ui/weather-blackout.png",
  weatherFrenzy: "/assets/icons/ui/weather-frenzy.png",
  friends: "/assets/icons/ui/friends.png",
  epochInit: "/assets/icons/ui/epoch-init.png",
  epochTrain: "/assets/icons/ui/epoch-train.png",
  epochTune: "/assets/icons/ui/epoch-tune.png",
  epochInfer: "/assets/icons/ui/epoch-infer.png",
  rebirth: "/assets/icons/ui/rebirth.png",
  trustAge: "/assets/icons/ui/trust-age.png",
  trustTrader: "/assets/icons/ui/trust-trader.png",
  trustStaking: "/assets/icons/ui/trust-staking.png",
  trustGuild: "/assets/icons/ui/trust-guild.png",
  trustAntibot: "/assets/icons/ui/trust-antibot.png",
  noticeSuccess: "/assets/icons/ui/notice-success.png",
  noticeError: "/assets/icons/ui/notice-error.png",
  rewardTrophy: "/assets/icons/ui/reward-trophy.png",
  medalGold: "/assets/icons/ui/reward-medal-gold.png",
  medalSilver: "/assets/icons/ui/reward-medal-silver.png",
  medalBronze: "/assets/icons/ui/reward-medal-bronze.png",
  rewardStar: "/assets/icons/ui/reward-star.png",
  rewardCore: "/assets/icons/ui/reward-core.png",
  medalService: "/assets/icons/ui/reward-medal-service.png",
  chartsBar: "/assets/icons/ui/admin-charts-bar.png",
  chartsUp: "/assets/icons/ui/admin-charts-up.png",
  adminGear: "/assets/icons/ui/admin-gear.png",
  chartsDown: "/assets/icons/ui/admin-charts-down.png",
  locMap: "/assets/icons/ui/loc-map.png",
  locServerRuins: "/assets/icons/ui/loc-serverruins.png",
  locFactory: "/assets/icons/ui/loc-factory.png",
  locVault: "/assets/icons/ui/loc-vault.png",
  locEdge: "/assets/icons/ui/loc-edge.png",
  locCoolLake: "/assets/icons/ui/loc-coollake.png",
  locArid: "/assets/icons/ui/loc-arid.png",
  npcOracle: "/assets/icons/ui/npc-oracle.png",
  buffIdea: "/assets/icons/ui/buff-idea.png",
  auction: "/assets/icons/ui/auction.png",
  rental: "/assets/icons/ui/rental.png",
  rewardCapsule: "/assets/icons/ui/reward-capsule.png",
  rewardSpark: "/assets/icons/ui/reward-spark.png",
  matchZap: "/assets/icons/ui/match-zap.png",
  sentinel: "/assets/icons/ui/sentinel.png",
  ticket: "/assets/icons/ui/ticket.png",
  tokenCoin: "/assets/icons/ui/token-coin.png",
  buildingPlasma: "/assets/icons/ui/building-plasma.png",
  buildingSilicon: "/assets/icons/ui/building-silicon.png",
  buildingData: "/assets/icons/ui/building-data.png",
  buildingQuantum: "/assets/icons/ui/building-quantum.png",
  buildingNeural: "/assets/icons/ui/building-neural.png",
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

/* ─── Brand Assets ─── */
export const BRAND = {
  tokenIcon: "/assets/brand/token-512.png",
  tokenIcon256: "/assets/brand/token-256.png",
  tokenIcon128: "/assets/brand/token-128.png",
  appIcon: "/assets/brand/app-icon.png",
  dappStoreIcon: "/assets/brand/dapp-512.png",
  ogImage: "/assets/brand/og-1200x630.png",
  walletBanner: "/assets/brand/wallet-1200x400.png",
  tokenMetadata: "/assets/brand/token-metadata.json",
  logoSvg: "/favicon.svg",
  favicon: "/favicon.ico",
} as const;
