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
 * Interval: VRF_SETTLER_INTERVAL_MS (default 3 s); up to VRF_SETTLER_CONCURRENCY
 * (8) commits are settled in parallel; attempts per commit are throttled by
 * VRF_SETTLER_RETRY_MS (4 s) and back off exponentially on repeated failures
 * (up to VRF_SETTLER_MAX_BACKOFF_MS, 60 s). Operational signals (JSON logs):
 * settled / refunded / attempt_failed / low_balance / cycle_failed /
 * watchdog_exit, plus a heartbeat file for the container healthcheck.
 *
 * Signer: every instruction sent here is permissionless, so the settler signs
 * with a fee-only wallet (VRF_SETTLER_SECRET_KEY_FILE, lib/settlerSigner.ts)
 * and runs in AUTHORITY_MODE=read-only; production never hands it the
 * operator key. Redundancy: a standby instance on another host with
 * VRF_SETTLER_STANDBY_SLOTS=120 (own wallet and RPC) stays idle while this one
 * settles within seconds and takes over when it is down.
 */
import { writeFileSync } from "node:fs";
import { connection } from "../../src/provider";
import { AUTHORITY } from "../../src/config";
import { resolveSettlerSigner, settlerStandbySlots } from "../../src/lib/settlerSigner";
import { sendSignedBy } from "../../src/lib/tx";
import { sendSignedByWithVrfLookupTable } from "../../src/lib/vrfLookupTableTransactions";
import {
  buildRefundInstructions,
  buildRevealInstructions,
  commitPhase,
  listPendingCommits,
  PendingCommit,
} from "../../src/lib/vrfSettlement";

