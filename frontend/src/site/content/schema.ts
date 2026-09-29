export type ResourceCategory = 'base' | 'chain' | 'material' | 'rare' | 'consumable' | 'token' | 'collab' | 'social';
export type Status = 'live' | 'soon';
export interface Resource {
  id: string; slug: string; name: string; category: ResourceCategory; status: Status;
  lead: string; relatedMechanics: string[]; relatedResources: string[];
}
export interface SitePage { id: string; title: string; group: string; lead: string; paragraphs: string[]; }
