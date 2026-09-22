"use strict";
/**
 * Watchtower OS v3 — Ideal Free Stack: 33 deduplicated components.
 *
 * Same composition as ARES-1. Per-category "ideal free" choices were merged
 * into one component list where the spec itself groups products (Security
 * Skill + Sentio + SolGuard, Testing SLAM + Preset, Infra ARC + Bolt + DePIN +
 * Rust Actix); cross-listed products (Xandeum, PST, Core Attributes, Shyft,
 * Arcium, Gamba, Husks, RitArena, Access, idosgames, GameShift, RACE) are
 * counted exactly once at their primary category.
 *
 * Dedup decisions (spec-mandated):
 *   create-solana-game → Preset        (best free official scaffold)
 *   Aureus            → RitArena      (lifecycle retry events, best free)
 *   SolShield         → SolGuard      (130+ checks, best free)
 */

const VERSION = "v3";
const TOTAL = 33;

const DEDUP_DECISIONS = Object.freeze([
  Object.freeze({
    kept: "Preset",
    dropped: "create-solana-game",
    reason: "Preset is the best free OFFICIAL Solana game scaffold (farming template)",
  }),
  Object.freeze({
    kept: "RitArena",
    dropped: "Aureus",
    reason: "RitArena lifecycle + retry events, best free arena; chosen over Aureus",
  }),
  Object.freeze({
    kept: "SolGuard",
    dropped: "SolShield",
    reason: "SolGuard 130+ checks, best free security scanner; chosen over SolShield",
  }),
]);

const C = (id, n, name, category, products, integration, endpoints, panel) =>
  Object.freeze({ id, n, name, category, tier: "ideal-free", products, integration, endpoints, panel });

