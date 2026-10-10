/**
 * [F-06] Switchboard On-Demand settlement — backend side.
 *
 * The on-chain programs own their randomness accounts (authority = program
 * PDA "vrf_authority"), so this module never signs anything for Switchboard.
 * It only:
 *   - picks a free pool slot and a live oracle for a commit transaction;
 *   - fetches the oracle's signed reveal from the Switchboard gateway (without
 *     forwarding this backend's RPC URL) and turns it into the accounts +
 *     params of a program reveal instruction;
 *   - reports pool health (the commit routes refuse new commits while any
 *     commit is stuck — the circuit breaker of docs/VRF_SWITCHBOARD.md).
 *
 * Anyone can settle a commit with the same data, so the backend being slow or
 * down never blocks a player: the player can fetch the reveal and settle.
 */
import {
  ComputeBudgetProgram,
  Connection,
  PublicKey,
  SYSVAR_SLOT_HASHES_PUBKEY,
  TransactionInstruction,
} from "@solana/web3.js";
import { getAssociatedTokenAddressSync, NATIVE_MINT } from "@solana/spl-token";
import { RPC_URL } from "../config";

export type SwitchboardCluster = "mainnet" | "devnet";

/** Mirrors aof-core/src/vrf.rs (pinned by tests/readiness/vrf.test.cjs). */
export const SWITCHBOARD: Record<SwitchboardCluster, { programId: PublicKey; queue: PublicKey; state: PublicKey }> = {
  mainnet: {
    programId: new PublicKey("SBondMDrcV3K4kxZR1HNVT7osZxAHVHgYXL5Ze1oMUv"),
    queue: new PublicKey("A43DyUGA7s8eXPxqEjJY6EBu1KKbNgfxF8h17VAHn13w"),
    state: new PublicKey("7Gs9n5FQMeC9XcEhg281bRZ6VHRrCvqp5Yq1j78HkvNa"),
  },
  devnet: {
    programId: new PublicKey("Aio4gaXjXzJNVLtzwtNVmSqGKpANtXhybbkhtAC94ji2"),
    queue: new PublicKey("EYiAmGSdsQTuCw413V5BzaruWuCCSDgTPtBGvLkXHbe7"),
    state: new PublicKey("4UFmCebEmzESoDTtHrmaftXj7YAsAH4HMios3yMWyVUT"),
  },
};
export const ADDRESS_LOOKUP_TABLE_PROGRAM_ID = new PublicKey("AddressLookupTab1e1111111111111111111111111");

/** aof-core/src/constants.rs::VRF_REFUND_AFTER_SLOTS (reveal window / refund threshold). */
export const VRF_REFUND_AFTER_SLOTS = 432;
/** aof-core/src/vrf.rs. The refund boundary is delay + reveal slots. */
export const SLOT_HASH_DELAY = 32;
export const SLOT_HASH_REVEAL_SLOTS = 400;

export type RandomnessMode = "slot-hash" | "switchboard";

/**
 * `slot-hash` matches the upgraded program: commit does not ask an oracle.
 * The default stays `switchboard` so a restart before that upgrade still
 * refuses the commit instead of sending a transaction the old program rejects.
 */
export function randomnessMode(env: NodeJS.ProcessEnv = process.env): RandomnessMode {
  const raw = (env.AOF_RANDOMNESS || "").trim().toLowerCase();
  if (raw === "slot-hash" || raw === "slothash") return "slot-hash";
  if (raw === "" || raw === "switchboard") return "switchboard";
  throw new Error("AOF_RANDOMNESS must be slot-hash or switchboard");
}

/**
 * Must match the program build: `--features devnet` programs trust the devnet
 * Switchboard, default builds trust mainnet. SWITCHBOARD_CLUSTER is explicit
 * in production; otherwise it follows the RPC URL.
 */
export function switchboardCluster(env: NodeJS.ProcessEnv = process.env, rpcUrl = RPC_URL): SwitchboardCluster {
  const explicit = (env.SWITCHBOARD_CLUSTER || "").trim().toLowerCase();
  if (explicit === "mainnet" || explicit === "devnet") return explicit;
  if (explicit) throw new Error("SWITCHBOARD_CLUSTER must be mainnet or devnet");
  return /devnet|localhost|127\.0\.0\.1/i.test(rpcUrl) ? "devnet" : "mainnet";
}

export function switchboard(env: NodeJS.ProcessEnv = process.env) {
  return SWITCHBOARD[switchboardCluster(env)];
}

// ---------------------------------------------------------------- addresses

const enc = (s: string) => Buffer.from(s, "utf8");

export function vrfAuthorityPda(programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([enc("vrf_authority")], programId)[0];
}

export function vrfRandomnessPda(programId: PublicKey, index: number): PublicKey {
  const le = Buffer.alloc(4);
  le.writeUInt32LE(index, 0);
  return PublicKey.findProgramAddressSync([enc("vrf_randomness"), le], programId)[0];
}

export function vrfSlotPda(programId: PublicKey, randomness: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([enc("vrf_slot"), randomness.toBuffer()], programId)[0];
}

