"use strict";
/**
 * Watchtower OS v3 — Infra component configs (GET /api/infra/*?gameId=aof).
 * ARC Entity-Component + Bolt FOCG + DePIN + Rust Actix + storage/privacy
 * providers + Preset + Access + idosgames.
 */
const { GAME, PROGRAM_IDS, DEPIN, CROSS_GAME } = require("./config");

const base = (id, extra) => ({
  gameId: GAME.gameId,
  tenantId: GAME.tenantId,
  network: GAME.network,
  stage: GAME.stage,
  infra: id,
  version: "v3",
  tier: "ideal-free",
  programIds: PROGRAM_IDS,
  ...extra,
});

const INFRA = Object.freeze({
  arc: base("arc", {
    description: "ARC Entity-Component model for AOF farming state",
    entities: [
      { name: "crop", fields: ["asset_id", "is_cnft", "source_game", "GrowthStage", "Position"] },
      { name: "plot", fields: ["asset_id", "is_cnft", "source_game", "Position", "Owner", "Item"] },
    ],
    components: ["Position", "GrowthStage", "Owner", "Item"],
    systems: ["harvest", "craft"],
    entityFields: { source_game: "aof", is_cnft: true, asset_id: "<mint or leaf>" },
  }),
  bolt: base("bolt", {
    description: "Bolt FOCG (Fully On-Chain Game) ECS for farming",
    entities: ["Plot", "Crop", "Player"],
    systems: ["plant", "harvest"],
    tick: "deterministic",
  }),
  depin: base("depin", {
    description: "DePIN crafting-market workers",
    workerStakeSol: DEPIN.workerStakeSol,
    escrowSolPer100Players: DEPIN.escrowSolPer100Players,
    reward: DEPIN.reward,
    slash: DEPIN.slash,
    program: "STrEaSuRy111...",
  }),
  actix: base("actix", {
    description: "Rust Actix high-performance gateway (stage prototype)",
    entry: "src/os/actix-gateway/src/main.rs",
    routes: ["/api/os/config", "/api/assets/strategy", "/api/game-signals/config"],
  }),
  preset: base("preset", {
    description: "Preset official scaffold (chosen over create-solana-game)",
    template: "farming",
    official: true,
    chosenOver: "create-solana-game",
  }),
  xandeum: base("xandeum", { description: "Xandeum exabyte storage", capacity: "exabyte", betterThan: "Arweave" }),
  pst: base("pst", { description: "PST private + verifiable state", guarantees: ["privacy", "verifiability"] }),
  "core-attributes": base("core-attributes", {
    description: "Core Attributes on-chain key-value",
    attributes: ["GrowthStage", "Position", "Owner", "Item"],
    dasReadMs: 5,
  }),
  arcium: base("arcium", { description: "Arcium confidential compute", circuits: ["private craft", "sealed-bid offer"] }),
  access: base("access", { description: "Access Protocol stake-to-access", gated: ["rare crops", "golden tools", "land"] }),
  idosgames: base("idosgames", { description: "idosgames EVM<->Solana bridge + RewardPool", bridge: true, rewardPool: true }),
  crossgame: base("crossgame", {
    description: "Cross-game PDA studio_profile + linked wallets + материалы RLS",
    studioPda: CROSS_GAME.studioPda,
    arcEntityIds: CROSS_GAME.arcEntityIds,
    boltEntityIds: CROSS_GAME.boltEntityIds,
    linkedWallets: CROSS_GAME.linkedWallets,
    materials: CROSS_GAME.materials,
  }),
  overview: base("overview", {
    description: "AOF v3 infra overview",
    components: ["arc", "bolt", "depin", "actix", "preset", "xandeum", "pst", "core-attributes", "arcium", "access", "idosgames", "crossgame"],
  }),
});

const INFRA_IDS = Object.freeze(Object.keys(INFRA));

module.exports = { INFRA, INFRA_IDS };