const COMPONENTS = Object.freeze([
  // ── Identity (4) ──────────────────────────────────────────────────────────
  C("privy", 1, "Privy", "identity",
    ["Privy"],
    "Guest login + embedded wallet + gas sponsorship, auto cross-game link of материалы (RLS tenant_id aof, materialized view mv_cross_game_materials_aof)",
    ["/api/sdk/godot-solana", "/api/os/config"], "identity-session-keys"),
  C("phantom-firststep", 2, "Phantom FirstStep", "identity",
    ["Phantom FirstStep"],
    "FirstStep onboarding: browser/mobile Phantom wallet connect for returning players",
    ["/api/sdk/godot-solana"], "identity-session-keys"),
  C("altude", 3, "Altude", "identity",
    ["Altude"],
    "Altude identity bridge (embedded -> external wallet migration)",
    ["/api/sdk/godot-solana"], "identity-session-keys"),
  C("session-keys", 4, "Session Keys", "identity",
    ["Session Keys"],
    "createSession(AOF_CORE_PROGRAM_ID), topUp 0.01 SOL, expiry 60 min; FORBIDDEN_IXS_MASK blocks withdraw/transfer/payout; SessKeys111...",
    ["/api/sdk/godot-solana", "/api/infra/overview"], "identity-session-keys"),

  // ── Assets (2) + Storage (1) ─────────────────────────────────────────────
  C("cnft-bubblegum", 5, "cNFT Bubblegum v2", "assets",
    ["cNFT Bubblegum v2"],
    "common seeds/crops/materials as compressed NFTs: $110/M, Bubblegum v2 Merkle Tree, MCC, Tensor primary listing",
    ["/api/assets/strategy"], "assets-cnft"),
  C("core-attributes", 6, "Core Attributes", "assets",
    ["Core Attributes"],
    "on-chain key-value attributes (GrowthStage, Position, farming states) readable by any program; DAS 5ms stats; golden tools + land as Standard NFT",
    ["/api/sdk/core-attributes", "/api/assets/strategy"], "core-attributes-growth"),
  C("xandeum", 7, "Xandeum", "storage",
    ["Xandeum"],
    "exabyte-scalable storage for cross-game материалы + farming states; better than Arweave for mutable game data",
    ["/api/sdk/xandeum", "/api/infra/xandeum"], "storage-xandeum"),

  // ── Indexer (3) ──────────────────────────────────────────────────────────
  C("laserstream", 8, "LaserStream", "indexer",
    ["LaserStream"],
    "gRPC Yellowstone-class stream for AOF_CORE_PROGRAM_ID + CgInv + SessKeys + STrEaSuRy",
    ["/api/infra/overview"], "indexer-laserstream"),
  C("shyft", 9, "Shyft", "indexer",
    ["Shyft"],
    "gPA 15ms parses + webhooks (TOKEN_MINT, NFT_MINT) + escrow-less marketplace API (120 QPM-class)",
    ["/api/infra/overview", "/api/assets/strategy"], "indexer-shyft"),
  C("postgres-timescale-redis", 10, "PostgreSQL + TimescaleDB + Redis", "indexer",
    ["PostgreSQL TimescaleDB Redis"],
    "ledger store: idempotency keys, gap backfill, finalized reconciliation (see watchtower/ migrations)",
    ["/api/infra/overview"], "indexer-postgres"),

  // ── L2 (2) ───────────────────────────────────────────────────────────────
  C("sonic-hypergrid", 11, "Sonic HyperGrid", "l2",
    ["Sonic HyperGrid"],
    "game-SVM L2 for high-frequency farm ticks",
    ["/api/infra/overview"], "l2-sonic-hypergrid"),
  C("magicblock-er", 12, "MagicBlock ER + REPLA", "l2",
    ["MagicBlock ER REPLA"],
    "Ephemeral Rollups sub-10ms gasless: delegate -> executeGasless -> commit state; Magic Actions auto-harvest; REPLA L3 Anchor settle on MagicBlock sequencer",
    ["/api/infra/overview"], "l2-magicblock"),

  // ── Privacy (2) ──────────────────────────────────────────────────────────
  C("arcium", 13, "Arcium", "privacy",
    ["Arcium"],
    "confidential compute (private craft recipes, sealed-bid offers) — ideal free privacy",
    ["/api/sdk/arcium", "/api/infra/arcium"], "privacy-pst-arcium"),
  C("pst", 14, "PST", "privacy",
    ["PST"],
    "Private State Trees: private + verifiable player state — ideal free privacy/storage",
    ["/api/sdk/pst", "/api/infra/pst"], "privacy-pst-arcium"),

  // ── Analytics (3) ────────────────────────────────────────────────────────
  C("helika", 15, "Helika", "analytics",
    ["Helika"],
    "cross-game dashboard (farming crafting trading marketplace funnels)",
    ["/api/game-signals/config"], "analytics-helika"),
  C("gamesight", 16, "GameSight", "analytics",
    ["GameSight"],
    "solana_wallet -> external_id Late ID Binding, ad -> on-chain attribution",
    ["/api/game-signals/config"], "analytics-gamesight"),
  C("game-signals-ml", 17, "Game Signals ML", "analytics",
    ["Game Signals ML"],
    "ML on 60M+ tx across 12 games: churn 14d >85%, common-wallets funnel, LTV, cross-game retention",
    ["/api/game-signals/config"], "analytics-game-signals"),

  // ── Marketplace (9) ──────────────────────────────────────────────────────
  C("magic-eden", 18, "Magic Eden", "marketplace",
    ["Magic Eden"],
    "ME listings API 120 QPM for Standard NFTs (golden tools, land)",
    ["/api/assets/strategy"], "marketplace"),
  C("gameshift", 19, "GameShift", "marketplace",
    ["GameShift"],
    "USD 170+ items fiat-rails + custodial checkout (monetization)",
    ["/api/assets/strategy"], "monetization"),
  C("tensor", 20, "Tensor", "marketplace",
    ["Tensor"],
    "primary marketplace for cNFT $110/M assets (MCC-aware)",
    ["/api/assets/strategy"], "marketplace"),
  C("gamba", 21, "Gamba", "marketplace",
    ["Gamba"],
    "crafting gamble: wager NFT, provably fair commit-reveal, house edge 5%, jackpot (CgInv111...)",
    ["/api/sdk/gamba"], "gamba-gamble"),
  C("husks", 22, "Husks", "marketplace",
    ["Husks"],
    "crop fighters arena + AI fighter agents",
    ["/api/sdk/ritarena", "/api/os/config"], "tournaments-arenas"),
  C("ritarena", 23, "RitArena", "marketplace",
    ["RitArena"],
    "crop tournaments with lifecycle + retry events (best free arena, chosen over Aureus)",
    ["/api/sdk/ritarena"], "tournaments-arenas"),
  C("race", 24, "RACE", "cross-chain",
    ["RACE"],
    "multichain tournament infrastructure + linked wallets for cross-game identity",
    ["/api/os/handoff"], "cross-chain"),
  C("access-protocol", 25, "Access Protocol", "monetization",
    ["Access Protocol"],
    "stake-to-access gated drops: rare crops, golden tools, land",
    ["/api/sdk/access-protocol"], "monetization"),
  C("idosgames", 26, "idosgames", "cross-chain",
    ["idosgames"],
    "EVM <-> Solana bridge + RewardPool + idosgames-wallet linked accounts (cross-chain)",
    ["/api/sdk/idosgames-wallet"], "cross-chain"),

  // ── Engines (2) ──────────────────────────────────────────────────────────
  C("unity", 27, "Unity", "engines",
    ["Unity"],
    "Unity client: 7 layers + 12 products + 13 v3 SDK bindings (game/unity)",
    ["/api/sdk/godot-solana"], "engines-clients"),
  C("godot", 28, "Godot", "engines",
    ["Godot"],
    "Godot detailed SDK: SolanaClient, WalletAdapter, AnchorProgram, Candy Machine, SPL builders, session keys analog (game/godot)",
    ["/api/sdk/godot-solana"], "engines-clients"),

  // ── AI Agents (2) ────────────────────────────────────────────────────────
  C("relayzero", 29, "relayzero", "agents",
    ["relayzero"],
    "agent relay runtime for auto-harvest / auto-list agents",
    ["/api/os/handoff"], "ai-agents"),
  C("stealthsdk", 30, "StealthSDK", "agents",
    ["StealthSDK"],
    "stealth agent SDK (private automation via Arcium/PST paths)",
    ["/api/os/handoff"], "ai-agents"),

  // ── Security (1 grouped) / Testing (1 grouped) / Infra (1 grouped) ───────
  C("security-stack", 31, "Security Skill + Sentio + SolGuard", "security",
    ["Security Auditing Skill", "Sentio", "SolGuard"],
    "systematic audit Claude Skill + Sentio CLI tracing + SolGuard 130+ checks (best free, chosen over SolShield)",
    ["/api/sdk/security-auditing-skill", "/api/sdk/sentio-cli", "/api/sdk/solguard"], "security-testing"),
  C("testing-stack", 32, "SLAM + Preset", "testing",
    ["SLAM", "Preset"],
    "SLAM LiteSVM program tests + Preset official scaffold e2e (chosen over create-solana-game)",
    ["/api/sdk/solana-slam", "/api/sdk/preset"], "security-testing"),
  C("infra-stack", 33, "ARC + Bolt + DePIN + Rust Actix", "infra",
    ["ARC", "Bolt", "DePIN", "Rust Actix"],
    "ARC Entity-Component (crop/plot, Position, GrowthStage, Owner, Item) + Bolt FOCG (Plot, Crop, Player; plant, harvest) + DePIN workers (stake 10 SOL, escrow 0.1 SOL per 100 players, reward/slash) + Rust Actix high-performance gateway",
    ["/api/infra/arc", "/api/infra/bolt", "/api/infra/depin", "/api/infra/actix"], "infra-ecs-depin"),
]);

/** product name -> component id (every named product of the AOF v3 spec). */
const PRODUCT_INDEX = Object.freeze(
  COMPONENTS.reduce((acc, c) => {
    for (const p of c.products) acc[p] = c.id;
    return acc;
  }, Object.create(null))
);

function componentsByCategory() {
  const out = {};
  for (const c of COMPONENTS) (out[c.category] ||= []).push(c.id);
  return out;
}

module.exports = {
  VERSION,
  TOTAL,
  COMPONENTS,
  PRODUCT_INDEX,
  DEDUP_DECISIONS,
  componentsByCategory,
};