export function statsPda(oracle: PublicKey, env: NodeJS.ProcessEnv = process.env): PublicKey {
  return PublicKey.findProgramAddressSync([enc("OracleRandomnessStats"), oracle.toBuffer()], switchboard(env).programId)[0];
}

export function rewardEscrowAddress(randomness: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(NATIVE_MINT, randomness, true);
}

export function lutSignerPda(randomness: PublicKey, env: NodeJS.ProcessEnv = process.env): PublicKey {
  return PublicKey.findProgramAddressSync([enc("LutSigner"), randomness.toBuffer()], switchboard(env).programId)[0];
}

export function lutAddress(lutSigner: PublicKey, recentSlot: number | bigint): PublicKey {
  const le = Buffer.alloc(8);
  le.writeBigUInt64LE(BigInt(recentSlot), 0);
  return PublicKey.findProgramAddressSync([lutSigner.toBuffer(), le], ADDRESS_LOOKUP_TABLE_PROGRAM_ID)[0];
}

/** Wallet guard ceiling for the priority fee (frontend/src/lib/txGuard.ts). */
export const VRF_MAX_PRIORITY_MICROLAMPORTS = 100_000;

/**
 * Compute budget for VRF instructions (Switchboard reveal + NFT settlement):
 * a CU limit (VRF_COMPUTE_UNITS, default 400k) and a small priority fee
 * (VRF_PRIORITY_MICROLAMPORTS per CU, default 5000 ≈ 0.000002 SOL at 400k CU)
 * so reveals keep landing under congestion. The fee is clamped to what the
 * wallet guard accepts, otherwise player self-settle transactions would be
 * refused by the client.
 */
export function vrfComputeBudget(env: NodeJS.ProcessEnv = process.env): TransactionInstruction[] {
  const units = Math.min(Math.max(Number(env.VRF_COMPUTE_UNITS) || 400_000, 1), 1_400_000);
  const configured = env.VRF_PRIORITY_MICROLAMPORTS === undefined || env.VRF_PRIORITY_MICROLAMPORTS === ""
    ? 5_000
    : Number(env.VRF_PRIORITY_MICROLAMPORTS);
  const price = Number.isFinite(configured) && configured > 0
    ? Math.min(Math.floor(configured), VRF_MAX_PRIORITY_MICROLAMPORTS)
    : 0;
  const ixs = [ComputeBudgetProgram.setComputeUnitLimit({ units })];
  if (price > 0) ixs.push(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: price }));
  return ixs;
}

// ---------------------------------------------------------------- randomness account

/** RandomnessAccountData prefix (see aof-core/src/vrf.rs offsets). */
export type RandomnessData = {
  authority: PublicKey;
  queue: PublicKey;
  seedSlothash: Buffer;
  seedSlot: bigint;
  oracle: PublicKey;
  revealSlot: bigint;
  value: Buffer;
};

const RANDOMNESS_DISCRIMINATOR = Buffer.from([10, 66, 229, 135, 220, 239, 217, 114]);

export function parseRandomness(data: Buffer): RandomnessData {
  if (data.length < 408 || !data.subarray(0, 8).equals(RANDOMNESS_DISCRIMINATOR)) {
    throw new Error("Not a Switchboard randomness account");
  }
  return {
    authority: new PublicKey(data.subarray(8, 40)),
    queue: new PublicKey(data.subarray(40, 72)),
    seedSlothash: Buffer.from(data.subarray(72, 104)),
    seedSlot: data.readBigUInt64LE(104),
    oracle: new PublicKey(data.subarray(112, 144)),
    revealSlot: data.readBigUInt64LE(144),
    value: Buffer.from(data.subarray(152, 184)),
  };
}

// ---------------------------------------------------------------- pool

export type PoolSlot = {
  vrfSlot: PublicKey;
  randomness: PublicKey;
  index: number;
  lock: PublicKey;
  lockedAtSlot: number;
  retired: boolean;
};

export type PoolHealth = {
  total: number;
  free: number;
  locked: number;
  retired: number;
  oldestLockAgeSlots: number;
  healthy: boolean;
  reason?: string;
};

/** A commit older than this means the settler (or the oracle) is not keeping up. */
export function maxPendingSlots(env: NodeJS.ProcessEnv = process.env): number {
  const v = Number(env.VRF_MAX_PENDING_SLOTS);
  return Number.isFinite(v) && v > 0 ? v : 450; // ~3 minutes
}

/** Pure: the circuit-breaker decision over the pool (unit-tested). */
export function evaluatePool(slots: PoolSlot[], currentSlot: number, env: NodeJS.ProcessEnv = process.env): PoolHealth {
  const active = slots.filter((s) => !s.retired);
  const locked = active.filter((s) => !s.lock.equals(PublicKey.default));
  const oldest = locked.reduce((max, s) => Math.max(max, currentSlot - s.lockedAtSlot), 0);
  const health: PoolHealth = {
    total: slots.length,
    free: active.length - locked.length,
    locked: locked.length,
    retired: slots.length - active.length,
    oldestLockAgeSlots: oldest,
    healthy: true,
  };
  if (active.length === 0) {
    health.healthy = false;
    health.reason = "VRF_POOL_EMPTY";
  } else if (oldest > maxPendingSlots(env)) {
    health.healthy = false;
    health.reason = "VRF_SETTLEMENT_DEGRADED";
  } else if (health.free === 0) {
    health.healthy = false;
    health.reason = "VRF_POOL_EXHAUSTED";
  }
  return health;
}