function positive(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const INTERVAL_MS = positive("VRF_SETTLER_INTERVAL_MS", 3_000);
const RETRY_MS = positive("VRF_SETTLER_RETRY_MS", 4_000);
// Repeated failures of one commit (oracle outage) back off exponentially up to this.
const MAX_BACKOFF_MS = positive("VRF_SETTLER_MAX_BACKOFF_MS", 60_000);
// Switchboard needs the seed slot to be final before its oracle signs.
const MIN_AGE_SLOTS = positive("VRF_SETTLER_MIN_AGE_SLOTS", 2);
// Commits settled in parallel: a reveal waits on the oracle gateway for
// seconds, so a serial loop would hold pool slots long enough to trip the
// circuit breaker under load.
const CONCURRENCY = Math.floor(positive("VRF_SETTLER_CONCURRENCY", 8));
// The settler wallet pays reveal fees and fronts NFT rent (reimbursed by the reveal).
const MIN_BALANCE_LAMPORTS = positive("VRF_SETTLER_MIN_BALANCE_LAMPORTS", 500_000_000);
const BALANCE_CHECK_MS = 60_000;
// A cycle stuck on an RPC call longer than this exits the process so the
// container restarts (docker-compose `restart: unless-stopped`).
const WATCHDOG_MS = positive("VRF_SETTLER_WATCHDOG_MS", 120_000);
// Touched after every cycle; docker-compose healthcheck reads its mtime.
const HEARTBEAT_FILE = process.env.VRF_SETTLER_HEARTBEAT_FILE || "/tmp/vrf-settler.heartbeat";
// Standby mode: only commits older than this many slots (0 = primary).
const STANDBY_SLOTS = settlerStandbySlots();
// Fee-only wallet in production; the operator key only as a dev fallback.
const SIGNER = resolveSettlerSigner(AUTHORITY);
const CRANKER = SIGNER.keypair.publicKey;

const nextAttempt = new Map<string, number>();
const failures = new Map<string, number>();
let running = false;
let cycleStartedAt = 0;
let lastBalanceCheck = 0;

function label(c: PendingCommit): string {
  return `${c.mechanic}:${c.address.toBase58()}`;
}

function log(level: "log" | "warn" | "error", event: string, fields: Record<string, unknown> = {}): void {
  console[level](JSON.stringify({ worker: "vrf-settler", event, ...fields }));
}

async function settle(c: PendingCommit, currentSlot: number): Promise<void> {
  const key = label(c);
  const now = Date.now();
  if ((nextAttempt.get(key) || 0) > now) return;
  if (currentSlot - c.commitSlot < STANDBY_SLOTS) return; // the primary settler's turn
  const phase = commitPhase(c.commitSlot, currentSlot);
  if (phase === "revealable" && currentSlot - c.seedSlot < MIN_AGE_SLOTS) return;
  nextAttempt.set(key, now + RETRY_MS);
  try {
    const ixs = phase === "revealable"
      ? await buildRevealInstructions(c, CRANKER)
      : await buildRefundInstructions(c, CRANKER);
    const requiresV0 = c.mechanic === "exploration"
      || (phase === "revealable" && (c.mechanic === "pack" || c.mechanic === "reroll"));
    const sig = requiresV0
      ? await sendSignedByWithVrfLookupTable(SIGNER.keypair, ixs)
      : await sendSignedBy(SIGNER.keypair, ixs);
    failures.delete(key);
    nextAttempt.delete(key);
    log("log", phase === "revealable" ? "settled" : "refunded", { commit: key, ageSlots: currentSlot - c.commitSlot, sig });
  } catch (e: any) {
    const count = (failures.get(key) || 0) + 1;
    failures.set(key, count);
    nextAttempt.set(key, Date.now() + Math.min(RETRY_MS * 2 ** Math.min(count - 1, 16), MAX_BACKOFF_MS));
    // Races with another settler (the player, a second replica) end in
    // AccountNotInitialized / VrfSlotNotHeld: the commit is already settled.
    log("warn", "attempt_failed", { commit: key, phase, attempt: count, ageSlots: currentSlot - c.commitSlot,
      error: String(e?.message || e).slice(0, 300) });
  }
}

async function checkBalance(): Promise<void> {
  if (Date.now() - lastBalanceCheck < BALANCE_CHECK_MS) return;
  lastBalanceCheck = Date.now();
  const lamports = await connection.getBalance(CRANKER, "confirmed");
  if (lamports < MIN_BALANCE_LAMPORTS) {
    log("warn", "low_balance", { signer: CRANKER.toBase58(), lamports, minLamports: MIN_BALANCE_LAMPORTS });
  }
}

async function cycle(): Promise<void> {
  if (running) return;
  running = true;
  cycleStartedAt = Date.now();
  try {
    const [pending, currentSlot] = await Promise.all([listPendingCommits(), connection.getSlot("confirmed")]);
    const queue = [...pending];
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      for (let c = queue.shift(); c; c = queue.shift()) await settle(c, currentSlot);
    }));
    const live = new Set(pending.map(label));
    for (const key of [...failures.keys()]) if (!live.has(key)) failures.delete(key);
    for (const key of [...nextAttempt.keys()]) if (!live.has(key)) nextAttempt.delete(key);
    if (pending.length) {
      const oldest = pending.reduce((m, c) => Math.max(m, currentSlot - c.commitSlot), 0);
      log("log", "cycle", { pending: pending.length, oldestAgeSlots: oldest });
    }
    await checkBalance();
    try {
      writeFileSync(HEARTBEAT_FILE, String(Date.now()));
    } catch {
      // Heartbeat is advisory (healthcheck only).
    }
  } catch (e: any) {
    log("error", "cycle_failed", { error: String(e?.message || e) });
  } finally {
    running = false;
  }
}

async function main(): Promise<void> {
  log("log", "start", { intervalMs: INTERVAL_MS, concurrency: CONCURRENCY, standbySlots: STANDBY_SLOTS,
    signer: CRANKER.toBase58(), signerSource: SIGNER.source });
  if (SIGNER.source === "operator") {
    log("warn", "operator_key_signer", { hint: "set VRF_SETTLER_SECRET_KEY_FILE to a fee-only wallet (required in production)" });
  }
  setInterval(() => {
    if (running && Date.now() - cycleStartedAt > WATCHDOG_MS) {
      log("error", "watchdog_exit", { stuckMs: Date.now() - cycleStartedAt });
      process.exit(1);
    }
  }, 10_000).unref();
  await cycle();
  setInterval(cycle, INTERVAL_MS);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
