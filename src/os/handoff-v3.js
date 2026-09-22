"use strict";
/**
 * Watchtower OS v3 — handoff (src/os/handoff-v3.js).
 *
 * Two handoff surfaces:
 *  1. cross-game handoff — PDA studio_profile, ARC Entity IDs, Bolt entity IDs,
 *     cross-chain linked wallets (RACE + idosgames bridge), cross-game
 *     материалы (ARC Entity-Component + Core Attributes + Xandeum, RLS
 *     tenant_id aof, materialized view mv_cross_game_materials_aof);
 *  2. agent/engine handoff — Husks, RitArena, relayzero, StealthSDK, Unity,
 *     Godot <- -> Watchtower OS, with the 20-point final report builder used
 *     by FINAL_REPORT_V3.md.
 */
const { GAME, PROGRAM_IDS, CROSS_GAME, SESSION_KEYS } = require("./config");

const HANDOFF_PROTOCOL = Object.freeze({
  id: "handoff-v3",
  version: "v3",
  rule: "every handoff is idempotent (handoffId = sha256(gameId|from|to|payloadHash)) and retry-safe: lifecycle + retry events, max 5 retries, exponential backoff — RitArena semantics",
  maxRetries: 5,
  backoffMs: [250, 1000, 4000, 16000, 60000],
});

const AGENTS = Object.freeze([
  Object.freeze({ id: "husks", kind: "crop-fighters", role: "crop fighter agents (NFT fighters)" }),
  Object.freeze({ id: "ritarena", kind: "tournament", role: "crop tournament orchestrator (chosen over Aureus)" }),
  Object.freeze({ id: "relayzero", kind: "relay", role: "auto-harvest / auto-list relay agents" }),
  Object.freeze({ id: "stealthsdk", kind: "stealth", role: "private automation agents (Arcium/PST paths)" }),
]);

const ENGINES = Object.freeze([
  Object.freeze({ id: "unity", path: "game/unity" }),
  Object.freeze({ id: "godot", path: "game/godot" }),
]);

/** Cross-game handoff envelope. */
function crossGameHandoff() {
  return {
    studioPda: CROSS_GAME.studioPda,
    arcEntityIds: CROSS_GAME.arcEntityIds,
    boltEntityIds: CROSS_GAME.boltEntityIds,
    linkedWallets: {
      providers: CROSS_GAME.linkedWallets,
      bridge: "idosgames EVM<->Solana + RewardPool",
      multichain: "RACE",
    },
    materials: CROSS_GAME.materials,
    sessionKeys: SESSION_KEYS,
  };
}

/** Full handoff manifest for gameId (default aof). */
function buildHandoff() {
  return {
    gameId: GAME.gameId,
    tenantId: GAME.tenantId,
    network: GAME.network,
    stage: GAME.stage,
    protocol: HANDOFF_PROTOCOL,
    programIds: PROGRAM_IDS,
    crossGame: crossGameHandoff(),
    agents: AGENTS,
    engines: ENGINES,
    artifacts: [
      "WATCHTOWER_INTEGRATION.md",
      "docs/WATCHTOWER_OS_V3.md",
      "FINAL_REPORT_V3.md",
      "src/os/sql/cross_game_materials.sql",
    ],
  };
}

/**
 * Final report — exactly 20 пунктов (kept in sync with FINAL_REPORT_V3.md).
 */