export async function listPoolSlots(program: any): Promise<PoolSlot[]> {
  const rows: Array<{ publicKey: PublicKey; account: any }> = await program.account.vrfSlot.all();
  return rows.map(({ publicKey, account }) => ({
    vrfSlot: publicKey,
    randomness: account.randomness,
    index: Number(account.index),
    lock: account.lock,
    lockedAtSlot: Number(account.lockedAtSlot),
    retired: Boolean(account.retired),
  }));
}

const reservations = new Map<string, number>();
const RESERVATION_MS = 45_000;

export type PoolShard = { index: number; count: number };

/**
 * VRF_POOL_SHARD="i/n" for n backend replicas: replica i prefers the pool
 * slots with index % n == i. Reservations are per process, so without it two
 * replicas can hand the same free slot to two players and one signed commit
 * fails with VrfSlotBusy. A replica whose share is busy falls back to any
 * free slot (rare with a pool sized for the peak).
 */
export function poolShard(env: NodeJS.ProcessEnv = process.env): PoolShard | null {
  const raw = (env.VRF_POOL_SHARD || "").trim();
  if (!raw) return null;
  const m = /^(\d+)\/(\d+)$/.exec(raw);
  if (!m) throw new Error(`VRF_POOL_SHARD must look like "i/n" (e.g. 0/2), got "${raw}"`);
  const shard = { index: Number(m[1]), count: Number(m[2]) };
  if (shard.count < 1 || shard.index >= shard.count) throw new Error(`VRF_POOL_SHARD "${raw}": need 0 <= i < n`);
  return shard;
}

/** Pure: a random free, unreserved slot, preferring this replica's shard. */
export function pickPoolSlot(
  slots: PoolSlot[],
  reserved: ReadonlySet<string>,
  shard: PoolShard | null,
  random: () => number = Math.random,
): PoolSlot | null {
  const free = slots.filter((s) => !s.retired && s.lock.equals(PublicKey.default) && !reserved.has(s.vrfSlot.toBase58()));
  if (!free.length) return null;
  const mine = shard ? free.filter((s) => s.index % shard.count === shard.index) : free;
  const candidates = mine.length ? mine : free;
  return candidates[Math.floor(random() * candidates.length)];
}

/**
 * Pick a free, unreserved pool slot at random (a lost race only fails that one
 * transaction with VrfSlotBusy). Throws a 503-style error when the pool is
 * unhealthy: new paid commits must not pile up behind a stuck settlement.
 */
export async function reservePoolSlot(program: any, connection: Connection): Promise<PoolSlot> {
  const shard = poolShard(); // a bad value fails the request loudly, before any RPC
  const [slots, currentSlot] = await Promise.all([listPoolSlots(program), connection.getSlot("confirmed")]);
  const health = evaluatePool(slots, currentSlot);
  if (!health.healthy && health.reason !== "VRF_POOL_EXHAUSTED") throw vrfUnavailable(health.reason!);
  const now = Date.now();
  for (const [key, until] of reservations) if (until < now) reservations.delete(key);
  const pick = pickPoolSlot(slots, new Set(reservations.keys()), shard);
  if (!pick) throw vrfUnavailable("VRF_POOL_EXHAUSTED");
  reservations.set(pick.vrfSlot.toBase58(), now + RESERVATION_MS);
  return pick;
}

/** Drop a reservation when the commit was not handed to a wallet. A failed
 * oracle read must not make the next click look like a full pool. */
export function releasePoolSlot(slot: PoolSlot): void {
  reservations.delete(slot.vrfSlot.toBase58());
}

export function vrfUnavailable(reason: string, details?: string): Error {
  const error = new Error(reason) as Error & { status?: number; expose?: boolean; details?: string };
  error.status = 503;
  error.expose = true;
  if (details) error.details = details;
  return error;
}

/** JSON body for a route catch. `details` is diagnostic; `error` stays a stable code. */
export function publicErrorBody(error: unknown): { status: number; body: { error: string; details?: string } } {
  const status = Number((error as { status?: number })?.status) || 400;
  const message = error instanceof Error ? error.message : String(error);
  const details = (error as { details?: string })?.details;
  return { status, body: details ? { error: message, details } : { error: message } };
}

// ---------------------------------------------------------------- Switchboard SDK

type SbModule = typeof import("@switchboard-xyz/on-demand");
let sbModule: Promise<SbModule> | undefined;
let sbProgram: Promise<any> | undefined;

async function sdk(): Promise<SbModule> {
  if (!sbModule) sbModule = import("@switchboard-xyz/on-demand");
  return sbModule;
}

async function switchboardProgram(connection: Connection): Promise<any> {
  if (!sbProgram) {
    sbProgram = sdk()
      .then((sb) => sb.AnchorUtils.loadProgramFromConnection(connection as any, undefined, switchboard().programId as any))
      .catch((error) => {
        sbProgram = undefined;
        throw error;
      });
  }
  return sbProgram;
}

