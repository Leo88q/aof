"use strict";
/**
 * Watchtower OS v3 — tenant / game configuration for AOF.
 *
 * game_id  = aof          (tenant_id = aof, Postgres RLS tenant_id = 'aof')
 * network  = stage        (stage phase: prototype)
 * program  = AOF_CORE_PROGRAM_ID + CgInv111... + SessKeys111... + STrEaSuRy111...
 *
 * The three vanity program ids (CgInv111..., SessKeys111..., STrEaSuRy111...)
 * are stage-prototype placeholders from the AOF v3 spec. Where a program is
 * already deployed its real devnet id is carried in `deployedId`.
 */

const GAME = Object.freeze({
  gameId: "aof",
  tenantId: "aof",
  name: "Age of Farming",
  genre: "farming crafting trading marketplace",
  network: "stage",
  stage: "prototype",
  commitment: "finalized",
  rls: { column: "tenant_id", value: "aof" },
});

/**
 * program_ids: AOF_CORE_PROGRAM_ID + CgInv111... + SessKeys111... + STrEaSuRy111...
 * `key`/`symbolic` are exactly the spec strings (grep-friendly), `programId` is
 * the resolved key used by clients, `deployedId` the key already on devnet.
 */
const ADDRESS_REGISTRY = require("../../watchtower/addresses.json");
const addressOf = name => ADDRESS_REGISTRY.programs.find(p => p.name === name).address;
const PROGRAMS = Object.freeze([
  Object.freeze({
    key: "AOF_CORE_PROGRAM_ID",
    symbolic: "AOF_CORE_PROGRAM_ID",
    alias: "aof_core",
    programId: addressOf("aof_core"),
    deployedId: null,
    role: "core farming / crafting / player state",
    status: "reference-unverified",
  }),
  Object.freeze({
    key: "CgInv111...",
    symbolic: "CgInv111...",
    alias: "aof_cginv",
    programId: "CgInv1111111111111111111111111111111111111",
    deployedId: null,
    role: "craft-gamble inventory (Gamba wager NFT, jackpot, house edge 5%)",
    status: "stage-prototype-placeholder",
  }),
  Object.freeze({
    key: "SessKeys111...",
    symbolic: "SessKeys111...",
    alias: "aof_session_keys",
    programId: addressOf("aof_session_keys"),
    deployedId: null,
    role: "session keys: spending disabled pending atomic CPI binding",
    status: "reference-unverified",
  }),
  Object.freeze({
    key: "STrEaSuRy111...",
    symbolic: "STrEaSuRy111...",
    alias: "aof_treasury",
    programId: "STrEaSuRy1111111111111111111111111111111",
    deployedId: null,
    role: "treasury: fees, DePIN escrow, jackpot vault, RewardPool payouts",
    status: "stage-prototype-placeholder",
  }),
]);

const PROGRAM_IDS = Object.freeze(PROGRAMS.map((p) => p.key));

/** Session Keys contract of AOF v3 (Identity). */
const SESSION_KEYS = Object.freeze({
  program: "SessKeys111...",
  createSession: { on: "AOF_CORE_PROGRAM_ID", ttlMinutes: 60 },
  topUpSol: 0.01,
  expiryMinutes: 60,
  forbiddenIxs: ["withdraw", "transfer", "payout"],
  note: "allowed_ixs mask physically excludes withdraw/transfer/payout (FORBIDDEN_IXS_MASK)",
});

/** DePIN crafting-market worker economics (Infra). */
const DEPIN = Object.freeze({
  workerStakeSol: 10,
  escrowSolPer100Players: 0.1,
  reward: "per settled craft job",
  slash: "on missed/invalid job",
});

/** Gamba craft-gamble economics. */
const GAMBA = Object.freeze({
  wager: "NFT",
  provablyFair: "commit-reveal",
  houseEdgePercent: 5,
  jackpot: true,
});

/** Cross-game identity / materials bridge. */
const CROSS_GAME = Object.freeze({
  studioPda: { seeds: ["studio_profile"], program: "AOF_CORE_PROGRAM_ID" },
  arcEntityIds: true,
  boltEntityIds: true,
  linkedWallets: ["RACE", "idosgames"],
  materials: {
    source: "ARC Entity-Component + Core Attributes + Xandeum",
    rls: "tenant_id = 'aof'",
    materializedView: "mv_cross_game_materials_aof",
    sql: "src/os/sql/cross_game_materials.sql",
  },
});

function resolveProgram(key) {
  return PROGRAMS.find((p) => p.key === key || p.alias === key) || null;
}

/** gameId gate used by every /api/** handler. Only tenant `aof` exists. */
function checkGameId(gameId) {
  if (gameId === undefined || gameId === null || gameId === "") return { ok: true, gameId: GAME.gameId, defaulted: true };
  if (gameId !== GAME.gameId) return { ok: false, error: `unknown gameId "${gameId}" — this OS serves tenant aof only` };
  return { ok: true, gameId, defaulted: false };
}

module.exports = {
  GAME,
  PROGRAMS,
  PROGRAM_IDS,
  SESSION_KEYS,
  DEPIN,
  GAMBA,
  CROSS_GAME,
  resolveProgram,
  checkGameId,
};
