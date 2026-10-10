import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { connection, program } from "../provider";
import { configPda, craftEconomyPda, energyAccountPda, gastankPda, materialMintsPda, rarityCounterPda } from "./pda";
import { buildCanonicalResourceMints, type ResourceMintKey } from "./resourceRegistryCore";
import {
  ENERGY_CAP,
  RESOURCE_UNIT,
  asUint,
  compareTokenBalances,
  formatMicros,
  linearCost,
  regeneratedEnergy,
  type Shortage,
} from "./resourceShortageCore";

export type StartNeed =
  | { kind: "token"; resource: string; mint: PublicKey; need: bigint }
  | { kind: "energy"; need: number }
  | { kind: "gas"; need: bigint };

export type StartGate =
  | { kind: "ok" }
  | { kind: "unread" }
  | { kind: "short"; body: { error: "INSUFFICIENT_RESOURCES"; missing: Shortage[] } };

async function tokenRaw(mint: PublicKey, owner: PublicKey): Promise<bigint | undefined> {
  try {
    const ata = getAssociatedTokenAddressSync(mint, owner, true);
    const info = await connection.getAccountInfo(ata, "confirmed");
    if (!info) return 0n;
    if (!info.owner.equals(TOKEN_PROGRAM_ID) || info.data.length < 72) return undefined;
    return info.data.readBigUInt64LE(64);
  } catch {
    return undefined;
  }
}

async function energyCurrent(owner: PublicKey): Promise<number | undefined> {
  try {
    const account: any = await (program.account as any).energyAccount.fetchNullable(energyAccountPda(owner)[0]);
    if (!account) return ENERGY_CAP;
    const ownerKey = account.owner instanceof PublicKey ? account.owner : new PublicKey(account.owner);
    if (ownerKey.equals(PublicKey.default)) return ENERGY_CAP;
    const current = Number(account.current);
    const cap = Number(account.cap);
    const lastRegenAt = Number(account.lastRegenAt?.toString?.() ?? account.lastRegenAt ?? 0);
    const now = Math.floor(Date.now() / 1000);
    const available = regeneratedEnergy(current, cap, lastRegenAt, now);
    return available === null ? undefined : available;
  } catch {
    return undefined;
  }
}

async function gasMicros(owner: PublicKey): Promise<bigint | undefined> {
  try {
    const tank: any = await (program.account as any).gasTank.fetchNullable(gastankPda(owner)[0]);
    if (!tank) return 0n;
    return asUint(tank.balanceMicros ?? tank.balance_micros) ?? undefined;
  } catch {
    return undefined;
  }
}

/** Confirmed shortages only. An unreadable balance does not become zero. */
export async function resourceStartGate(owner: PublicKey, needs: StartNeed[]): Promise<StartGate> {
  const tokenNeeds: { resource: string; need: bigint }[] = [];
  const haveRaw: Record<string, bigint> = {};
  const missing: Shortage[] = [];

  for (const need of needs) {
    if (need.kind === "token") {
      if (need.need < 0n) return { kind: "unread" };
      if (need.need === 0n) continue;
      const have = await tokenRaw(need.mint, owner);
      if (have === undefined) return { kind: "unread" };
      haveRaw[need.resource] = have;
      tokenNeeds.push({ resource: need.resource, need: need.need });
      continue;
    }
    if (need.kind === "energy") {
      if (!Number.isInteger(need.need) || need.need < 0) return { kind: "unread" };
      if (need.need === 0) continue;
      const have = await energyCurrent(owner);
      if (have === undefined) return { kind: "unread" };
      if (have < need.need) missing.push({ resource: "ENERGY", have: String(have), need: String(need.need) });
      continue;
    }
    if (need.need < 0n) return { kind: "unread" };
    if (need.need === 0n) continue;
    const have = await gasMicros(owner);
    if (have === undefined) return { kind: "unread" };
    if (have < need.need) {
      const haveText = formatMicros(have);
      const needText = formatMicros(need.need);
      if (!haveText || !needText) return { kind: "unread" };
      missing.push({ resource: "GAS", have: haveText, need: needText });
    }
  }

  const tokens = compareTokenBalances(haveRaw, tokenNeeds);
  if (!tokens) return { kind: "unread" };
  missing.push(...tokens);
  if (missing.length === 0) return { kind: "ok" };
  return { kind: "short", body: { error: "INSUFFICIENT_RESOURCES", missing } };
}

