import type { getMintAsync } from './mints';

type ResourceKey = Parameters<typeof getMintAsync>[0];
export type WorkshopIngredient = { key: ResourceKey; amount: number };
export type WorkshopRecipe = {
  id: number; category: 'gems' | 'flasks' | 'transformations'; output: WorkshopIngredient;
  inputs: readonly WorkshopIngredient[];
};

/** The craft_recipe table in aof-core/src/instructions/craft_recipe.rs. These are
 * resource units, not token base units; the program burns RESOURCE_UNIT for
 * each input. A single-input recipe passes its first mint as input_2 as well. */
export const WORKSHOP_RECIPES: readonly WorkshopRecipe[] = [
  { id: 0, category: 'gems', output: { key: 'QUANTUM_BIT', amount: 1 }, inputs: [{ key: 'BLUE_CORE', amount: 1 }] },
  { id: 1, category: 'gems', output: { key: 'NEURAL_CHIP', amount: 1 }, inputs: [{ key: 'RED_CORE', amount: 1 }] },
  { id: 2, category: 'gems', output: { key: 'PHOTON_BIT', amount: 1 }, inputs: [{ key: 'CLEAR_QUARTZ', amount: 1 }] },
  { id: 3, category: 'flasks', output: { key: 'CRYO_FLUID', amount: 1 }, inputs: [{ key: 'QUANTUM_BIT', amount: 2 }, { key: 'DATA', amount: 5 }] },
  { id: 4, category: 'flasks', output: { key: 'VOLT_FLUID', amount: 1 }, inputs: [{ key: 'NEURAL_CHIP', amount: 2 }, { key: 'SILICON', amount: 3 }] },
  { id: 5, category: 'flasks', output: { key: 'BIO_FLUID', amount: 1 }, inputs: [{ key: 'CIRCUIT', amount: 5 }, { key: 'NEURON', amount: 5 }] },
  { id: 6, category: 'flasks', output: { key: 'NANO_FLUID', amount: 1 }, inputs: [{ key: 'ROSE_QUARTZ', amount: 3 }, { key: 'DATA', amount: 5 }] },
  { id: 7, category: 'flasks', output: { key: 'QUANTUM_FLUID', amount: 1 }, inputs: [{ key: 'PURPLE_CORE', amount: 1 }, { key: 'BIO_CHIP', amount: 1 }] },
  { id: 8, category: 'transformations', output: { key: 'DATA', amount: 1 }, inputs: [{ key: 'DATASET', amount: 5 }] },
  { id: 9, category: 'transformations', output: { key: 'BLUE_CORE', amount: 1 }, inputs: [{ key: 'CIRCUIT', amount: 8 }] },
  { id: 10, category: 'transformations', output: { key: 'RED_CORE', amount: 1 }, inputs: [{ key: 'SILICON', amount: 8 }] },
  { id: 11, category: 'transformations', output: { key: 'PURPLE_CORE', amount: 1 }, inputs: [{ key: 'NEURON', amount: 8 }] },
  { id: 12, category: 'transformations', output: { key: 'CLEAR_QUARTZ', amount: 1 }, inputs: [{ key: 'CIRCUIT', amount: 6 }, { key: 'DATASET', amount: 2 }] },
  { id: 13, category: 'transformations', output: { key: 'ROSE_QUARTZ', amount: 1 }, inputs: [{ key: 'NEURON', amount: 4 }, { key: 'DATASET', amount: 2 }] },
  { id: 14, category: 'transformations', output: { key: 'BIO_CHIP', amount: 1 }, inputs: [{ key: 'NEURON', amount: 4 }, { key: 'CIRCUIT', amount: 4 }] },
  { id: 15, category: 'transformations', output: { key: 'AMBER_QUARTZ', amount: 1 }, inputs: [{ key: 'PHOTON_BIT', amount: 1 }] },
  { id: 16, category: 'transformations', output: { key: 'MIND', amount: 1 }, inputs: [{ key: 'DATASET', amount: 4 }] },
  { id: 17, category: 'transformations', output: { key: 'COMPUTE', amount: 1 }, inputs: [{ key: 'CIRCUIT', amount: 4 }, { key: 'DATASET', amount: 2 }] },
];

/** Unknown is not the same as insufficient. Callers must load a complete
 * on-chain inventory before asking whether an action is affordable. */
/** seal_laboratory burns one of each and mints one soul core. Not a workshop recipe. */
export const LABORATORY_SEAL: { inputs: readonly WorkshopIngredient[]; output: WorkshopIngredient } = {
  inputs: [
    { key: 'MODEL', amount: 1 },
    { key: 'CRYO_FLUID', amount: 1 },
    { key: 'VOLT_FLUID', amount: 1 },
    { key: 'BIO_FLUID', amount: 1 },
    { key: 'NANO_FLUID', amount: 1 },
    { key: 'QUANTUM_FLUID', amount: 1 },
    { key: 'AMBER_QUARTZ', amount: 1 },
  ],
  output: { key: 'SOUL_CORE', amount: 1 },
};

export function canCraftRecipe(recipe: WorkshopRecipe, balances: Record<string, number> | null): boolean {
  return balances !== null && recipe.inputs.every(({ key, amount }) =>
    typeof balances[key] === 'number' && Number.isFinite(balances[key]) && balances[key] >= amount);
}
