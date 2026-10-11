import { homeResourceNames } from '../i18n/homeDetail';

/**
 * NeuroForge visual catalog.
 * Plates are square and padded. UI must use object-fit: contain — never cover.
 *
 * Inventory:
 * - 26 playable resources (economy set). Soul Core is the 27th on-chain kind.
 * - 25 tool NFT variants = 5 tools × 5 rarities. All 25 rarity plates are present.
 * - Icons are a separate inset set for chips. Missing icons fall back to the plate.
 */

/** Laboratory raffle plates. Decorative only; they do not prove a draw or a payment. */
/** Expedition bay and depth sonar. Decorative; motion is not a trip result. */
export const EXPLORATION_ART = {
  bay: "/assets/exploration/bay.jpg",
  sonar: "/assets/exploration/sonar.jpg",
} as const;

export const LOTTERY_ART = {
  sol: "/assets/lottery/sol.jpg",
  skr: "/assets/lottery/skr.jpg",
  potato: "/assets/lottery/potato.jpg",
  drum: "/assets/lottery/drum.jpg",
} as const;

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
  { id: "neuron", name: homeResourceNames.ru.neuron, en: homeResourceNames.en.neuron, plate: "/assets/nfts/resources/neuron.png", icon: "/assets/icons/neuron.png", group: "playable" },
  { id: "synapse", name: homeResourceNames.ru.synapse, en: homeResourceNames.en.synapse, plate: "/assets/nfts/resources/synapse.png", icon: "/assets/icons/synapse.png", group: "playable" },
  { id: "power", name: homeResourceNames.ru.power, en: homeResourceNames.en.power, plate: "/assets/nfts/resources/power.png", icon: "/assets/icons/power.png", group: "playable" },
  { id: "circuit", name: homeResourceNames.ru.circuit, en: homeResourceNames.en.circuit, plate: "/assets/nfts/resources/circuit.png", icon: "/assets/icons/circuit.png", group: "playable" },
  { id: "silicon", name: homeResourceNames.ru.silicon, en: homeResourceNames.en.silicon, plate: "/assets/nfts/resources/silicon.png", icon: "/assets/icons/silicon.png", group: "playable" },
  { id: "signal", name: homeResourceNames.ru.signal, en: homeResourceNames.en.signal, plate: "/assets/nfts/resources/signal.png", icon: "/assets/icons/signal.png", group: "playable" },
  { id: "model", name: homeResourceNames.ru.model, en: homeResourceNames.en.model, plate: "/assets/nfts/resources/model.png", icon: "/assets/icons/model.png", group: "playable" },
  { id: "compute", name: homeResourceNames.ru.compute, en: homeResourceNames.en.compute, plate: "/assets/nfts/resources/compute.png", icon: "/assets/icons/compute.png", group: "playable" },
  { id: "dataset", name: homeResourceNames.ru.dataset, en: homeResourceNames.en.dataset, plate: "/assets/nfts/resources/dataset.png", icon: "/assets/icons/dataset.png", group: "playable" },
  { id: "data", name: homeResourceNames.ru.data, en: homeResourceNames.en.data, plate: "/assets/nfts/resources/data.png", icon: "/assets/icons/data.png", group: "playable" },
  { id: "clearQuartz", name: homeResourceNames.ru.clearQuartz, en: homeResourceNames.en.clearQuartz, plate: "/assets/nfts/resources/clear-quartz.png", icon: "/assets/icons/clear-quartz.png", group: "playable" },
  { id: "roseQuartz", name: homeResourceNames.ru.roseQuartz, en: homeResourceNames.en.roseQuartz, plate: "/assets/nfts/resources/rose-quartz.png", icon: "/assets/icons/rose-quartz.png", group: "playable" },
  { id: "amberQuartz", name: homeResourceNames.ru.amberQuartz, en: homeResourceNames.en.amberQuartz, plate: "/assets/nfts/resources/amber-quartz.png", icon: "/assets/icons/amber-quartz.png", group: "playable" },
  { id: "blueCore", name: homeResourceNames.ru.blueCore, en: homeResourceNames.en.blueCore, plate: "/assets/nfts/resources/blue-core.png", icon: "/assets/icons/blue-core.png", group: "playable" },
  { id: "purpleCore", name: homeResourceNames.ru.purpleCore, en: homeResourceNames.en.purpleCore, plate: "/assets/nfts/resources/purple-core.png", icon: "/assets/icons/purple-core.png", group: "playable" },
  { id: "redCore", name: homeResourceNames.ru.redCore, en: homeResourceNames.en.redCore, plate: "/assets/nfts/resources/red-core.png", icon: "/assets/icons/red-core.png", group: "playable" },
  { id: "quantumBit", name: homeResourceNames.ru.quantumBit, en: homeResourceNames.en.quantumBit, plate: "/assets/nfts/resources/quantum-bit.png", icon: "/assets/icons/quantum-bit.png", group: "playable" },
  { id: "neuralChip", name: homeResourceNames.ru.neuralChip, en: homeResourceNames.en.neuralChip, plate: "/assets/nfts/resources/neural-chip.png", icon: "/assets/icons/neural-chip.png", group: "playable" },
  { id: "photonBit", name: homeResourceNames.ru.photonBit, en: homeResourceNames.en.photonBit, plate: "/assets/nfts/resources/photon-bit.png", icon: "/assets/icons/photon-bit.png", group: "playable" },
  { id: "bioChip", name: homeResourceNames.ru.bioChip, en: homeResourceNames.en.bioChip, plate: "/assets/nfts/resources/bio-chip.png", icon: "/assets/icons/bio-chip.png", group: "playable" },
  { id: "cryoFluid", name: homeResourceNames.ru.cryoFluid, en: homeResourceNames.en.cryoFluid, plate: "/assets/nfts/resources/cryo-fluid.png", icon: "/assets/icons/cryo-fluid.png", group: "playable" },
  { id: "voltFluid", name: homeResourceNames.ru.voltFluid, en: homeResourceNames.en.voltFluid, plate: "/assets/nfts/resources/volt-fluid.png", icon: "/assets/icons/volt-fluid.png", group: "playable" },
  { id: "bioFluid", name: homeResourceNames.ru.bioFluid, en: homeResourceNames.en.bioFluid, plate: "/assets/nfts/resources/bio-fluid.png", icon: "/assets/icons/bio-fluid.png", group: "playable" },
  { id: "nanoFluid", name: homeResourceNames.ru.nanoFluid, en: homeResourceNames.en.nanoFluid, plate: "/assets/nfts/resources/nano-fluid.png", icon: "/assets/icons/nano-fluid.png", group: "playable" },
  { id: "quantumFluid", name: homeResourceNames.ru.quantumFluid, en: homeResourceNames.en.quantumFluid, plate: "/assets/nfts/resources/quantum-fluid.png", icon: "/assets/icons/quantum-fluid.png", group: "playable" },
  { id: "mind", name: homeResourceNames.ru.mind, en: homeResourceNames.en.mind, plate: "/assets/nfts/resources/mind.png", icon: "/assets/icons/mind.png", group: "playable" },
];

