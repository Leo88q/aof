/**
 * Pure derivation: chain/API snapshot → organism view state.
 *
 * No rendering, no network, no clock access except the `nowSec` argument, so
 * it can be tested directly. Unknown input stays `null`; it is never shown as zero.
 */
import { ORGANS, RARITY_ORDER, TOOL_DOCKS, type Rarity } from './registry';
import { resourceKey } from '../lib/economyBalances';

export type CellState = 'empty' | 'growing' | 'ready' | 'unknown';

export interface OrganismInput {
  /** UPPER_SNAKE balances from /query/balances, or null if unavailable. */
  balances: Record<string, number> | null;
  /** Raw lab tiles from /query/lab-tiles (array), or null if unavailable. */
  tiles: unknown[] | null;
  /** Raw tool accounts from /query/my-tools (array), or null if unavailable. */
  tools: unknown[] | null;
  /** Energy snapshot, or null if unavailable. */
  energy: { amount?: unknown; cap?: unknown } | null;
  /** Completed laboratory seals from /query/laboratory-finale, or null if unavailable. */
  seals?: unknown;
}

export interface CellView {
  index: number;
  state: CellState;
  /** 0..1 for growing cells, 1 for ready, 0 otherwise. */
  progress: number;
}

export interface DockView {
  toolType: string;
  resource: string;
  /** Tools of this kind owned by the wallet; null when the tool list is unknown. */
  owned: number | null;
  /** Tools of this kind currently mining. */
  working: number;
  /** Highest rarity among owned tools of this kind. */
  bestRarity: Rarity | null;
  /** Lowest readable durability among owned tools of this kind (0..20), null when unknown. */
  minDurability: number | null;
}

/** ToolData.durability range on-chain (0..20). */
export const DURABILITY_MAX = 20;

/** One full seal set, burned 1 each by the laboratory seal (see the design doc). */
export const SOUL_ASSEMBLY: readonly string[] = [
  'model',
  'cryoFluid',
  'voltFluid',
  'bioFluid',
  'nanoFluid',
  'quantumFluid',
  'amberQuartz',
];

export interface SoulAssemblyItem {
  id: string;
  /** null when the balance is unknown. */
  amount: number | null;
  /** True only when the balance is known to cover the burned amount of 1. */
  ready: boolean;
}

export interface ResourceView {
  id: string;
  /** null when the balance is unknown. */
  amount: number | null;
  /** 0..1 intensity on a log scale, shared across all resources. */
  intensity: number;
}

export interface OrganView {
  id: string;
  resources: ResourceView[];
}

export interface OrganismState {
  heart: { known: boolean; amount: number | null; cap: number | null; share: number | null };
  cells: CellView[];
  docks: DockView[];
  organs: OrganView[];
  /** The terminal resource (future access, not a reward in phase 1). */
  soulCore: {
    known: boolean;
    amount: number | null;
    /** Progress toward one full seal set, derived from the same balances. */
    assembly: SoulAssemblyItem[];
    assemblyReady: number;
    assemblyTotal: number;
    /** Completed seals when the finale account was readable, else null. */
    seals: number | null;
  };
}

export const CELL_COUNT = 10;