async function canonicalMints(): Promise<Partial<Record<ResourceMintKey, PublicKey>> | null | undefined> {
  try {
    const cfg = await (program.account as any).config.fetch(configPda()[0]);
    const mm = await (program.account as any).materialMints.fetch(materialMintsPda()[0]);
    const shape = buildCanonicalResourceMints(cfg, mm);
    return shape.mints ?? null;
  } catch {
    return undefined;
  }
}

/** `raw` amounts are atomic token units. Zero is skipped; a missing mint is unread. */
export async function atomicTokenNeeds(owner: PublicKey, raw: ReadonlyArray<readonly [ResourceMintKey, bigint]>, energy?: number, gas?: bigint): Promise<StartGate> {
  const mints = await canonicalMints();
  if (!mints) return { kind: "unread" };
  const needs: StartNeed[] = [];
  for (const [key, amount] of raw) {
    if (amount === 0n) continue;
    if (amount < 0n) return { kind: "unread" };
    const mint = mints[key];
    if (!mint) return { kind: "unread" };
    needs.push({ kind: "token", resource: key, mint, need: amount });
  }
  if (energy) needs.push({ kind: "energy", need: energy });
  if (gas && gas > 0n) needs.push({ kind: "gas", need: gas });
  return resourceStartGate(owner, needs);
}

/** `units` are whole resource units, matching the instruction tables. */
export async function tokenNeeds(owner: PublicKey, units: ReadonlyArray<readonly [ResourceMintKey, bigint]>, energy?: number, gas?: bigint): Promise<StartGate> {
  return atomicTokenNeeds(owner, units.map(([key, amount]) => [key, amount * RESOURCE_UNIT]), energy, gas);
}

function arrayAt(value: unknown, index: number): bigint | null {
  return Array.isArray(value) ? asUint(value[index]) : null;
}

/** Same linear bundle craft.rs and reroll.rs charge. Null means the chain
 * read was incomplete, not that the bundle is free. */
export async function craftBundleUnits(rarityIndex: number): Promise<Array<readonly [ResourceMintKey, bigint]> | null> {
  if (!Number.isInteger(rarityIndex) || rarityIndex < 0 || rarityIndex > 3) return null;
  try {
    const econ: any = await (program.account as any).craftEconomy.fetch(craftEconomyPda()[0]);
    const counter: any = await (program.account as any).rarityCounter.fetch(rarityCounterPda(rarityIndex + 1)[0]);
    const minted = asUint(counter?.mintedCount ?? counter?.minted_count);
    if (minted === null) return null;
    const pairs: Array<readonly [ResourceMintKey, unknown, unknown]> = [
      ["CIRCUIT", econ.circuitBase, econ.circuitMult],
      ["SILICON", econ.siliconBase, econ.siliconMult],
      ["DATA", econ.dataBase, econ.dataMult],
      ["NEURON", econ.neuronBase, econ.neuronMult],
      ["POWER", econ.powerBase, econ.powerMult],
      ["MIND", econ.mindBase, econ.mindMult],
    ];
    const units: Array<readonly [ResourceMintKey, bigint]> = [];
    for (const [key, base, mult] of pairs) {
      const cost = linearCost(arrayAt(base, rarityIndex) ?? -1n, arrayAt(mult, rarityIndex) ?? -1n, minted);
      if (cost === null) return null;
      if (cost % RESOURCE_UNIT !== 0n) return null;
      units.push([key, cost / RESOURCE_UNIT]);
    }
    return units;
  } catch {
    return null;
  }
}

export async function craftFeeMicros(): Promise<bigint | undefined> {
  try {
    const cfg: any = await (program.account as any).config.fetch(configPda()[0]);
    return asUint(cfg.craftFee ?? cfg.craft_fee) ?? undefined;
  } catch {
    return undefined;
  }
}


