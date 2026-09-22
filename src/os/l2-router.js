"use strict";
/**
 * Watchtower OS v3 — L2 router.
 * GET /api/l2/router?gameId=aof&tps=low|high&ux=gasless|cheap|private|settled
 *
 * Ideal-free L2 pair of AOF v3:
 *   MagicBlock ER + REPLA — sub-10ms gasless (delegate -> executeGasless ->
 *   commit state, Magic Actions auto-harvest, REPLA L3 Anchor settle);
 *   Sonic HyperGrid      — high-tps farm-tick lanes.
 * Privacy overlay: Arcium (confidential) + PST (private verifiable).
 * Storage overlay: Xandeum (exabyte). Final settlement: AOF_CORE_PROGRAM_ID +
 * STrEaSuRy111... on L1 (stage/prototype).
 */
const { GAME, PROGRAM_IDS } = require("./config");

const TPS_VALUES = ["low", "high"];
const UX_VALUES = ["gasless", "cheap", "private", "settled"];

const MAGICBLOCK = Object.freeze({
  id: "magicblock-er",
  name: "MagicBlock ER + REPLA",
  latencyMs: 10,
  flow: ["delegate", "executeGasless", "commit state"],
  magicActions: ["auto-harvest"],
  l3: "REPLA Anchor settle on MagicBlock sequencer",
});

const SONIC = Object.freeze({
  id: "sonic-hypergrid",
  name: "Sonic HyperGrid",
  latencyMs: 1,
  flow: ["submit to HyperGrid lane", "batch settle"],
  magicActions: [],
  l3: null,
});

function l2Route(tpsIn, uxIn) {
  const tps = tpsIn ?? "low";
  const ux = uxIn ?? "gasless";
  const bad = [];
  if (!TPS_VALUES.includes(tps)) bad.push(`tps must be one of ${TPS_VALUES.join("|")}`);
  if (!UX_VALUES.includes(ux)) bad.push(`ux must be one of ${UX_VALUES.join("|")}`);
  if (bad.length) {
    const err = new Error(`unsupported l2 route query — ${bad.join("; ")}`);
    err.status = 400;
    throw err;
  }

  const highTps = tps === "high";
  const primary = highTps ? SONIC : MAGICBLOCK;
  const gasless = ux === "gasless";

  const route = {
    primary: primary.id,
    name: primary.name,
    latencyMs: primary.latencyMs,
    flow: gasless && primary.id === MAGICBLOCK.id
      ? MAGICBLOCK.flow
      : primary.flow,
    magicActions: gasless ? ["auto-harvest"] : [],
    l3: primary.id === MAGICBLOCK.id ? MAGICBLOCK.l3 : null,
  };
  if (highTps && gasless) {
    route.burstLane = MAGICBLOCK.id; // gasless bursts stay on MagicBlock ER
  }

  const result = {
    gameId: GAME.gameId,
    tenantId: GAME.tenantId,
    network: GAME.network,
    stage: GAME.stage,
    input: { tps, ux },
    route,
    alternates: (primary.id === SONIC.id ? [MAGICBLOCK] : [SONIC]).map((l) => ({ id: l.id, name: l.name })),
  };
  if (ux === "private") {
    result.privacy = { confidential: "arcium", privateState: "pst" };
  }
  if (ux === "settled") {
    result.settlement = { l1: ["AOF_CORE_PROGRAM_ID", "STrEaSuRy111..."], commitment: GAME.commitment };
  }
  result.storage = "xandeum";
  result.programIds = PROGRAM_IDS;
  return result;
}

module.exports = { l2Route, TPS_VALUES, UX_VALUES, MAGICBLOCK, SONIC };