/** One oracle of the queue as the SDK's randomness selector sees it. */
export type OracleCandidate = {
  oracle: PublicKey;
  gatewayUrl: string;
  isOnQueue: boolean;
  isVerified: boolean;
  heartbeatFresh: boolean;
  quoteFresh: boolean;
  liveHealthy: boolean;
  restricted?: boolean;
  gatewayEnabled?: boolean;
  pullOracleEnabled?: boolean;
  /** Oracle software version as reported by live health (may be absent). */
  version?: string | null;
  /** Unix seconds from the oracle account, for the refusal log. */
  lastHeartbeatUnix?: number;
  validUntilUnix?: number;
};

/** Mirrors isRandomnessOracleCandidateEligible of @switchboard-xyz/common. */
export function oracleEligible(c: OracleCandidate): boolean {
  return Boolean(c.gatewayUrl) && c.isOnQueue && c.isVerified && c.heartbeatFresh && c.quoteFresh &&
    c.restricted !== true && c.gatewayEnabled !== false && c.pullOracleEnabled !== false;
}

export function oracleRejectionReasons(c: OracleCandidate): string[] {
  const reasons: string[] = [];
  if (!c.gatewayUrl) reasons.push("missing-gateway");
  if (!c.isOnQueue) reasons.push("not-on-queue");
  if (!c.isVerified) reasons.push("verification-failed");
  if (!c.heartbeatFresh) reasons.push("heartbeat-stale");
  if (!c.quoteFresh) reasons.push("quote-expired");
  if (c.restricted === true) reasons.push("restricted");
  if (c.gatewayEnabled === false) reasons.push("gateway-disabled");
  if (c.pullOracleEnabled === false) reasons.push("pull-oracle-disabled");
  return reasons;
}

/** One line for the API log and the commit 503 `details` field. */
export function oracleSelectionSummary(candidates: OracleCandidate[], nowUnix = Math.floor(Date.now() / 1000)): string {
  const counts = new Map<string, number>();
  let newestHeartbeat = Number.POSITIVE_INFINITY;
  let soonestQuote = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const reasons = oracleRejectionReasons(forRandomnessSelection(candidate));
    const key = reasons.length ? reasons.join(",") : "eligible";
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (candidate.lastHeartbeatUnix !== undefined) newestHeartbeat = Math.min(newestHeartbeat, nowUnix - candidate.lastHeartbeatUnix);
    if (candidate.validUntilUnix !== undefined) soonestQuote = Math.min(soonestQuote, candidate.validUntilUnix - nowUnix);
  }
  const parts = [...counts.entries()].map(([reason, count]) => `${reason}=${count}`);
  if (Number.isFinite(newestHeartbeat)) parts.push(`newestHeartbeatAge=${newestHeartbeat}s`);
  if (Number.isFinite(soonestQuote)) parts.push(`soonestQuote=${soonestQuote}s`);
  return parts.join(" ") || "none";
}

/** A randomness commit does not need a pull feed. Heartbeat, quote, verification
 * and queue membership still have to be fresh, or Switchboard rejects the seed. */
export function forRandomnessSelection(c: OracleCandidate): OracleCandidate {
  return c.pullOracleEnabled === false ? { ...c, pullOracleEnabled: undefined } : c;
}

export function chooseOracle(candidates: OracleCandidate[], random: () => number = Math.random): PublicKey {
  try {
    return pickOracle(candidates, random);
  } catch {
    const relaxed = candidates.map(forRandomnessSelection);
    if (!relaxed.some(oracleEligible)) {
      const summary = oracleSelectionSummary(candidates);
      console.error("[vrf] no fresh randomness oracle:", summary);
      throw vrfUnavailable("VRF_ORACLE_UNAVAILABLE", summary);
    }
    console.warn("[vrf] no pull-enabled oracle; using an on-chain fresh randomness oracle");
    return pickOracle(relaxed, random);
  }
}

/** Mirrors computeMajorityVersion of @switchboard-xyz/common: the most frequent version, first one on a tie. */
export function majorityVersion(candidates: OracleCandidate[]): string | null {
  const counts = new Map<string, number>();
  for (const c of candidates) {
    const version = (c.version || "").trim();
    if (version) counts.set(version, (counts.get(version) ?? 0) + 1);
  }
  let majority: string | null = null;
  let max = 0;
  for (const [version, count] of counts) {
    if (count > max) {
      majority = version;
      max = count;
    }
  }
  return majority;
}

/**
 * Uniform pick among eligible oracles: live-healthy ones first and, within
 * them, the ones on the majority software version (the SDK's selector flags
 * the others "version-mismatch" and never picks them while a majority-version
 * oracle is available). The SDK always returns its single "best" oracle;
 * spreading commits keeps this game off one writable oracle account
 * (randomness_commit writes it) and limits the blast radius of one oracle
 * going dark to its share of commits.
 */
export function pickOracle(candidates: OracleCandidate[], random: () => number = Math.random): PublicKey {
  const eligible = candidates.filter(oracleEligible);
  const live = eligible.filter((c) => c.liveHealthy);
  const pool = live.length ? live : eligible;
  if (!pool.length) throw vrfUnavailable("VRF_ORACLE_UNAVAILABLE");
  const majority = majorityVersion(pool);
  const preferred = majority === null ? pool : pool.filter((c) => (c.version || "").trim() === majority);
  const choice = preferred.length ? preferred : pool;
  return choice[Math.min(choice.length - 1, Math.floor(random() * choice.length))].oracle;
}

