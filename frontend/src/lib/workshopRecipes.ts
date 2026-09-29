import type { getMintAsync } from './mints';

type ResourceKey = Parameters<typeof getMintAsync>[0];
export type WorkshopIngredient = { key: ResourceKey; amount: number };
export type WorkshopRecipe = {
  id: number; category: 'gems' | 'flasks'; output: WorkshopIngredient;
  inputs: readonly WorkshopIngredient[];
};

/** The eight recipes in aof-core/src/instructions/craft_recipe.rs. These are
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
];

/** Unknown is not the same as insufficient. Callers must load a complete
 * on-chain inventory before asking whether an action is affordable. */
export function canCraftRecipe(recipe: WorkshopRecipe, balances: Record<string, number> | null): boolean {
  return balances !== null && recipe.inputs.every(({ key, amount }) =>
    typeof balances[key] === 'number' && Number.isFinite(balances[key]) && balances[key] >= amount);
}
