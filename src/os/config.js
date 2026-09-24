"use strict";
/**
 * Watchtower OS v3 — tenant / game configuration for AOF.
 *
 * game_id  = aof          (tenant_id = aof, Postgres RLS tenant_id = 'aof')
 * network  = stage        (stage phase: prototype)
 *
 * [AUDIT AOF-H2] Program ids are sourced from the honest address registry
 * (watchtower/addresses.json): the six program crates that actually exist in
 * this repo, with `status: reference-unverified` / `rpcVerifiedAt: null`
 * until a live RPC check is run by an operator. `CgInv111...` and
 * `STrEaSuRy111...` are KEPT as clearly-labelled placeholders with
 * `programId: null` — they are NOT deployed addresses (no such program
 * crate exists in this repo); they must never be used for RPC calls.
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
 * program_ids: the six program crates of this repo (Anchor.toml,
 * [programs.localnet] == [programs.devnet]) plus the two spec placeholders
 * (aof_cginv / aof_treasury) kept with programId = null so clients can never
 * mistake them for live addresses.
 * `key` is the symbolic/registry string (grep-friendly); `programId` is the
 * resolved address (null for placeholders); `status`/`rpcVerifiedAt` come
 * straight from the address registry.
 */
const ADDRESS_REGISTRY = require("../../watchtower/addresses.json");
const regProgram = name => ADDRESS_REGISTRY.programs.find(p => p.name === name);
const addressOf = name => regProgram(name).address;

const PROGRAM_ROLES = {
  aof_core: "core farming / crafting / player state",
  aof_market: "marketplace: listings, orders, escrow transfers",
  aof_quests: "quests: issuance, energy, claims",
  aof_rebirth: "rebirth: tool lifecycle, rebirth cycle",
  aof_liquidity: "liquidity: vault accounting",
  aof_session_keys: "session keys: spending disabled pending atomic CPI binding",
};

const PROGRAMS = Object.freeze([
  // aof_core keeps its canonical symbolic key (used by the session-keys
  // contract, PDA seeds and client code).
  Object.freeze({
    key: "AOF_CORE_PROGRAM_ID",
    symbolic: "AOF_CORE_PROGRAM_ID",
    alias: "aof_core",
    programId: addressOf("aof_core"),
    role: PROGRAM_ROLES.aof_core,
    status: regProgram("aof_core").status,
    rpcVerifiedAt: regProgram("aof_core").rpcVerifiedAt,
  }),
  ...ADDRESS_REGISTRY.programs
    .filter(p => p.name !== "aof_core")
    .map(p =>
      Object.freeze({
        key: p.address,
        symbolic: p.address,
        alias: p.name,
        programId: p.address,
        role: PROGRAM_ROLES[p.name] || p.name,
        status: p.status,
        rpcVerifiedAt: p.rpcVerifiedAt,
      })
    ),
  // [AUDIT AOF-H2] spec placeholders: no program crate under these names
  // exists in this repo and no deployed address has ever been verified.
  // address: null is load-bearing — clients must skip RPC probes for these.
  ...ADDRESS_REGISTRY.placeholders.map(p =>
    Object.freeze({
      key: p.symbol,
      symbolic: p.symbol,
      alias: p.name,
      programId: null,
      role: `${p.name}: ${p.reason.toLowerCase()}`,
      status: p.status,
      rpcVerifiedAt: null,
    })
  ),
]);

const PROGRAM_IDS = Object.freeze(PROGRAMS.map((p) => p.key));

/** Session Keys contract of AOF v3 (Identity). */
const SESSION_KEYS = Object.freeze({
  // [AUDIT AOF-H2] the real session-keys program address (Anchor.toml),
  // not the legacy spec placeholder.
  program: addressOf("aof_session_keys"),
  sessionKeysProgramId: addressOf("aof_session_keys"),
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
