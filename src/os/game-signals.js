"use strict";
/**
 * Game Signals ML config — GET /api/game-signals/config?gameId=aof.
 * Best free ML analytics: trained on 60M+ tx across 12 games.
 */
const { GAME, PROGRAM_IDS } = require("./config");

function gameSignalsConfig() {
  return {
    gameId: GAME.gameId,
    tenantId: GAME.tenantId,
    network: GAME.network,
    stage: GAME.stage,
    provider: "Game Signals",
    version: "v3",
    tier: "ideal-free",
    ml: {
      trainingCorpus: { transactions: "60M+", games: 12 },
      models: [
        {
          name: "churn-14d",
          label: "churn prediction, 14-day horizon",
          threshold: 0.85,
          thresholdNote: ">85% churn probability triggers win-back (Access drops, RitArena invites)",
          precision: 0.85,
        },
        { name: "funnel-common-wallets", label: "common wallets funnel (cross-game)" },
        { name: "ltv", label: "player LTV forecast" },
        { name: "cross-game-retention", label: "cross-game retention" },
      ],
    },
    feeds: ["farming", "crafting", "trading", "marketplace"],
    join: {
      gamesight: "solana_wallet -> external_id Late ID Binding",
      helika: "cross-game dashboard",
      watchtower: "finalized ledger events (aof-v1 parser)",
    },
    programIds: PROGRAM_IDS,
  };
}

module.exports = { gameSignalsConfig };
