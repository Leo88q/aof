/**
 * [F-06] VRF settler: settles every Switchboard-backed commit of aof-core
 * (packs, random reroll, exploration, forge, lottery draw) and aof-quests
 * (Drum of Luck).
 *
 * For each pending commit read from chain:
 *   - inside the reveal window  -> fetch the oracle's signed value (Switchboard
 *     gateway) and send the program's permissionless reveal;
 *   - after the window          -> send the permissionless refund.
 * The two windows never overlap on-chain, so this worker cannot pick between
 * outcomes, and a crash or race only delays settlement: anyone (the player's
 * own client included) can send the same instructions.
 *
 * Replaces the old commit-expirer (legacy SlotHashes expiry). Liveness matters:
 * a commit left unsettled past VRF_MAX_PENDING_SLOTS makes the commit routes
 * refuse new commits (lib/vrf.ts evaluatePool), and the Watchtower alerts on
 * VrfCommitted without VrfSettled.
 *
 * Run: npm run vrf-settler   (ts-node services/vrf-settler/index.ts)
 * Interval: VRF_SETTLER_INTERVAL_MS (default 3 s); reveal attempts per commit
 * are throttled by VRF_SETTLER_RETRY_MS (default 4 s).
 */
import { connection } from "../../src/provider";
import { AUTHORITY_PUBKEY } from "../../src/config";
import { authorityOnly } from "../../src/lib/tx";
import {
  buildRefundInstructions,
  buildRevealInstructions,
  commitPhase,
  listPendingCommits,
  PendingCommit,
} from "../../src/lib/vrfSettlement";

const INTERVAL_MS = Number(process.env.VRF_SETTLER_INTERVAL_MS) > 0 ? Number(process.env.VRF_SETTLER_INTERVAL_MS) : 3_000;
const RETRY_MS = Number(process.env.VRF_SETTLER_RETRY_MS) > 0 ? Number(process.env.VRF_SETTLER_RETRY_MS) : 4_000;
// Switchboard needs the seed slot to be final before its oracle signs.
const MIN_AGE_SLOTS = Number(process.env.VRF_SETTLER_MIN_AGE_SLOTS) > 0 ? Number(process.env.VRF_SETTLER_MIN_AGE_SLOTS) : 2;

const lastAttempt = new Map<string, number>();
const failures = new Map<string, number>();
let running = false;

function label(c: PendingCommit): string {
  return `${c.mechanic}:${c.address.toBase58()}`;
}

async function settle(c: PendingCommit, currentSlot: number): Promise<void> {
  const key = label(c);
  const now = Date.now();
  if ((lastAttempt.get(key) || 0) + RETRY_MS > now) return;
  lastAttempt.set(key, now);
  const phase = commitPhase(c.commitSlot, currentSlot);
  if (phase === "revealable" && currentSlot - c.seedSlot < MIN_AGE_SLOTS) return;
  try {
    const ixs = phase === "revealable"
      ? await buildRevealInstructions(c, AUTHORITY_PUBKEY)
      : await buildRefundInstructions(c, AUTHORITY_PUBKEY);
    const sig = await authorityOnly(ixs);
    failures.delete(key);
    lastAttempt.delete(key);
    console.log(JSON.stringify({ worker: "vrf-settler", event: phase === "revealable" ? "settled" : "refunded", commit: key,
      ageSlots: currentSlot - c.commitSlot, sig }));
  } catch (e: any) {
    const count = (failures.get(key) || 0) + 1;
    failures.set(key, count);
    // Races with another settler (the player, a second replica) end in
    // AccountNotInitialized / VrfSlotNotHeld: the commit is already settled.
    console.warn(JSON.stringify({ worker: "vrf-settler", event: "attempt_failed", commit: key, phase, attempt: count,
      ageSlots: currentSlot - c.commitSlot, error: String(e?.message || e).slice(0, 300) }));
  }
}

async function cycle(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const [pending, currentSlot] = await Promise.all([listPendingCommits(), connection.getSlot("confirmed")]);
    for (const commit of pending) await settle(commit, currentSlot);
    const live = new Set(pending.map(label));
    for (const key of [...failures.keys()]) if (!live.has(key)) failures.delete(key);
    if (pending.length) {
      const oldest = pending.reduce((m, c) => Math.max(m, currentSlot - c.commitSlot), 0);
      console.log(JSON.stringify({ worker: "vrf-settler", event: "cycle", pending: pending.length, oldestAgeSlots: oldest }));
    }
  } catch (e: any) {
    console.error(JSON.stringify({ worker: "vrf-settler", event: "cycle_failed", error: String(e?.message || e) }));
  } finally {
    running = false;
  }
}

async function main(): Promise<void> {
  console.log(JSON.stringify({ worker: "vrf-settler", event: "start", intervalMs: INTERVAL_MS }));
  await cycle();
  setInterval(cycle, INTERVAL_MS);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