const ORACLE_CACHE_MS = 30_000;
// A failed refresh keeps serving the last good list this long.
const ORACLE_STALE_OK_MS = 5 * 60_000;
let oracleCache: { candidates: OracleCandidate[]; at: number } | undefined;
let oracleRefresh: Promise<void> | undefined;

/** One entry of Queue.inspectRandomnessOracles().candidates as an OracleCandidate. */
export function oracleCandidateFromInspection(c: any): OracleCandidate {
  return {
    oracle: new PublicKey(c.oracle.pubkey.toBase58()),
    gatewayUrl: String(c.gatewayUrl || ""),
    isOnQueue: Boolean(c.isOnQueue),
    isVerified: Boolean(c.isVerified),
    heartbeatFresh: Boolean(c.heartbeatFresh),
    quoteFresh: Boolean(c.quoteFresh),
    liveHealthy: Boolean(c.liveHealthy),
    restricted: c.restricted,
    gatewayEnabled: c.gatewayEnabled,
    pullOracleEnabled: c.pullOracleEnabled,
    version: c.version ?? null,
  };
}

function oracleErrorText(error: unknown): string {
  return String((error as Error)?.message || error).replace(/\s+/g, " ").slice(0, 200);
}

/**
 * Switchboard OracleAccountData / QueueAccountData, discriminator included.
 * Anchors hashes `account:OracleAccountData` and `account:QueueAccountData`.
 * Field offsets are the published bytemuck layout (verification status 4 =
 * verified). Randomness selection reads these bytes itself: the SDK's
 * inspectRandomnessOracles waits on gateway health (about 10s) and then throws
 * the whole list away when no oracle has a pull feed.
 */
const SWITCHBOARD_ORACLE_DISCRIMINATOR = Buffer.from([128, 30, 16, 241, 170, 73, 55, 54]);
const SWITCHBOARD_QUEUE_DISCRIMINATOR = Buffer.from([217, 194, 55, 127, 184, 83, 138, 1]);
const SWITCHBOARD_ORACLE_VERIFIED = 4;
const SWITCHBOARD_ORACLE_LAYOUT = {
  verificationStatus: 72,
  validUntil: 88,
  queue: 3472,
  lastHeartbeat: 3512,
  gatewayUri: 3584,
  gatewayUriLength: 64,
  isOnQueue: 3656,
  minLength: 3657,
} as const;
const SWITCHBOARD_QUEUE_LAYOUT = {
  oracleKeys: 1064,
  oracleKeysCapacity: 78,
  nodeTimeout: 5176,
  oracleKeysLen: 5204,
  minLength: 5208,
} as const;

export type ChainOracleFields = {
  queue: Buffer;
  verified: boolean;
  validUntil: bigint;
  lastHeartbeat: bigint;
  isOnQueue: boolean;
  gatewayUrl: string;
};

export function parseChainQueue(data: Buffer): { oracleKeys: Buffer[]; nodeTimeout: bigint } {
  if (data.length < SWITCHBOARD_QUEUE_LAYOUT.minLength || !data.subarray(0, 8).equals(SWITCHBOARD_QUEUE_DISCRIMINATOR)) {
    throw new Error("Not a Switchboard queue account");
  }
  const length = data.readUInt32LE(SWITCHBOARD_QUEUE_LAYOUT.oracleKeysLen);
  if (length > SWITCHBOARD_QUEUE_LAYOUT.oracleKeysCapacity) throw new Error("Switchboard queue length is unreadable");
  const oracleKeys: Buffer[] = [];
  for (let i = 0; i < length; i += 1) {
    const start = SWITCHBOARD_QUEUE_LAYOUT.oracleKeys + i * 32;
    oracleKeys.push(Buffer.from(data.subarray(start, start + 32)));
  }
  const nodeTimeout = data.readBigInt64LE(SWITCHBOARD_QUEUE_LAYOUT.nodeTimeout);
  if (nodeTimeout < 0n) throw new Error("Switchboard queue timeout is unreadable");
  return { oracleKeys, nodeTimeout };
}

export function parseChainOracle(data: Buffer): ChainOracleFields | null {
  if (data.length < SWITCHBOARD_ORACLE_LAYOUT.minLength || !data.subarray(0, 8).equals(SWITCHBOARD_ORACLE_DISCRIMINATOR)) return null;
  const uri = data.subarray(
    SWITCHBOARD_ORACLE_LAYOUT.gatewayUri,
    SWITCHBOARD_ORACLE_LAYOUT.gatewayUri + SWITCHBOARD_ORACLE_LAYOUT.gatewayUriLength,
  );
  const end = uri.indexOf(0);
  let gatewayUrl = "";
  try {
    gatewayUrl = gatewayUrlFromBytes(end === -1 ? uri : uri.subarray(0, end));
  } catch {
    gatewayUrl = "";
  }
  return {
    queue: Buffer.from(data.subarray(SWITCHBOARD_ORACLE_LAYOUT.queue, SWITCHBOARD_ORACLE_LAYOUT.queue + 32)),
    verified: data[SWITCHBOARD_ORACLE_LAYOUT.verificationStatus] === SWITCHBOARD_ORACLE_VERIFIED,
    validUntil: data.readBigInt64LE(SWITCHBOARD_ORACLE_LAYOUT.validUntil),
    lastHeartbeat: data.readBigInt64LE(SWITCHBOARD_ORACLE_LAYOUT.lastHeartbeat),
    isOnQueue: data[SWITCHBOARD_ORACLE_LAYOUT.isOnQueue] !== 0,
    gatewayUrl,
  };
}

