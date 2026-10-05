#!/usr/bin/env node
/**
 * [SECURITY_CHECKLIST #58] Legacy emission model, retained for offline math
 * tests only. Its former CLI used current SPL supply and emitted set_supply_cap
 * transactions, which is NOT a safe baseline for cumulative lifetime caps
 * because burns erase outstanding supply. The CLI is deliberately disabled.
 * Lifetime-cap setup uses the complete history scanner and the explicit
 * operator-selected caps documented in DEVNET_BRINGUP_PREFLIGHT.md.
 *
 * Model (display units per player per day, all constants read from
 * aof-core/src/constants.rs so the model cannot drift from the program):
 *   mining   DEFAULT_VILLAGERS x BASE_RATE_MINING x legendary yield x 24h,
 *            split over Circuit / Silicon / Neuron / Dataset
 *   Power    24h x expected well rate (weather odds 10/50/30/10 %, pinned by
 *            the Rust test weather_distribution_matches_the_documented_odds)
 *   Synapse  Neuron x SYNAPSE_YIELD_MULT; Signal/Model <= their input
 *   season   Circuit += SEASON_REWARD_UNITS_PER_LEVEL x (1+..+max level) x 2
 *            tracks per player per season (claim_season_reward)
 *   other    --other-daily for crafted / operator-issued kinds
 * cap = gross lifetime baseline + daily x DAU x days x safety (in atomic units).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export const KIND_NAMES = [
  "Data", "Circuit", "Silicon", "Neuron", "Synapse", "Signal", "Model", "Power", "Compute", "Dataset",
  "BlueCore", "PurpleCore", "RedCore", "ClearQuartz", "RoseQuartz", "AmberQuartz", "QuantumBit", "NeuralChip",
  "PhotonBit", "BioChip", "CryoFluid", "VoltFluid", "BioFluid", "NanoFluid", "QuantumFluid", "SoulCore", "Mind",
];
const U64_MAX = 0xffffffffffffffffn;

function product(expr, unit) {
  return expr.split("*").map((t) => t.trim()).reduce((acc, t) => acc * (t === "RESOURCE_UNIT" ? unit : Number(t.replace(/_/g, ""))), 1);
}

/** Economy constants straight from the Rust source. */
export function readConstants(src = readFileSync(path.join(root, "aof-core/src/constants.rs"), "utf8")) {
  const raw = (name) => {
    const m = new RegExp(`pub const ${name}: [a-z0-9]+ = ([^;]+);`).exec(src);
    if (!m) throw new Error(`constant ${name} not found in constants.rs`);
    return m[1];
  };
  const unit = Number(raw("RESOURCE_UNIT").replace(/_/g, ""));
  const units = (name) => product(raw(name), unit) / unit;
  return {
    unit,
    baseRate: product(raw("BASE_RATE_MINING"), unit),
    yieldLegendaryBps: product(raw("YIELD_BPS_LEGENDARY"), unit),
    villagers: product(raw("DEFAULT_VILLAGERS"), unit),
    well: ["GRID_RATE_BLACKOUT", "GRID_RATE_NOMINAL", "GRID_RATE_SURGE", "GRID_RATE_FRENZY"].map(units),
    synapseMultBps: product(raw("SYNAPSE_YIELD_MULT_BPS"), unit),
    rewardPerLevel: product(raw("SEASON_REWARD_UNITS_PER_LEVEL"), unit),
    maxLevel: product(raw("SEASON_PASS_MAX_LEVEL"), unit),
    seasonDays: product(raw("SEASON_LENGTH_SECONDS"), unit) / 86_400,
  };
}

export function dailyPerPlayer(c, otherDaily) {
  const d = new Array(KIND_NAMES.length).fill(otherDaily);
  // Integer arithmetic first, one division last: exact for the shipped constants.
  const mining = (c.villagers * c.baseRate * c.yieldLegendaryBps * 24) / 10_000;
  for (const k of [1, 2, 3, 9]) d[k] = mining / 4;
  d[7] = ((10 * c.well[0] + 50 * c.well[1] + 30 * c.well[2] + 10 * c.well[3]) * 24) / 100;
  d[4] = (d[3] * c.synapseMultBps) / 10_000;
  d[5] = d[4];
  d[6] = d[5];
  return d;
}

/** Circuit a player can claim in one season: every level on both tracks. */
export function seasonRewardPerPlayer(c) {
  return c.rewardPerLevel * ((c.maxLevel * (c.maxLevel + 1)) / 2) * 2;
}

export function proposeCaps({ c, dau, days, safety, otherDaily, baseline = [] }) {
  if (!(dau > 0 && days > 0 && safety >= 1 && otherDaily >= 0)) throw new Error("invalid model parameters");
  const daily = dailyPerPlayer(c, otherDaily);
  const seasons = Math.ceil(days / c.seasonDays);
  return daily.map((perDay, kind) => {
    let units = perDay * dau * days;
    if (kind === 1) units += seasonRewardPerPlayer(c) * dau * seasons;
    const capUnits = Math.ceil(units * safety);
    const capAtomic = BigInt(baseline[kind] ?? 0n) + BigInt(capUnits) * BigInt(c.unit);
    if (capAtomic > U64_MAX) throw new Error(`${KIND_NAMES[kind]}: cap exceeds u64`);
    return { kind, name: KIND_NAMES[kind], dailyPerPlayer: perDay, capUnits, capAtomic };
  });
}

/** `set_supply_cap(kind, max_supply)` instruction data from the committed IDL. */
export function encodeSetSupplyCap(kind, capAtomic, idl = JSON.parse(readFileSync(path.join(root, "aof_backend/src/idl/aof_core.json"), "utf8"))) {
  const ix = idl.instructions.find((i) => i.name === "set_supply_cap");
  const data = Buffer.alloc(17);
  Buffer.from(ix.discriminator).copy(data, 0);
  data[8] = kind;
  data.writeBigUInt64LE(BigInt(capAtomic), 9);
  return { data, accounts: ix.accounts.map((a) => ({ name: a.name, signer: !!a.signer, writable: !!a.writable })), programId: idl.address };
}

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export function base58(bytes) {
  let n = BigInt("0x" + (Buffer.from(bytes).toString("hex") || "0"));
  let out = "";
  while (n > 0n) {
    out = ALPHABET[Number(n % 58n)] + out;
    n /= 58n;
  }
  for (const b of bytes) {
    if (b !== 0) break;
    out = "1" + out;
  }
  return out;
}

// The old CLI read current Mint.supply and could not prove lifetime issuance.
// Keep the pure model above for offline sizing tests, but never emit a cap plan.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.error(
    "Disabled: current SPL supply is not cumulative lifetime issuance after burns. " +
    "Use npm run issuance:history:scan, npm run issuance:baseline:apply, then " +
    "npm run issuance:lifetime-caps:apply with operator-selected LIFETIME_CAP_* values.",
  );
  process.exitCode = 2;
}