const FINAL_REPORT_POINTS = Object.freeze([
  "Watchtower OS v3 Ideal Free Stack принят для tenant/game aof: 33 дедуплицированных компонента (src/os/stack-v3.js, GET /api/os/config).",
  "Дедупликация зафиксирована: Preset > create-solana-game (official), RitArena > Aureus (lifecycle retry events), SolGuard > SolShield (130+).",
  "Identity: Privy (guest, embedded wallet, gas sponsorship, auto cross-game), Phantom FirstStep, Altude, Session Keys — createSession(AOF_CORE_PROGRAM_ID), topUp 0.01 SOL, expiry 60 мин, FORBIDDEN_IXS_MASK.",
  "Identity/материалы: RLS tenant_id = 'aof' + materialized view mv_cross_game_materials_aof (src/os/sql/cross_game_materials.sql).",
  "Assets: common seeds/crops/materials → cNFT $110/M (Bubblegum v2 Merkle Tree, MCC, Tensor primary); golden tools + land → Standard NFT.",
  "Assets: GrowthStage + Position через Core Attributes on-chain key-value, читаемые программами, DAS 5ms; farming states в Xandeum (exabyte, лучше Arweave).",
  "Assets strategy API: GET /api/assets/strategy?gameId=aof&itemType=common&rarity=common + полная матрица itemType×rarity.",
  "Infra: ARC Entity (crop, plot) + Components (Position, GrowthStage, Owner, Item) + fields source_game=aof, is_cnft, asset_id + Systems harvest, craft.",
  "Infra: Bolt FOCG — Plot, Crop, Player, systems plant, harvest; детерминированный tick.",
  "Infra: DePIN crafting-market workers — stake 10 SOL, escrow 0.1 SOL на 100 игроков, reward за job, slash за сбой; Rust Actix gateway (stage prototype).",
  "L2: MagicBlock ER sub-10ms gasless — delegate → executeGasless → commit state, Magic Actions auto-harvest, REPLA L3 Anchor settle на MagicBlock sequencer; Sonic HyperGrid для farm ticks.",
  "Privacy: PST (private + verifiable) + Arcium (confidential craft, sealed-bid offers) — ideal free L2/privacy/storage связка с Xandeum.",
  "Indexer: LaserStream gRPC по AOF_CORE_PROGRAM_ID + CgInv + SessKeys + STrEaSuRy; Shyft gPA 15ms + callbacks TOKEN_MINT/NFT_MINT; PG + TimescaleDB + Redis: идемпотентность, gap backfill, finalized reconciliation.",
  "Analytics: Helika cross-game dashboard + GameSight (solana_wallet→external_id, Late ID Binding, ad→on-chain) + Game Signals ML (60M+ tx, 12 games, churn 14d >85%, common wallets funnel, LTV, cross-game retention).",
  "Marketplace: ME 120 QPM + Shyft escrow-less + GameShift USD 170+ + Tensor (cNFT primary) + Gamba (wager NFT, provably fair, house edge 5%, jackpot) + Husks + RitArena + RACE + Access (stake-to-access) + idosgames (bridge).",
  "Engines: Unity/Godot project — v1 7 layers + v2 12 products + v3 13 best-free SDK; Godot detailed SDK (SolanaClient, WalletAdapter, AnchorProgram, Candy Machine, SPL builders, session keys analog) + Claude Skill + Security Auditing Skill.",
  "AI Agents: Husks crop fighters + RitArena crop tournament (lifecycle retry events) + relayzero + StealthSDK; handoff-v3 с идемпотентными handoffId и retry-политикой.",
  "Cross-chain/cross-game: PDA studio_profile, ARC Entity IDs, Bolt entity IDs, linked wallets RACE + idosgames bridge, cross-game материалы (ARC Entity-Component + Core Attributes + Xandeum).",
  "API проверки: /api/os/config (v3, 33), /api/sdk/* (14 SDK), /api/infra/* , /api/game-signals/config, /api/assets/strategy, /api/os/control-panels (19), /api/os/handoff, /api/os/final-report — все с ?gameId=aof.",
  "Tests + Runtime smoke devnet + Docs: node:test suite (src/os/tests), smoke-devnet.js (API + devnet RPC probe), WATCHTOWER_INTEGRATION.md + docs/WATCHTOWER_OS_V3.md + FINAL_REPORT_V3.md (20 пунктов).",
]);

function buildFinalReport() {
  return {
    gameId: GAME.gameId,
    tenantId: GAME.tenantId,
    network: GAME.network,
    stage: GAME.stage,
    title: "AOF v3 — финальный отчёт (20 пунктов)",
    total: FINAL_REPORT_POINTS.length, // 20
    points: FINAL_REPORT_POINTS.map((text, i) => ({ n: i + 1, text })),
    document: "FINAL_REPORT_V3.md",
    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  HANDOFF_PROTOCOL,
  AGENTS,
  ENGINES,
  crossGameHandoff,
  buildHandoff,
  FINAL_REPORT_POINTS,
  buildFinalReport,
};
