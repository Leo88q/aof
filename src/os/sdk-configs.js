"use strict";
/**
 * Watchtower OS v3 — SDK configuration registry.
 *
 * 14 SDK endpoints: godot-solana (base engine SDK) + 13 best-free v3 SDKs
 * (gamba, preset, ritarena, xandeum, pst, core-attributes, access-protocol,
 * idosgames-wallet, security-auditing-skill, sentio-cli, solguard,
 * solana-slam, arcium). Every endpoint accepts ?gameId=aof.
 */
const { GAME, PROGRAM_IDS, PROGRAMS, SESSION_KEYS, DEPIN, GAMBA } = require("./config");

const base = (sdk, extra) => ({
  gameId: GAME.gameId,
  tenantId: GAME.tenantId,
  network: GAME.network,
  stage: GAME.stage,
  sdk,
  version: "v3",
  tier: "ideal-free",
  programIds: PROGRAM_IDS,
  ...extra,
});

const GODOT_MODULES = Object.freeze([
  "SolanaClient",
  "WalletAdapter",
  "AnchorProgram",
  "CandyMachine",
  "SplBuilders",
  "SessionKeys",
]);

const GODOT_LAYERS = Object.freeze([
  "L1 Platform", "L2 Identity", "L3 Chain", "L4 Assets",
  "L5 Economy", "L6 Data", "L7 Ops",
]);

const GODOT_PRODUCTS = Object.freeze([
  "farming", "crafting", "trading", "marketplace", "inventory", "golden-tools-land",
  "session-wallet", "tournaments", "crop-fighters", "craft-gamble", "workers-depin",
  "cross-game-materials",
]);

const GODOT_V3_SDKS = Object.freeze([
  "gamba", "preset", "ritarena", "xandeum", "pst", "core-attributes",
  "access-protocol", "idosgames-wallet", "security-auditing-skill",
  "sentio-cli", "solguard", "solana-slam", "arcium",
]);

const SDKS = Object.freeze({
  "godot-solana": base("godot-solana", {
    engine: "Godot",
    description: "Godot detailed Solana SDK: SolanaClient, WalletAdapter, AnchorProgram, Candy Machine, SPL builders, session keys analog",
    modules: GODOT_MODULES,
    layers: GODOT_LAYERS,
    products: GODOT_PRODUCTS,
    v3Sdks: GODOT_V3_SDKS,
    project: "game/godot",
    sessionKeys: SESSION_KEYS,
    claudeSkill: { name: "godot-solana", path: ".claude/skills/godot-solana/SKILL.md" },
    securityAuditingSkill: { name: "security-auditing", path: ".claude/skills/security-auditing/SKILL.md" },
    unityMirror: "game/unity",
  }),
  gamba: base("gamba", {
    description: "Gamba craft-gamble: wager NFT, provably fair, house edge 5%, jackpot",
    program: "CgInv111...",
    wager: GAMBA.wager,
    provablyFair: GAMBA.provablyFair,
    houseEdgePercent: GAMBA.houseEdgePercent,
    jackpot: GAMBA.jackpot,
    templates: ["craft-gamble", "crop-duel"],
  }),
  preset: base("preset", {
    description: "Preset — best free OFFICIAL Solana game scaffold (chosen over create-solana-game)",
    official: true,
    template: "farming",
    templates: ["farming", "marketplace", "tournament"],
    chosenOver: "create-solana-game",
    includes: ["Anchor program scaffold", "backend worker", "client stubs", "tests"],
  }),
  ritarena: base("ritarena", {
    description: "RitArena — best free crop tournament arena (chosen over Aureus)",
    chosenOver: "Aureus",
    reason: "lifecycle + retry events, best free",
    lifecycle: { retryEvents: true, maxRetries: 5, backoffMs: [250, 1000, 4000, 16000, 60000] },
    tournament: { type: "crop", entry: "NFT fighter (Husks crop fighter)", reward: "rare crops + jackpot share" },
  }),
  xandeum: base("xandeum", {
    description: "Xandeum exabyte storage for cross-game materials + farming states",
    capacity: "exabyte",
    betterThan: "Arweave",
    reason: "mutable scalable game state at exabyte scale, best free scalable tier",
  }),
  pst: base("pst", {
    description: "PST — Private State Trees: private + verifiable player state",
    guarantees: ["privacy", "verifiability"],
    usedFor: ["private offers", "sealed craft recipes", "private balances"],
  }),
  "core-attributes": base("core-attributes", {
    description: "Core Attributes — on-chain key-value attributes readable by programs",
    dasReadMs: 5,
    attributes: ["GrowthStage", "Position", "Owner", "Item", "source_game", "is_cnft", "asset_id"],
    appliesTo: ["golden tools", "land Standard NFT", "crop NFT states"],
  }),
  "access-protocol": base("access-protocol", {
    description: "Access Protocol stake-to-access for gated content",
    gated: ["rare crops", "golden tools", "land"],
    mechanic: "stake-to-access",
  }),
  "idosgames-wallet": base("idosgames-wallet", {
    description: "idosgames wallet + EVM<->Solana bridge + RewardPool",
    bridge: { from: "EVM", to: "Solana", rewards: "RewardPool" },
    linkedWallets: true,
  }),
  "security-auditing-skill": base("security-auditing-skill", {
    description: "Security Auditing Skill — systematic audit, best free security skill",
    skillPath: ".claude/skills/security-auditing/SKILL.md",
    coverage: ["co-sign review", "PDA seeds", "allowed_ixs mask", "RLS tenant_id", "idempotency", "replay"],
  }),
  "sentio-cli": base("sentio-cli", {
    description: "Sentio CLI — tracing + anomaly pipelines for on-chain flows",
    checks: ["tx tracing", "entity flows", "alert rules"],
  }),
  solguard: base("solguard", {
    description: "SolGuard — 130+ Solana security checks (best free, chosen over SolShield)",
    chosenOver: "SolShield",
    checks: 130,
  }),
  "solana-slam": base("solana-slam", {
    description: "SLAM — LiteSVM program test harness",
    runtime: "LiteSVM",
    suites: ["plant/harvest", "craft", "gamba commit-reveal", "session keys spend"],
  }),
  arcium: base("arcium", {
    description: "Arcium confidential compute for private game logic",
    circuits: ["private craft", "sealed-bid offer", "confidential tournament seed"],
  }),
});

const SDK_IDS = Object.freeze(Object.keys(SDKS));

function getSdk(id) {
  return SDKS[id] || null;
}

module.exports = { SDKS, SDK_IDS, GODOT_MODULES, GODOT_LAYERS, GODOT_PRODUCTS, GODOT_V3_SDKS, getSdk };