/** On-chain randomness eligibility. Pull feed and live health are not required. */
export function chainOracleCandidate(
  oracle: PublicKey,
  fields: ChainOracleFields,
  queue: PublicKey,
  nodeTimeout: bigint,
  nowUnix: bigint,
): OracleCandidate {
  const heartbeatAge = nowUnix - fields.lastHeartbeat;
  return {
    oracle,
    gatewayUrl: fields.gatewayUrl,
    isOnQueue: fields.isOnQueue && fields.queue.equals(queue.toBuffer()),
    isVerified: fields.verified,
    heartbeatFresh: fields.lastHeartbeat > 0n && heartbeatAge >= -120n && heartbeatAge <= nodeTimeout,
    quoteFresh: fields.validUntil > nowUnix,
    liveHealthy: false,
    lastHeartbeatUnix: Number(fields.lastHeartbeat),
    validUntilUnix: Number(fields.validUntil),
  };
}

async function inspectOraclesFromChain(connection: Connection): Promise<{ inspection: any; candidates: OracleCandidate[] }> {
  const sbc = switchboard();
  const queueInfo = await connection.getAccountInfo(sbc.queue, "confirmed");
  if (!queueInfo || !queueInfo.owner.equals(sbc.programId)) throw new Error("Switchboard queue account not found");
  const parsed = parseChainQueue(Buffer.from(queueInfo.data));
  const oracleKeys = parsed.oracleKeys
    .filter((key) => !key.equals(Buffer.alloc(32)))
    .map((key) => new PublicKey(key));
  if (!oracleKeys.length) throw new Error("No oracles found on queue");
  const infos = await connection.getMultipleAccountsInfo(oracleKeys, "confirmed");
  const nowUnix = BigInt(Math.floor(Date.now() / 1000));
  const candidates = oracleKeys.flatMap((oracle, index) => {
    const info = infos[index];
    if (!info || !info.owner.equals(sbc.programId)) return [];
    const fields = parseChainOracle(Buffer.from(info.data));
    return fields ? [chainOracleCandidate(oracle, fields, sbc.queue, parsed.nodeTimeout, nowUnix)] : [];
  });
  if (!candidates.length) throw new Error("No Switchboard oracle account loaded");
  return { inspection: { source: "chain", nodeTimeout: parsed.nodeTimeout.toString() }, candidates };
}

/** The trusted queue's randomness oracles as the SDK inspects them (uncached). */
async function inspectOraclesFromSdk(connection: Connection): Promise<{ inspection: any; candidates: OracleCandidate[] }> {
  const sb = await sdk();
  const prog = await switchboardProgram(connection);
  const queue = new sb.Queue(prog, switchboard().queue as any);
  const inspection: any = await queue.inspectRandomnessOracles();
  return { inspection, candidates: (inspection.candidates || []).map(oracleCandidateFromInspection) };
}

/**
 * The SDK aborts the whole queue when one member account does not load.
 * Keep the members that did load. Eligibility stays the on-chain rule.
 */
async function inspectLoadedOracles(connection: Connection): Promise<{ inspection: any; candidates: OracleCandidate[] }> {
  const sb = await sdk();
  const prog = await switchboardProgram(connection);
  const queue = new sb.Queue(prog, switchboard().queue as any);
  const queueData = await queue.loadData();
  const keyCount = Number(queueData.oracleKeysLen);
  if (!Number.isInteger(keyCount) || keyCount < 0) throw new Error("Switchboard queue length is unreadable");
  const oracleKeys = queueData.oracleKeys.slice(0, keyCount);
  const loaded = await sb.Oracle.loadMany(prog, oracleKeys);
  const present = oracleKeys.flatMap((oracleKey: PublicKey, index: number) => {
    const data = loaded[index];
    return data ? [{ oracleKey, data }] : [];
  });
  if (!present.length) throw new Error("No Switchboard oracle account loaded");
  // Live health is optional here: the failed SDK pass already tried it. An oracle
  // that is verified and fresh on-chain remains eligible, matching the SDK fallback.
  const raw = present.map((row: { oracleKey: PublicKey; data: any }) => sb.buildSolanaRandomnessOracleCandidate({
    oracle: new sb.Oracle(prog, row.oracleKey),
    data: row.data,
    queueData,
  }));
  return { inspection: { candidates: raw, queueData }, candidates: raw.map(oracleCandidateFromInspection) };
}

