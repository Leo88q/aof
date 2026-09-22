"use strict";
/**
 * Watchtower OS v3 — 19 control panels (src/os/control-panels-v3.js).
 *
 * Each panel groups the operator controls of one ideal-free-stack domain:
 * view (read-only telemetry) and act (guarded operations). Panels map 1:1 to
 * the33 stack components via `components: [componentId]`.
 */
const P = (id, n, title, category, components, controls, endpoints) =>
  Object.freeze({ id, n, title, category, components, controls, endpoints });

const CONTROL_PANELS_V3 = Object.freeze([
  P("identity-session-keys", 1, "Identity & Session Keys", "identity",
    ["privy", "phantom-firststep", "altude", "session-keys"],
    ["view sessions", "createSession(AOF_CORE_PROGRAM_ID)", "topUp 0.01 SOL", "expire 60 min", "revoke session"],
    ["/api/sdk/godot-solana"]),
  P("assets-cnft", 2, "Assets — cNFT Bubblegum v2", "assets",
    ["cnft-bubblegum"],
    ["view Merkle tree", "mint cNFT $110/M", "MCC verify", "list on Tensor"],
    ["/api/assets/strategy"]),
  P("core-attributes-growth", 3, "Core Attributes & Growth", "assets",
    ["core-attributes"],
    ["read GrowthStage", "read/write Position", "DAS stats 5ms", "attribute audit"],
    ["/api/sdk/core-attributes"]),
  P("storage-xandeum", 4, "Storage — Xandeum", "storage",
    ["xandeum"],
    ["store farming states", "store cross-game материалы", "replication view"],
    ["/api/sdk/xandeum", "/api/infra/xandeum"]),
  P("privacy-pst-arcium", 5, "Privacy — PST + Arcium", "privacy",
    ["pst", "arcium"],
    ["seal state (PST)", "confidential craft (Arcium)", "verify proof"],
    ["/api/sdk/pst", "/api/sdk/arcium"]),
  P("indexer-laserstream", 6, "Indexer — LaserStream", "indexer",
    ["laserstream"],
    ["subscribe gRPC", "lag watch", "replay window"],
    ["/api/infra/overview"]),
  P("indexer-shyft", 7, "Indexer — Shyft", "indexer",
    ["shyft"],
    ["gPA 15ms parse", "webhook TOKEN_MINT", "webhook NFT_MINT", "escrow-less order"],
    ["/api/infra/overview"]),
  P("indexer-postgres", 8, "Indexer — PG/Timescale/Redis", "indexer",
    ["postgres-timescale-redis"],
    ["idempotency keys", "gap backfill", "finalized reconciliation"],
    ["/api/infra/overview"]),
  P("l2-sonic-hypergrid", 9, "L2 — Sonic HyperGrid", "l2",
    ["sonic-hypergrid"],
    ["farm tick lane", "settlement view"],
    ["/api/infra/overview"]),
  P("l2-magicblock", 10, "L2 — MagicBlock ER + REPLA", "l2",
    ["magicblock-er"],
    ["delegate", "executeGasless", "commit state", "Magic Action auto-harvest", "REPLA L3 settle"],
    ["/api/infra/overview"]),
  P("analytics-helika", 11, "Analytics — Helika", "analytics",
    ["helika"],
    ["cross-game dashboard", "funnel view"],
    ["/api/game-signals/config"]),
  P("analytics-gamesight", 12, "Analytics — GameSight", "analytics",
    ["gamesight"],
    ["Late ID Binding", "ad attribution"],
    ["/api/game-signals/config"]),
  P("analytics-game-signals", 13, "Analytics — Game Signals ML", "analytics",
    ["game-signals-ml"],
    ["churn-14d score", "common wallets funnel", "LTV", "cross-game retention"],
    ["/api/game-signals/config"]),
  P("marketplace", 14, "Marketplace — ME / Shyft / GameShift / Tensor", "marketplace",
    ["magic-eden", "shyft", "gameshift", "tensor"],
    ["list/delist", "ME 120 QPM throttle", "GameShift USD checkout", "Tensor cNFT listing"],
    ["/api/assets/strategy"]),
  P("gamba-gamble", 15, "Gamba — Craft Gamble", "marketplace",
    ["gamba"],
    ["open wager NFT", "commit-reveal", "house edge 5% audit", "jackpot view"],
    ["/api/sdk/gamba"]),
  P("tournaments-arenas", 16, "Tournaments — Husks + RitArena", "marketplace",
    ["husks", "ritarena"],
    ["crop fighter register", "crop tournament bracket", "lifecycle retry events", "anti-Aureus lock"],
    ["/api/sdk/ritarena"]),
  P("monetization", 17, "Monetization — Access / idosgames / GameShift / Gamba", "monetization",
    ["access-protocol", "idosgames", "gameshift", "gamba"],
    ["stake-to-access drops", "RewardPool", "USD items", "jackpot accrual"],
    ["/api/sdk/access-protocol", "/api/sdk/idosgames-wallet"]),
  P("security-testing", 18, "Security & Testing — Skill / Sentio / SolGuard / SLAM / Preset", "security",
    ["security-stack", "testing-stack"],
    ["systematic audit skill run", "Sentio trace", "SolGuard 130+ scan", "SLAM LiteSVM suite", "Preset e2e"],
    ["/api/sdk/security-auditing-skill", "/api/sdk/sentio-cli", "/api/sdk/solguard", "/api/sdk/solana-slam", "/api/sdk/preset"]),
  P("infra-ecs-depin", 19, "Infra — ARC / Bolt / DePIN / Actix + Agents + Cross-Chain", "infra",
    ["infra-stack", "relayzero", "stealthsdk", "race", "unity", "godot"],
    ["ARC entity ops", "Bolt plant/harvest", "DePIN stake 10 SOL / escrow / slash", "agent handoff (handoff-v3)", "RACE + idosgames linked wallets", "client build gate"],
    ["/api/infra/arc", "/api/infra/bolt", "/api/infra/depin", "/api/infra/actix", "/api/os/handoff"]),
]);

const PANELS_TOTAL = CONTROL_PANELS_V3.length; // 19

function getPanel(id) {
  return CONTROL_PANELS_V3.find((p) => p.id === id) || null;
}

function panelsByCategory() {
  const out = {};
  for (const p of CONTROL_PANELS_V3) (out[p.category] ||= []).push(p.id);
  return out;
}

module.exports = { CONTROL_PANELS_V3, PANELS_TOTAL, getPanel, panelsByCategory };
