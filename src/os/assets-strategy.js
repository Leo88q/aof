"use strict";
/**
 * Assets strategy — GET /api/assets/strategy?gameId=aof&itemType=…&rarity=…
 *
 * AOF v3 asset standard:
 *   common seeds / crops / materials        -> cNFT (Bubblegum v2, $110/M, Merkle Tree, MCC, Tensor primary)
 *   golden tools / land                     -> Standard NFT (Core Attributes: GrowthStage, Position)
 *   everything                              -> Core Attributes on-chain KV + Xandeum farming states
 */
const { GAME } = require("./config");

const ITEM_TYPES = ["common", "seed", "crop", "material", "tool", "golden_tool", "land"];
const RARITIES = ["common", "rare", "epic", "legendary"];

const STANDARD_NFT_TYPES = new Set(["golden_tool", "land"]);
const LEGENDARY_TOOLS = new Set(["tool"]);

function strategyFor(itemType = "common", rarity = "common") {
  const typeOk = ITEM_TYPES.includes(itemType);
  const rarityOk = RARITIES.includes(rarity);
  if (!typeOk || !rarityOk) {
    const err = new Error(
      `unsupported strategy query — itemType must be one of ${ITEM_TYPES.join("|")}, rarity one of ${RARITIES.join("|")}`
    );
    err.status = 400;
    throw err;
  }
  const standard =
    STANDARD_NFT_TYPES.has(itemType) ||
    (LEGENDARY_TOOLS.has(itemType) && rarity === "legendary");

  return {
    gameId: GAME.gameId,
    tenantId: GAME.tenantId,
    network: GAME.network,
    stage: GAME.stage,
    itemType,
    rarity,
    standard: standard ? "standard-nft" : "cNft",
    compression: standard
      ? { enabled: false, note: "golden tools / land keep full Standard NFT provenance" }
      : {
          enabled: true,
          protocol: "Bubblegum v2",
          merkleTree: true,
          mcc: true,
          mintCostUsdPerMillion: 110,
          note: "cNFT $110/M for common seeds/crops/materials",
        },
    marketplacePrimary: standard ? "Magic Eden" : "Tensor",
    marketplaceSecondary: standard ? "GameShift" : "Shyft escrow-less",
    attributes: standard
      ? ["GrowthStage", "Position", "Owner", "Item", "source_game", "is_cnft", "asset_id"]
      : ["GrowthStage", "Position", "source_game", "is_cnft", "asset_id"],
    coreAttributes: { readableByPrograms: true, dasReadMs: 5 },
    storage: { primary: "Xandeum", states: "farming states (GrowthStage/Position)" },
    monetization: standard
      ? ["Access stake-to-access", "GameShift USD"]
      : ["Gamba wager NFT", "idosgames RewardPool"],
  };
}

function strategyMatrix() {
  const rows = [];
  for (const itemType of ITEM_TYPES) {
    for (const rarity of RARITIES) rows.push(strategyFor(itemType, rarity));
  }
  return { gameId: GAME.gameId, total: rows.length, rows };
}

module.exports = { strategyFor, strategyMatrix, ITEM_TYPES, RARITIES };
