export type ResourceCategory = 'base' | 'chain' | 'material' | 'rare' | 'consumable' | 'token' | 'collab' | 'social';
export type Status = 'live' | 'soon';
export interface Resource {
  id: string; slug: string; name: string; category: ResourceCategory; status: Status;
  lead: string; description: string[]; sources: string[]; sinks: string[];
  relatedMechanics: string[]; relatedResources: string[];
  narrative?: string;
}
export interface Mechanic {
  id: string; name: string; status: Status; lead: string;
  steps: { title: string; instruction?: string; text: string }[];
  relatedResources: string[];
  narrative?: string;
}
export interface SitePage { id: string; title: string; group: string; lead: string; paragraphs: string[]; }

export interface Recipe {
  id: string;
  name: string;
  station: 'workbench' | 'forge' | 'mill' | 'oven' | 'glassworks' | 'alchemist';
  inputs: { resourceId: string; amount: number }[];
  outputs: { resourceId: string; amount: number }[];
  energy: number;
  toolRequired?: string;
  time?: string;
  description: string;
  narrative?: string;
  skrDiscount?: boolean;
  potatoCost?: number;
}

export interface PotatoUse {
  id: string;
  title: string;
  category: 'craft' | 'boost' | 'cosmetic' | 'access' | 'ritual';
  cost: number;
  description: string;
  narrative: string;
}

export interface LoreFragment {
  id: string;
  character: string;
  quote: string;
  context: string;
}