export const SPECIAL_RESOURCES: ResourceVisual[] = [
  { id: "soulCore", name: homeResourceNames.ru.soulCore, en: homeResourceNames.en.soulCore, plate: "/assets/nfts/resources/soul-core.png", group: "special" },
];

export const RESOURCES: ResourceVisual[] = [...PLAYABLE_RESOURCES, ...SPECIAL_RESOURCES];

const BY_ID = new Map(RESOURCES.map((r) => [r.id, r]));

/** Canonical id -> UPPER_SNAKE form used by on-chain balance keys ("clearQuartz" -> "CLEAR_QUARTZ"). */
const BY_UPPER = new Map(
  RESOURCES.map((r) => [r.id.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase(), r]),
);

export function resourceVisual(id?: string | null): ResourceVisual | undefined {
  if (!id) return undefined;
  return BY_ID.get(id) || BY_UPPER.get(id);
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
  { id: "plasma_cutter", base: "/assets/nfts/plasma-cutter.png" },
  { id: "silicon_extractor", base: "/assets/nfts/silicon-extractor.png" },
  { id: "data_harvester", base: "/assets/nfts/data-harvester.png" },
  { id: "quantum_transmitter", base: "/assets/nfts/quantum-transmitter.png" },
  { id: "neural_seeder", base: "/assets/nfts/neural-seeder.png" },
] as const;