export async function inspectOracles(connection: Connection): Promise<{ inspection: any; candidates: OracleCandidate[] }> {
  // Chain bytes first, reading oracles that loaded from the queue account.
  // Gateway health is not a commit requirement and its 10s timeout was the
  // whole `commit` 503. The SDK decode is only a second opinion when the byte
  // layout sees no fresh randomness oracle.
  let chain: { inspection: any; candidates: OracleCandidate[] } | undefined;
  try {
    chain = await inspectOraclesFromChain(connection);
    if (chain.candidates.map(forRandomnessSelection).some(oracleEligible)) return chain;
  } catch (error) {
    console.error("[vrf] chain oracle read failed:", oracleErrorText(error));
  }
  try {
    const loaded = await inspectLoadedOracles(connection);
    if (loaded.candidates.map(forRandomnessSelection).some(oracleEligible)) {
      if (chain) console.warn("[vrf] byte layout saw no fresh oracle; SDK decode did");
      return loaded;
    }
    return chain ?? loaded;
  } catch (error) {
    if (chain) return chain;
    console.error("[vrf] oracle read failed:", oracleErrorText(error));
    throw error;
  }
}

async function refreshOracles(connection: Connection): Promise<void> {
  const { candidates } = await inspectOracles(connection);
  const eligible = candidates.filter(oracleEligible).length;
  const randomness = candidates.map(forRandomnessSelection).filter(oracleEligible).length;
  console.log(`[vrf] oracles loaded=${candidates.length} eligible=${eligible} randomness=${randomness} ${oracleSelectionSummary(candidates)}`);
  oracleCache = { at: Date.now(), candidates };
}

/** Oracle for a new commit (queue inspection cached for 30 s). */
export async function selectOracle(connection: Connection): Promise<PublicKey> {
  const age = oracleCache ? Date.now() - oracleCache.at : Infinity;
  if (age > ORACLE_CACHE_MS) {
    oracleRefresh ||= refreshOracles(connection).finally(() => { oracleRefresh = undefined; });
    try {
      await oracleRefresh;
    } catch (error) {
      console.error("[vrf] oracle refresh failed:", oracleErrorText(error));
      if (!oracleCache || Date.now() - oracleCache.at > ORACLE_STALE_OK_MS) throw vrfUnavailable("VRF_ORACLE_UNAVAILABLE");
      console.warn("[vrf] using the cached oracle list");
    }
  }
  return chooseOracle(oracleCache!.candidates);
}

let randomnessModeAnnounced = false;

function announceRandomnessMode(): void {
  if (randomnessModeAnnounced) return;
  randomnessModeAnnounced = true;
  const mode = randomnessMode();
  console.log(`[vrf] randomness=${mode}`);
  if (mode === "switchboard") {
    console.warn("[vrf] AOF_RANDOMNESS is switchboard. Set AOF_RANDOMNESS=slot-hash only after the program upgrade; until then commits stay refused instead of charging a failed transaction.");
  }
}

/** Accounts every VRF commit instruction takes after its own accounts. */
export async function vrfCommitAccounts(program: any, connection: Connection, slot: PoolSlot) {
  announceRandomnessMode();
  const sbc = switchboard();
  // Slot-hash commit ignores the oracle. The queue account already exists and
  // the instruction still requires a writable pubkey in that position.
  const oracle = randomnessMode() === "slot-hash" ? sbc.queue : await selectOracle(connection);
  return {
    vrfSlot: slot.vrfSlot,
    randomness: slot.randomness,
    vrfAuthority: vrfAuthorityPda(program.programId),
    queue: sbc.queue,
    oracle,
    recentSlothashes: SYSVAR_SLOT_HASHES_PUBKEY,
    switchboardProgram: sbc.programId,
  };
}

export type RevealParams = { signature: number[]; recoveryId: number; value: number[] };

/** Gateway URL stored on an oracle account (NUL-padded bytes); http(s) only. */
export function gatewayUrlFromBytes(bytes: ArrayLike<number>): string {
  const raw = Buffer.from(Array.from(bytes)).toString("utf8").replace(/\0+$/, "").trim();
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Oracle has no usable gateway URL");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Oracle has no usable gateway URL");
  return url.toString().replace(/\/+$/, "");
}

/**
 * Body of POST {gateway}/gateway/api/v1/randomness_reveal. The SDK's revealIx
 * also sends this backend's RPC URL, which usually embeds a paid API key, to a
 * third-party oracle operator; the gateway resolves the slot hash without it,
 * so it is only sent when SWITCHBOARD_GATEWAY_RPC_URL is set explicitly.
 */
export function revealRequestBody(randomness: PublicKey, seedSlothash: Uint8Array, seedSlot: bigint, rpc?: string) {
  const body: Record<string, unknown> = {
    slothash: Array.from(seedSlothash),
    randomness_key: randomness.toBuffer().toString("hex"),
    slot: Number(seedSlot),
  };
  if (rpc) body.rpc = rpc;
  return body;
}

/**
 * The gateway's answer as program reveal params. Not trusted beyond shape:
 * Switchboard verifies the enclave signature in randomness_reveal and the
 * program reads the value back from the account.
 */
