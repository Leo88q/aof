/** NeuroForge visual catalog. Photographic plates live in /public/assets. */

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

export const RESOURCE_ART: Record<string, string> = {
  data: "/assets/nfts/resources/data.jpg",
  circuit: "/assets/nfts/resources/circuit.jpg",
  silicon: "/assets/nfts/resources/silicon.jpg",
  neuron: "/assets/nfts/resources/neuron.jpg",
  synapse: "/assets/nfts/resources/synapse.jpg",
  signal: "/assets/nfts/resources/signal.jpg",
  model: "/assets/nfts/resources/model.jpg",
  power: "/assets/nfts/resources/power.jpg",
  compute: "/assets/nfts/resources/compute.jpg",
  dataset: "/assets/nfts/resources/dataset.jpg",
  mind: "/assets/nfts/resources/mind.jpg",
  soulCore: "/assets/nfts/resources/soul-core.jpg",
  dropCapsule: "/assets/nfts/resources/drop-capsule.jpg",
  quantumBit: "/assets/nfts/resources/quantum-bit.jpg",
  neuralChip: "/assets/nfts/resources/neural-chip.jpg",
  photonBit: "/assets/nfts/resources/photon-bit.jpg",
  bioChip: "/assets/nfts/resources/bio-chip.jpg",
  cryoFluid: "/assets/nfts/resources/cryo-fluid.jpg",
  voltFluid: "/assets/nfts/resources/volt-fluid.jpg",
  quantumFluid: "/assets/nfts/resources/quantum-fluid.jpg",
};

export const SCENE_BY_TAB: Record<string, string> = {
  farm: BACKGROUNDS.lab,
  tools: BACKGROUNDS.forge,
  economy: BACKGROUNDS.grid,
  market: BACKGROUNDS.market,
  quests: BACKGROUNDS.deep,
  profile: BACKGROUNDS.hero,
};
