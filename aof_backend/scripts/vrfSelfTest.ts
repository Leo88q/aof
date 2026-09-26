/**
 * [F-06] Offline self-test of the backend VRF helpers: pool circuit breaker,
 * settlement phase split, cluster selection, randomness account parsing and
 * the address derivations the on-chain contexts bind.
 */
import assert from "node:assert/strict";
import { PublicKey } from "@solana/web3.js";

process.env.PROGRAM_ID ||= "HtJg3R3Ki938QeSD98djwMgWESboDVEykuyKGtvRamEq";
process.env.TREASURY_PUBKEY ||= "11111111111111111111111111111111";
process.env.AUTHORITY_MODE ||= "read-only";
process.env.AUTHORITY_PUBKEY ||= "11111111111111111111111111111111";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const vrf = require("../src/lib/vrf") as typeof import("../src/lib/vrf");

const k = (seed: number) => new PublicKey(Buffer.alloc(32, seed));

// ---- circuit breaker over the pool
{
  const slot = (i: number, lock: PublicKey, lockedAtSlot = 0, retired = false) => ({
    vrfSlot: k(100 + i), randomness: k(200 + i), index: i, lock, lockedAtSlot, retired,
  });
  const env = { VRF_MAX_PENDING_SLOTS: "450" } as NodeJS.ProcessEnv;
  assert.deepEqual(vrf.evaluatePool([], 1_000, env).reason, "VRF_POOL_EMPTY");
  const healthy = vrf.evaluatePool([slot(0, PublicKey.default), slot(1, k(9), 900)], 1_000, env);
  assert.equal(healthy.healthy, true);
  assert.equal(healthy.free, 1);
  assert.equal(healthy.oldestLockAgeSlots, 100);
  const stuck = vrf.evaluatePool([slot(0, PublicKey.default), slot(1, k(9), 100)], 1_000, env);
  assert.equal(stuck.healthy, false, "a commit older than VRF_MAX_PENDING_SLOTS stops new commits");
  assert.equal(stuck.reason, "VRF_SETTLEMENT_DEGRADED");
  const busy = vrf.evaluatePool([slot(0, k(8), 990), slot(1, k(9), 995)], 1_000, env);
  assert.equal(busy.reason, "VRF_POOL_EXHAUSTED");
  const retired = vrf.evaluatePool([slot(0, PublicKey.default, 0, true)], 1_000, env);
  assert.equal(retired.reason, "VRF_POOL_EMPTY", "retired slots do not count");
  assert.equal(vrf.maxPendingSlots({} as NodeJS.ProcessEnv), 450);
}

// ---- settlement phases never overlap (mirrors vrf.rs reveal/refund windows)
{
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { commitPhase } = require("../src/lib/vrfSettlement") as typeof import("../src/lib/vrfSettlement");
  assert.equal(vrf.VRF_REFUND_AFTER_SLOTS, 18_000);
  assert.equal(commitPhase(1_000, 1_000), "revealable");
  assert.equal(commitPhase(1_000, 1_000 + 17_999), "revealable");
  assert.equal(commitPhase(1_000, 1_000 + 18_000), "refundable");
}

// ---- cluster selection must match the program build
{
  assert.equal(vrf.switchboardCluster({ SWITCHBOARD_CLUSTER: "devnet" } as NodeJS.ProcessEnv, "https://x"), "devnet");
  assert.equal(vrf.switchboardCluster({} as NodeJS.ProcessEnv, "https://api.devnet.solana.com"), "devnet");
  assert.equal(vrf.switchboardCluster({} as NodeJS.ProcessEnv, "https://mainnet.helius-rpc.com"), "mainnet");
  assert.throws(() => vrf.switchboardCluster({ SWITCHBOARD_CLUSTER: "testnet" } as NodeJS.ProcessEnv, "https://x"));
  assert.equal(vrf.SWITCHBOARD.mainnet.programId.toBase58(), "SBondMDrcV3K4kxZR1HNVT7osZxAHVHgYXL5Ze1oMUv");
  assert.equal(vrf.SWITCHBOARD.devnet.queue.toBase58(), "EYiAmGSdsQTuCw413V5BzaruWuCCSDgTPtBGvLkXHbe7");
  // The program-state PDA pinned in vrf.rs is derivable from the program id.
  for (const c of Object.values(vrf.SWITCHBOARD)) {
    assert.ok(PublicKey.findProgramAddressSync([Buffer.from("STATE")], c.programId)[0].equals(c.state));
  }
}

// ---- randomness account parsing (offsets of RandomnessAccountData)
{
  const data = Buffer.alloc(480);
  Buffer.from([10, 66, 229, 135, 220, 239, 217, 114]).copy(data, 0);
  k(1).toBuffer().copy(data, 8);
  k(2).toBuffer().copy(data, 40);
  data.writeBigUInt64LE(777n, 104);
  k(3).toBuffer().copy(data, 112);
  data.writeBigUInt64LE(779n, 144);
  Buffer.alloc(32, 7).copy(data, 152);
  const r = vrf.parseRandomness(data);
  assert.ok(r.authority.equals(k(1)) && r.queue.equals(k(2)) && r.oracle.equals(k(3)));
  assert.equal(r.seedSlot, 777n);
  assert.equal(r.revealSlot, 779n);
  assert.deepEqual([...r.value], Array(32).fill(7));
  data[0] ^= 1;
  assert.throws(() => vrf.parseRandomness(data), /Not a Switchboard randomness account/);
}

// ---- PDAs the on-chain contexts bind
{
  const core = new PublicKey(process.env.PROGRAM_ID!);
  const rnd = vrf.vrfRandomnessPda(core, 3);
  const le = Buffer.alloc(4);
  le.writeUInt32LE(3, 0);
  assert.ok(rnd.equals(PublicKey.findProgramAddressSync([Buffer.from("vrf_randomness"), le], core)[0]));
  assert.ok(vrf.vrfSlotPda(core, rnd).equals(PublicKey.findProgramAddressSync([Buffer.from("vrf_slot"), rnd.toBuffer()], core)[0]));
  assert.ok(vrf.vrfAuthorityPda(core).equals(PublicKey.findProgramAddressSync([Buffer.from("vrf_authority")], core)[0]));
  const env = { SWITCHBOARD_CLUSTER: "mainnet" } as NodeJS.ProcessEnv;
  const oracle = k(5);
  assert.ok(vrf.statsPda(oracle, env).equals(PublicKey.findProgramAddressSync(
    [Buffer.from("OracleRandomnessStats"), oracle.toBuffer()], vrf.SWITCHBOARD.mainnet.programId)[0]));
  const signer = vrf.lutSignerPda(rnd, env);
  const slotLe = Buffer.alloc(8);
  slotLe.writeBigUInt64LE(1234n, 0);
  assert.ok(vrf.lutAddress(signer, 1234).equals(PublicKey.findProgramAddressSync(
    [signer.toBuffer(), slotLe], vrf.ADDRESS_LOOKUP_TABLE_PROGRAM_ID)[0]));
  assert.match(vrf.randomNonce(), /^[0-9]+$/);
}

console.log("vrf self-test: pool circuit breaker, phase split, cluster pins, account parsing, PDAs passed");