/** Rarity plates that exist on disk. Missing rarities fall back to Base.
 *  common = Base, uncommon = Enhanced, rare = Quantum, epic = Singularity, legendary = Transcendent.
 */
const TOOL_RARITY_PLATE: Record<string, Partial<Record<ToolRarity, string>>> = {
  plasma_cutter: {
    uncommon: "/assets/nfts/plasma-cutter-uncommon.png",
    rare: "/assets/nfts/plasma-cutter-rare.png",
    epic: "/assets/nfts/plasma-cutter-epic.png",
    legendary: "/assets/nfts/plasma-cutter-legendary.png",
  },
  silicon_extractor: {
    uncommon: "/assets/nfts/silicon-extractor-uncommon.png",
    rare: "/assets/nfts/silicon-extractor-rare.png",
    epic: "/assets/nfts/silicon-extractor-epic.png",
    legendary: "/assets/nfts/silicon-extractor-legendary.png",
  },
  data_harvester: {
    uncommon: "/assets/nfts/data-harvester-uncommon.png",
    rare: "/assets/nfts/data-harvester-rare.png",
    epic: "/assets/nfts/data-harvester-epic.png",
    legendary: "/assets/nfts/data-harvester-legendary.png",
  },
  quantum_transmitter: {
    uncommon: "/assets/nfts/quantum-transmitter-uncommon.png",
    rare: "/assets/nfts/quantum-transmitter-rare.png",
    epic: "/assets/nfts/quantum-transmitter-epic.png",
    legendary: "/assets/nfts/quantum-transmitter-legendary.png",
  },
  neural_seeder: {
    uncommon: "/assets/nfts/neural-seeder-uncommon.png",
    rare: "/assets/nfts/neural-seeder-rare.png",
    epic: "/assets/nfts/neural-seeder-epic.png",
    legendary: "/assets/nfts/neural-seeder-legendary.png",
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
  vipCopper: "/assets/icons/ui/vip-copper.png",
  vipOrchid: "/assets/icons/ui/vip-orchid.png",
  achievements: "/assets/icons/ui/achievements.png",
  pantry: "/assets/icons/ui/pantry.png",
  epochs: "/assets/icons/ui/epochs.png",
  economyOverview: "/assets/icons/ui/economy-overview.png",
  economyWorkshop: "/assets/icons/ui/economy-workshop.png",
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
  const id = raw;
  const tool = TOOL_NFTS.find((t) => t.id === id);
  if (!tool) return undefined;
  const key = rarity.toLowerCase() as ToolRarity;
  return TOOL_RARITY_PLATE[id]?.[key] || tool.base;
}

export const RESOURCE_ART: Record<string, string> = Object.fromEntries(
  RESOURCES.map((r) => [r.id, r.plate]),
);

/**
 * Витрина капсул дропа [F-06]. Одна плитка на размер плюс открытая плитка —
 * она показывает механику, а не выигрыш: что именно выпало, определяется
 * оракулом в сети (см. PacksPage).
 */
export const PACK_ART: Record<string, string> = {
  small: "/assets/packs/pack-small.jpg",
  medium: "/assets/packs/pack-medium.jpg",
  big: "/assets/packs/pack-big.jpg",
  opened: "/assets/packs/pack-open.jpg",
};

export function packPlate(id?: string | null): string | undefined {
  return id ? PACK_ART[id] : undefined;
}

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