export function parseRevealResponse(json: any): RevealParams {
  const signature = Buffer.from(String(json?.signature ?? ""), "base64");
  if (signature.length !== 64) throw new Error("Switchboard gateway: signature must be 64 bytes");
  const recoveryId = Number(json?.recovery_id);
  if (!Number.isInteger(recoveryId) || recoveryId < 0 || recoveryId > 3) throw new Error("Switchboard gateway: bad recovery id");
  const value = json?.value;
  if (!Array.isArray(value) || value.length !== 32 || !value.every((b: unknown) => Number.isInteger(b) && (b as number) >= 0 && (b as number) <= 255)) {
    throw new Error("Switchboard gateway: value must be 32 bytes");
  }
  return { signature: Array.from(signature), recoveryId, value: value as number[] };
}

const GATEWAY_TIMEOUT_MS = 10_000;

/**
 * The oracle's signed reveal for `randomness`, as program reveal params plus
 * the Switchboard accounts of the reveal CPI. Asks the gateway of the oracle
 * Switchboard assigned at commit directly (no fixed delay: the settler waits
 * VRF_SETTLER_MIN_AGE_SLOTS, and a gateway that has not seen the seed slot yet
 * just fails the attempt, which is retried).
 */
function slotHashReveal(program: any, randomness: PublicKey) {
  const sbc = switchboard();
  const oracle = sbc.queue;
  return {
    params: { signature: Array(64).fill(0), recoveryId: 0, value: Array(32).fill(0) },
    accounts: {
      vrfSlot: vrfSlotPda(program.programId, randomness),
      randomness,
      vrfAuthority: vrfAuthorityPda(program.programId),
      oracle,
      queue: sbc.queue,
      stats: statsPda(oracle),
      recentSlothashes: SYSVAR_SLOT_HASHES_PUBKEY,
      rewardEscrow: rewardEscrowAddress(randomness),
      wrappedSolMint: NATIVE_MINT,
      programState: sbc.state,
      switchboardProgram: sbc.programId,
    },
  };
}

export async function vrfReveal(program: any, connection: Connection, randomness: PublicKey, _payer: PublicKey) {
  if (randomnessMode() === "slot-hash") return slotHashReveal(program, randomness);
  const sbc = switchboard();
  const info = await connection.getAccountInfo(randomness, "confirmed");
  if (!info || !info.owner.equals(sbc.programId)) throw new Error("Randomness account not found");
  const r = parseRandomness(info.data);
  if (!r.queue.equals(sbc.queue)) throw new Error("Randomness account is not on the trusted queue");
  if (r.revealSlot !== 0n) throw new Error("Randomness already revealed");
  if (r.oracle.equals(PublicKey.default)) throw new Error("Randomness has no committed oracle");

  const sb = await sdk();
  const prog = await switchboardProgram(connection);
  const oracleData: any = await new sb.Oracle(prog, r.oracle as any).loadData();
  if (new PublicKey(oracleData.queue.toBase58()).toBase58() !== sbc.queue.toBase58()) {
    throw new Error("Committed oracle serves another queue");
  }
  const gateway = gatewayUrlFromBytes(oracleData.gatewayUri);
  const response = await fetch(`${gateway}/gateway/api/v1/randomness_reveal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(revealRequestBody(randomness, r.seedSlothash, r.seedSlot, process.env.SWITCHBOARD_GATEWAY_RPC_URL || undefined)),
    signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Switchboard gateway ${new URL(gateway).host} HTTP ${response.status}: ${text.slice(0, 200)}`);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("Switchboard gateway: response is not JSON");
  }
  const params = parseRevealResponse(json);
  const accounts = {
    vrfSlot: vrfSlotPda(program.programId, randomness),
    randomness,
    vrfAuthority: vrfAuthorityPda(program.programId),
    oracle: r.oracle,
    queue: sbc.queue,
    stats: statsPda(r.oracle),
    recentSlothashes: SYSVAR_SLOT_HASHES_PUBKEY,
    rewardEscrow: rewardEscrowAddress(randomness),
    wrappedSolMint: NATIVE_MINT,
    programState: sbc.state,
    switchboardProgram: sbc.programId,
  };
  return { params, accounts };
}

/** Accounts + args of `vrf_pool_add` for pool index `index` (core or quests program). */
export async function vrfPoolAddAccounts(program: any, connection: Connection, index: number) {
  const sbc = switchboard();
  const randomness = vrfRandomnessPda(program.programId, index);
  const recentSlot = await connection.getSlot("finalized");
  const lutSigner = lutSignerPda(randomness);
  return {
    recentSlot,
    accounts: {
      vrfAuthority: vrfAuthorityPda(program.programId),
      randomness,
      vrfSlot: vrfSlotPda(program.programId, randomness),
      rewardEscrow: rewardEscrowAddress(randomness),
      queue: sbc.queue,
      programState: sbc.state,
      lutSigner,
      lut: lutAddress(lutSigner, recentSlot),
      wrappedSolMint: NATIVE_MINT,
      switchboardProgram: sbc.programId,
      addressLookupTableProgram: ADDRESS_LOOKUP_TABLE_PROGRAM_ID,
    },
  };
}

/** Random u64 nonce for commit PDAs, as a decimal string (BN-friendly). */
export function randomNonce(): string {
  const b = require("crypto").randomBytes(8) as Buffer;
  return b.readBigUInt64LE(0).toString();
}
