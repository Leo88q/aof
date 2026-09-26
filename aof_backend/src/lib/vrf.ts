/**
 * [F-06] Switchboard On-Demand settlement — backend side.
 *
 * The on-chain programs own their randomness accounts (authority = program
 * PDA "vrf_authority"), so this module never signs anything for Switchboard.
 * It only:
 *   - picks a free pool slot and a live oracle for a commit transaction;
 *   - fetches the oracle's signed reveal from the Switchboard gateway and
 *     turns it into the accounts + params of a program reveal instruction;
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
export const VRF_REFUND_AFTER_SLOTS = 18_000;

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

/** Compute budget for VRF instructions (Switchboard reveal + NFT settlement). */
export function vrfComputeBudget(units = Number(process.env.VRF_COMPUTE_UNITS) || 400_000): TransactionInstruction[] {
  return [ComputeBudgetProgram.setComputeUnitLimit({ units })];
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

/**
 * Pick a free, unreserved pool slot at random (a lost race only fails that one
 * transaction with VrfSlotBusy). Throws a 503-style error when the pool is
 * unhealthy: new paid commits must not pile up behind a stuck settlement.
 */
export async function reservePoolSlot(program: any, connection: Connection): Promise<PoolSlot> {
  const [slots, currentSlot] = await Promise.all([listPoolSlots(program), connection.getSlot("confirmed")]);
  const health = evaluatePool(slots, currentSlot);
  if (!health.healthy && health.reason !== "VRF_POOL_EXHAUSTED") throw vrfUnavailable(health.reason!);
  const now = Date.now();
  for (const [key, until] of reservations) if (until < now) reservations.delete(key);
  const free = slots.filter((s) => !s.retired && s.lock.equals(PublicKey.default) && !reservations.has(s.vrfSlot.toBase58()));
  if (!free.length) throw vrfUnavailable("VRF_POOL_EXHAUSTED");
  const pick = free[Math.floor(Math.random() * free.length)];
  reservations.set(pick.vrfSlot.toBase58(), now + RESERVATION_MS);
  return pick;
}

export function vrfUnavailable(reason: string): Error {
  const error = new Error(reason);
  (error as { status?: number }).status = 503;
  (error as { expose?: boolean }).expose = true;
  return error;
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

/** A live randomness oracle of the trusted queue (Switchboard's own selection). */
export async function selectOracle(connection: Connection): Promise<PublicKey> {
  const sb = await sdk();
  const prog = await switchboardProgram(connection);
  const queue = new sb.Queue(prog, switchboard().queue as any);
  const { oracle } = await queue.selectRandomnessOracle();
  return new PublicKey(oracle.pubkey.toBase58());
}

/** Accounts every VRF commit instruction takes after its own accounts. */
export async function vrfCommitAccounts(program: any, connection: Connection, slot: PoolSlot) {
  const sbc = switchboard();
  return {
    vrfSlot: slot.vrfSlot,
    randomness: slot.randomness,
    vrfAuthority: vrfAuthorityPda(program.programId),
    queue: sbc.queue,
    oracle: await selectOracle(connection),
    recentSlothashes: SYSVAR_SLOT_HASHES_PUBKEY,
    switchboardProgram: sbc.programId,
  };
}

export type RevealParams = { signature: number[]; recoveryId: number; value: number[] };

/**
 * The oracle's signed reveal for `randomness`, as program reveal params plus
 * the Switchboard accounts of the reveal CPI. Uses the SDK's revealIx (which
 * asks the oracle's gateway) and decodes its data: discriminator(8) |
 * signature(64) | recovery_id(1) | value(32).
 */
export async function vrfReveal(program: any, connection: Connection, randomness: PublicKey, payer: PublicKey) {
  const sb = await sdk();
  const prog = await switchboardProgram(connection);
  const ix: TransactionInstruction = await new sb.Randomness(prog, randomness as any).revealIx(payer as any);
  const data = Buffer.from(ix.data);
  if (data.length !== 105) throw new Error(`Unexpected Switchboard reveal data length ${data.length}`);
  const params: RevealParams = {
    signature: Array.from(data.subarray(8, 72)),
    recoveryId: data[72],
    value: Array.from(data.subarray(73, 105)),
  };
  const key = (i: number) => new PublicKey(ix.keys[i].pubkey.toBase58());
  const sbc = switchboard();
  const accounts = {
    vrfSlot: vrfSlotPda(program.programId, randomness),
    randomness,
    vrfAuthority: vrfAuthorityPda(program.programId),
    oracle: key(1),
    queue: sbc.queue,
    stats: key(3),
    recentSlothashes: SYSVAR_SLOT_HASHES_PUBKEY,
    rewardEscrow: key(8),
    wrappedSolMint: NATIVE_MINT,
    programState: key(11),
    switchboardProgram: sbc.programId,
  };
  if (!accounts.queue.equals(key(2))) throw new Error("Randomness account is not on the trusted queue");
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
