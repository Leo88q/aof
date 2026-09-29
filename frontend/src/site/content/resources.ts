import type { Resource } from './schema';
import { homeResourceNames } from '../../i18n/homeDetail';
import { resourceLeads } from '../../i18n/resourceLeads';
import { resourceCatalogCopy } from '../../i18n/resourceCatalogCopy';

export const resources: Resource[] = [
  // ── Base Resources ──
  { id: 'data', slug: 'data', name: homeResourceNames.ru.data, category: 'base', status: 'live',
    lead: resourceLeads.ru.data,
    relatedMechanics: ['packs', 'quests', 'craft'], relatedResources: ['circuit', 'silicon'] },

  { id: 'circuit', slug: 'circuit', name: homeResourceNames.ru.circuit, category: 'base', status: 'live',
    lead: resourceLeads.ru.circuit,
    relatedMechanics: ['mine', 'tools', 'craft'], relatedResources: ['silicon', 'compute'] },

  { id: 'silicon', slug: 'silicon', name: homeResourceNames.ru.silicon, category: 'base', status: 'live',
    lead: resourceLeads.ru.silicon,
    relatedMechanics: ['mine', 'craft'], relatedResources: ['blueCore', 'purpleCore', 'redCore'] },

  { id: 'compute', slug: 'compute', name: homeResourceNames.ru.compute, category: 'base', status: 'live',
    lead: resourceLeads.ru.compute,
    relatedMechanics: ['mine', 'craft'], relatedResources: ['circuit', 'silicon'] },

  { id: 'dataset', slug: 'dataset', name: homeResourceNames.ru.dataset, category: 'base', status: 'live',
    lead: resourceLeads.ru.dataset,
    relatedMechanics: ['mine', 'craft'], relatedResources: ['data', 'circuit'] },

  // ── Model Chain ──
  { id: 'neuron', slug: 'neuron', name: homeResourceNames.ru.neuron, category: 'chain', status: 'live',
    lead: resourceLeads.ru.neuron,
    relatedMechanics: ['farm', 'weather', 'energy'], relatedResources: ['synapse', 'power'] },

  { id: 'synapse', slug: 'synapse', name: homeResourceNames.ru.synapse, category: 'chain', status: 'live',
    lead: resourceLeads.ru.synapse,
    relatedMechanics: ['farm', 'weather', 'seasons'], relatedResources: ['neuron', 'signal'] },

  { id: 'signal', slug: 'signal', name: homeResourceNames.ru.signal, category: 'chain', status: 'live',
    lead: resourceLeads.ru.signal,
    relatedMechanics: ['farm', 'energy'], relatedResources: ['synapse', 'model'] },

  { id: 'model', slug: 'model', name: homeResourceNames.ru.model, category: 'chain', status: 'live',
    lead: resourceLeads.ru.model,
    relatedMechanics: ['farm', 'energy'], relatedResources: ['signal', 'circuit'] },

  { id: 'power', slug: 'power', name: homeResourceNames.ru.power, category: 'base', status: 'live',
    lead: resourceLeads.ru.power,
    relatedMechanics: ['farm', 'weather'], relatedResources: ['neuron', 'circuit'] },

  // ── Cores ──
  { id: 'blueCore', slug: 'blue-core', name: homeResourceNames.ru.blueCore, category: 'rare', status: 'live',
    lead: resourceLeads.ru.blueCore,
    relatedMechanics: ['mine', 'craft'], relatedResources: ['quantumBit'] },

  { id: 'purpleCore', slug: 'purple-core', name: homeResourceNames.ru.purpleCore, category: 'rare', status: 'live',
    lead: resourceLeads.ru.purpleCore,
    relatedMechanics: ['mine', 'craft', 'drum'], relatedResources: ['quantumFluid'] },

  { id: 'redCore', slug: 'red-core', name: homeResourceNames.ru.redCore, category: 'rare', status: 'live',
    lead: resourceLeads.ru.redCore,
    relatedMechanics: ['mine', 'craft'], relatedResources: ['neuralChip'] },

  // ── Quartz ──
  { id: 'clearQuartz', slug: 'clear-quartz', name: homeResourceNames.ru.clearQuartz, category: 'rare', status: 'live',
    lead: resourceLeads.ru.clearQuartz,
    relatedMechanics: ['mine', 'craft'], relatedResources: ['photonBit'] },

  { id: 'roseQuartz', slug: 'rose-quartz', name: homeResourceNames.ru.roseQuartz, category: 'rare', status: 'live',
    lead: resourceLeads.ru.roseQuartz,
    relatedMechanics: ['mine', 'craft'], relatedResources: ['nanoFluid'] },

  { id: 'amberQuartz', slug: 'amber-quartz', name: homeResourceNames.ru.amberQuartz, category: 'rare', status: 'live',
    lead: resourceLeads.ru.amberQuartz,
    relatedMechanics: ['mine'], relatedResources: [] },

  // ── Chips ──
  { id: 'quantumBit', slug: 'quantum-bit', name: homeResourceNames.ru.quantumBit, category: 'rare', status: 'live',
    lead: resourceLeads.ru.quantumBit,
    relatedMechanics: ['craft'], relatedResources: ['blueCore', 'cryoFluid'] },

  { id: 'neuralChip', slug: 'neural-chip', name: homeResourceNames.ru.neuralChip, category: 'rare', status: 'live',
    lead: resourceLeads.ru.neuralChip,
    relatedMechanics: ['craft'], relatedResources: ['redCore', 'voltFluid'] },

  { id: 'photonBit', slug: 'photon-bit', name: homeResourceNames.ru.photonBit, category: 'rare', status: 'live',
    lead: resourceLeads.ru.photonBit,
    relatedMechanics: ['craft'], relatedResources: ['clearQuartz'] },

  { id: 'bioChip', slug: 'bio-chip', name: homeResourceNames.ru.bioChip, category: 'rare', status: 'live',
    lead: resourceLeads.ru.bioChip,
    relatedMechanics: ['craft'], relatedResources: ['purpleCore', 'quantumFluid'] },

  // ── Fluids ──
  { id: 'cryoFluid', slug: 'cryo-fluid', name: homeResourceNames.ru.cryoFluid, category: 'consumable', status: 'live',
    lead: resourceLeads.ru.cryoFluid,
    relatedMechanics: ['craft'], relatedResources: ['quantumBit'] },

  { id: 'voltFluid', slug: 'volt-fluid', name: homeResourceNames.ru.voltFluid, category: 'consumable', status: 'live',
    lead: resourceLeads.ru.voltFluid,
    relatedMechanics: ['craft'], relatedResources: ['neuralChip'] },

  { id: 'bioFluid', slug: 'bio-fluid', name: homeResourceNames.ru.bioFluid, category: 'consumable', status: 'live',
    lead: resourceLeads.ru.bioFluid,
    relatedMechanics: ['craft'], relatedResources: ['circuit', 'neuron'] },

  { id: 'nanoFluid', slug: 'nano-fluid', name: homeResourceNames.ru.nanoFluid, category: 'consumable', status: 'live',
    lead: resourceLeads.ru.nanoFluid,
    relatedMechanics: ['craft'], relatedResources: ['roseQuartz'] },

  { id: 'quantumFluid', slug: 'quantum-fluid', name: homeResourceNames.ru.quantumFluid, category: 'consumable', status: 'live',
    lead: resourceLeads.ru.quantumFluid,
    relatedMechanics: ['craft'], relatedResources: ['purpleCore', 'bioChip'] },

  // ── Special ──
  { id: 'mind', slug: 'mind', name: homeResourceNames.ru.mind, category: 'collab', status: 'live',
    lead: resourceLeads.ru.mind,
    relatedMechanics: ['npc', 'craft'], relatedResources: ['soulCore'] },

  { id: 'soulCore', slug: 'soul-core', name: homeResourceNames.ru.soulCore, category: 'social', status: 'live',
    lead: resourceLeads.ru.soulCore,
    relatedMechanics: ['collectors'], relatedResources: ['mind'] },
];

export const resourcesBySlug = new Map(resources.map(r => [r.slug, r]));
export const resourcesById = new Map(resources.map(r => [r.id, r]));
// Kept for existing consumers; the rendered labels have one locale source.
export const categoryNames: Record<string, string> = resourceCatalogCopy.ru.labels;