/** Accepts number, numeric string, or BN-like {toString()} from the API. */
export function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  if (value && typeof value === 'object' && typeof (value as { toString?: unknown }).toString === 'function') {
    const n = Number(String((value as { toString: () => string }).toString()));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Rarity arrives as an enum index, a lowercase name, or an Anchor enum object. */
export function normalizeRarity(value: unknown): Rarity | null {
  if (typeof value === 'number') return RARITY_ORDER[value] ?? null;
  if (typeof value === 'string') {
    const name = value.toLowerCase();
    return (RARITY_ORDER as readonly string[]).includes(name) ? (name as Rarity) : null;
  }
  if (value && typeof value === 'object') {
    const name = Object.keys(value as object).find((k) => (RARITY_ORDER as readonly string[]).includes(k.toLowerCase()));
    return name ? (name.toLowerCase() as Rarity) : null;
  }
  return null;
}

function normalizeToolType(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value.toLowerCase() : null;
}

function isMiningNow(tool: Record<string, unknown>, nowSec: number): boolean {
  const flag = tool.isMining ?? tool.is_mining;
  if (flag !== true) return false;
  const end = toNumber(tool.miningEnd ?? tool.mining_end);
  return end === null || end > nowSec;
}

/**
 * Readiness is decided by the chain (`ready` from the API). Between polls the
 * growth bar is interpolated from startedAt/readyAt on chain time, but it never
 * reaches 1 locally: a cell only becomes "ready" when a fresh snapshot says so.
 */
function cellFromTile(index: number, raw: unknown, nowSec: number): CellView {
  if (!raw || typeof raw !== 'object') return { index, state: 'unknown', progress: 0 };
  const tile = raw as Record<string, unknown>;
  const active = tile.active === true || toNumber(tile.state) === 1 || toNumber(tile.state) === 2;
  const ready = tile.ready === true;
  if (ready) return { index, state: 'ready', progress: 1 };
  if (!active) return { index, state: 'empty', progress: 0 };
  const startedAt = toNumber(tile.startedAt);
  const readyAt = toNumber(tile.readyAt);
  let progress: number;
  if (startedAt !== null && readyAt !== null && readyAt > startedAt && startedAt > 0) {
    progress = (nowSec - startedAt) / (readyAt - startedAt);
  } else {
    const apiProgress = toNumber(tile.progress);
    progress = apiProgress === null ? 0 : apiProgress / 100;
  }
  return { index, state: 'growing', progress: Math.min(0.99, Math.max(0, progress)) };
}

export function deriveOrganism(input: OrganismInput, nowSec: number): OrganismState {
  // Heart: personal energy pulse.
  const amount = toNumber(input.energy?.amount);
  const cap = toNumber(input.energy?.cap);
  const heart = {
    known: amount !== null,
    amount,
    cap: cap !== null && cap > 0 ? cap : null,
    share: amount !== null && cap !== null && cap > 0 ? Math.min(1, Math.max(0, amount / cap)) : null,
  };

  // Body: the canonical ten lab cells.
  const rawTiles = input.tiles;
  const cells: CellView[] = [];
  for (let i = 0; i < CELL_COUNT; i += 1) {
    if (!rawTiles) {
      cells.push({ index: i, state: 'unknown', progress: 0 });
      continue;
    }
    const raw = rawTiles.find((t) => t && typeof t === 'object' && (t as { index?: unknown }).index === i);
    cells.push(cellFromTile(i, raw, nowSec));
  }

  // Limbs: tools grouped by kind.
  const tools = input.tools;
  const docks: DockView[] = TOOL_DOCKS.map((dock) => {
    if (!tools) return { toolType: dock.toolType, resource: dock.resource, owned: null, working: 0, bestRarity: null, minDurability: null };
    let owned = 0;
    let working = 0;
    let best: Rarity | null = null;
    let minDurability: number | null = null;
    for (const raw of tools) {
      if (!raw || typeof raw !== 'object') continue;
      const tool = raw as Record<string, unknown>;
      if (normalizeToolType(tool.toolType ?? tool.tool_type) !== dock.toolType) continue;
      owned += 1;
      if (isMiningNow(tool, nowSec)) working += 1;
      const rarity = normalizeRarity(tool.rarity);
      if (rarity && (best === null || RARITY_ORDER.indexOf(rarity) > RARITY_ORDER.indexOf(best))) best = rarity;
      // Durability is a u8 on-chain; only the canonical 0..20 range is shown.
      const durability = toNumber(tool.durability);
      if (durability !== null && durability >= 0 && durability <= DURABILITY_MAX) {
        minDurability = minDurability === null ? durability : Math.min(minDurability, durability);
      }
    }
    return { toolType: dock.toolType, resource: dock.resource, owned, working, bestRarity: best, minDurability };
  });

  // Organs: intensity is log-scaled against the largest known balance.
  const balances = input.balances;
  const amountOf = (id: string): number | null => {
    if (!balances) return null;
    const v = balances[resourceKey(id)];
    return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
  };
  let maxAmount = 0;
  for (const organ of ORGANS) {
    for (const id of organ.resources) maxAmount = Math.max(maxAmount, amountOf(id) ?? 0);
  }
  const intensityOf = (amt: number | null): number => {
    if (amt === null || amt <= 0 || maxAmount <= 0) return 0;
    return Math.log10(1 + amt) / Math.log10(1 + maxAmount);
  };
  const organs: OrganView[] = ORGANS.map((organ) => ({
    id: organ.id,
    resources: organ.resources.map((id) => {
      const amt = amountOf(id);
      return { id, amount: amt, intensity: intensityOf(amt) };
    }),
  }));

  const soulAmount = amountOf('soulCore');
  const assembly: SoulAssemblyItem[] = SOUL_ASSEMBLY.map((id) => {
    const amt = amountOf(id);
    return { id, amount: amt, ready: amt !== null && amt >= 1 };
  });
  const sealsRaw = toNumber(input.seals);
  const seals = sealsRaw !== null && sealsRaw >= 0 ? Math.floor(sealsRaw) : null;
  return {
    heart,
    cells,
    docks,
    organs,
    soulCore: {
      known: soulAmount !== null,
      amount: soulAmount,
      assembly,
      assemblyReady: assembly.filter((a) => a.ready).length,
      assemblyTotal: assembly.length,
      seals,
    },
  };
}
