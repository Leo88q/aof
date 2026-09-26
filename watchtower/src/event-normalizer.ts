/**
 * AOF → Watchtower event normalizer.
 *
 * Pure module: maps one decoded on-chain AOF event (as stored in
 * ChainEvent by the chain indexer) to zero or more canonical Watchtower
 * events from events/event-types.json. No DB, no RPC, so the mapping is
 * unit-testable from fixtures and replayable byte-for-byte.
 *
 * Rules
 *  - Never invent data. If AOF has no on-chain notion of something
 *    (sessions, matches, races, admin proposals) it is NOT emitted here;
 *    the manifest lists such types as `unsupported`.
 *  - One AOF event may fan out (ListingSold → PurchaseCompleted +
 *    PaymentSettled + AssetTransferred). Each output gets a stable
 *    `eventId` = `${signature}:${eventIndex}:${n}` so replays dedupe.
 *  - Player identity is exposed only as `playerId = sha256(SALT|wallet)`
 *    with the cross-game WATCHTOWER_PLAYER_HASH_SALT; raw wallets never
 *    leave the exporter.
 *  - `confidence` is "finalized" for everything the indexer stores (it
 *    reads at finalized commitment only) and "derived" for events the
 *    exporter computes (PlayerJoined/FirstAction, RetentionDayN).
 */
import { createHash } from "node:crypto";

export const PARSER_VERSION = "aof-v1" as const;

export type ChainEventRow = {
  signature: string;
  eventIndex: number;
  slot: bigint | number | string;
  blockTime: Date | string | null;
  programId: string;
  eventType: string;
  wallet: string | null;
  mint: string | null;
  amount: string | null;
  success: boolean;
  data: Record<string, unknown> | string;
};

export type WatchtowerEvent = {
  eventId: string;
  gameId: "aof";
  type: string;
  category: "players" | "gameplay" | "economy" | "security" | "reliability";
  occurredAt: string | null;
  slot: string;
  signature: string;
  playerId: string | null;
  counterpartyId?: string | null;
  asset?: string | null;
  amount?: string | null;
  currency?: string | null;
  confidence: "finalized" | "derived";
  parserVersion: typeof PARSER_VERSION;
  source: { program: string; event: string; eventIndex: number };
  attributes: Record<string, unknown>;
};

export function hashPlayer(wallet: string, salt: string): string {
  return createHash("sha256").update(`${salt}|${wallet}`).digest("hex");
}

const CATEGORY: Record<string, WatchtowerEvent["category"]> = {
  WalletConnected: "players", PlayerJoined: "players", SessionStarted: "players", SessionEnded: "players", FirstAction: "players",
  RetentionDay1: "players", RetentionDay3: "players", RetentionDay7: "players", RetentionDay14: "players", RetentionDay30: "players",
  MatchStarted: "gameplay", MatchFinished: "gameplay", RaceStarted: "gameplay", RaceFinished: "gameplay", QuestCompleted: "gameplay",
  CraftCompleted: "gameplay", AssetCreated: "gameplay", AssetTransferred: "gameplay", PackOpened: "gameplay", FusionCompleted: "gameplay",
  StakeStarted: "gameplay", StakeEnded: "gameplay",
  PlotCreated: "gameplay", PlotPlanted: "gameplay", CropHarvested: "gameplay",
  ResourceMinted: "economy", ResourceBurned: "economy", MarketOrderPlaced: "economy", MarketOrderCancelled: "economy", SecurityEvent: "security",
  PurchaseCompleted: "economy", PaymentSettled: "economy", RewardGranted: "economy", RewardClaimed: "economy", RewardQuarantined: "economy",
  TokenMinted: "economy", TokenBurned: "economy", TreasuryDeposited: "economy", TreasuryWithdrawn: "economy", LiabilityCreated: "economy", LiabilitySettled: "economy",
  AuthorityChanged: "security", ConfigUpdated: "security", PausedToggled: "security", EmergencyPause: "security",
  AdminProposalCreated: "security", AdminProposalApproved: "security", AdminProposalExecuted: "security", FraudSignalCreated: "security", PlayerQuarantined: "security",
  TransactionSubmitted: "reliability", TransactionConfirmed: "reliability", TransactionFinalized: "reliability", TransactionFailed: "reliability",
  TransactionExpired: "reliability", RpcError: "reliability", IndexerGapDetected: "reliability", IndexerGapHealed: "reliability",
};

export const EVENT_TYPES = Object.keys(CATEGORY);

/** Which Watchtower types this game can emit natively from chain data. */
export const SUPPORTED_NATIVE: Record<string, string[]> = {
  PurchaseCompleted: ["ListingSold", "OfferAccepted", "AuctionSettled", "HotMarketBought", "LotteryTicketBought", "SeasonPassPurchased", "PackOpened"],
  PaymentSettled: ["ListingSold", "OfferAccepted", "AuctionSettled", "OrderMatched", "LimitOrderMatched", "HotMarketBought", "HotMarketSold", "CraftOrderFulfilled"],
  AssetTransferred: ["ListingSold", "OfferAccepted", "AuctionSettled", "RentalStarted", "RentalEnded"],
  AssetCreated: ["ToolMinted", "ToolCrafted", "PackOpened", "RerollResult"],
  CraftCompleted: ["ToolCrafted", "CraftEvent", "ToolRepaired"],
  FusionCompleted: ["RerollResult", "ForgeAttempted"],
  PackOpened: ["PackOpened"],
  QuestCompleted: ["QuestRewardClaimed", "AchievementUnlocked", "ExplorationCompleted", "ChallengeContributed"],
  StakeStarted: ["Staked", "CollectorStaked"],
  StakeEnded: ["Unstaked", "CollectorUnstaked"],
  RewardGranted: ["MiningCollected", "ExplorationCompleted", "ReferralPayout", "LotteryClaimed", "SeasonRewardClaimed", "PaidOut", "QuestRewardClaimed", "LotteryRoundRefunded"],
  RewardClaimed: ["ResourceIssued"],
  TokenMinted: ["ResourceIssued", "ToolMinted"],
  TokenBurned: ["ToolBurned", "ToolCrafted", "RerollResult"],
  TreasuryDeposited: ["ResourceIssued", "GasFeesSwept"],
  TreasuryWithdrawn: ["PaidOut", "VaultWithdrawal"],
  LiabilityCreated: ["AuctionBid", "OrderPlaced", "LimitOrderPlaced", "OfferCreated", "ListingCreated", "ReferralBound"],
  LiabilitySettled: ["PackCommitExpired", "ForgeCommitExpired", "AuctionSettled", "OrderMatched", "LimitOrderMatched"],
  ConfigUpdated: ["IssuanceCapChanged", "FeesUpdated", "ResourceMintsUpdated", "CraftEconomyUpdated", "QuestConfigInitialized", "HotMarketCranked", "HotMarketEventStarted",
    "VaultGuardChanged", "MiningToggled", "SupplyCapChanged", "CollectorMintRegistered", "PlayerCapacityChanged",
    "AuthorityRotationCancelled", "PackConfigChanged", "RerollConfigChanged", "SeasonInitialized", "SeasonXpGranted",
    "MaterialMintsInitialized", "ConfigMigrated", "CashoutFreezeChanged", "EmergencyStopActivated"],
  // [AUDIT F-02] The two-step authority rotation is now emitted by every
  // program that has a Config, so both are native sources - the "unsupported,
  // no multisig yet" reason in the catalog is obsolete.
  AdminProposalCreated: ["AuthorityRotationProposed"],
  AuthorityChanged: ["AuthorityChanged", "RolesChanged"],
  PausedToggled: ["PausedToggled", "EmergencyStopActivated"],
  EmergencyPause: ["PausedToggled", "EmergencyStopActivated"],
  TransactionFinalized: ["*"],
  TransactionFailed: ["*"],
};

/** Types the exporter derives from the ledger rather than a single event. */
export const SUPPORTED_DERIVED = ["FirstAction", "RetentionDay1", "RetentionDay3", "RetentionDay7", "RetentionDay14", "RetentionDay30",
  "FraudSignalCreated", "IndexerGapDetected", "IndexerGapHealed", "RpcError"];

/** Types AOF cannot produce truthfully (no on-chain / off-chain source). */
export const UNSUPPORTED = EVENT_TYPES.filter((t) => !(t in SUPPORTED_NATIVE) && !SUPPORTED_DERIVED.includes(t));

const LAMPORTS = "SOL_LAMPORTS";
const str = (v: unknown): string | null => (typeof v === "string" && v.length ? v : typeof v === "number" || typeof v === "bigint" ? String(v) : null);
const bool = (v: unknown) => v === true || v === "true" || v === 1;

export function normalizeChainEvent(row: ChainEventRow, salt: string, opts: { treasury?: string | null } = {}): WatchtowerEvent[] {
  if (!row.success) return [];
  const data = (typeof row.data === "string" ? JSON.parse(row.data) : row.data) as Record<string, unknown>;
  const occurredAt = row.blockTime ? new Date(row.blockTime).toISOString() : null;
  const slot = String(row.slot);
  const pid = (w: unknown) => (typeof w === "string" && w ? hashPlayer(w, salt) : null);
  const out: WatchtowerEvent[] = [];
  let n = 0;
  const emit = (type: string, fields: Partial<WatchtowerEvent> & { attributes?: Record<string, unknown> }) => {
    const category = CATEGORY[type];
    if (!category) throw new Error(`unknown Watchtower event type ${type}`);
    out.push({
      eventId: `${row.signature}:${row.eventIndex}:${n++}`,
      gameId: "aof", type, category, occurredAt, slot, signature: row.signature,
      // An explicit null means "no player" (config/admin events); only an
      // omitted playerId falls back to the row's primary actor.
      playerId: "playerId" in fields ? fields.playerId ?? null : pid(row.wallet),
      counterpartyId: fields.counterpartyId ?? null,
      asset: fields.asset ?? row.mint ?? null,
      amount: fields.amount ?? null,
      currency: fields.currency ?? null,
      confidence: "finalized", parserVersion: PARSER_VERSION,
      source: { program: row.programId, event: row.eventType, eventIndex: row.eventIndex },
      attributes: scrubWallets(fields.attributes ?? {}, data),
    });
  };

  const d = data;
  switch (row.eventType) {
    // ---- marketplace / trades -------------------------------------------------
    case "ListingSold":
    case "OfferAccepted": {
      const buyer = pid(d.buyer), seller = pid(d.seller), price = str(d.priceLamports);
      emit("PurchaseCompleted", { playerId: buyer, counterpartyId: seller, amount: price, currency: LAMPORTS, attributes: { venue: row.eventType === "ListingSold" ? "listing" : "offer" } });
      emit("PaymentSettled", { playerId: seller, counterpartyId: buyer, amount: price, currency: LAMPORTS });
      emit("AssetTransferred", { playerId: seller, counterpartyId: buyer, attributes: { reason: "sale" } });
      break;
    }
    case "AuctionSettled": {
      const winner = pid(d.winner);
      emit("PurchaseCompleted", { playerId: winner, amount: str(d.amount), currency: LAMPORTS, attributes: { venue: "auction" } });
      emit("PaymentSettled", { playerId: winner, amount: str(d.amount), currency: LAMPORTS });
      emit("AssetTransferred", { playerId: winner, attributes: { reason: "auction" } });
      emit("LiabilitySettled", { playerId: winner, amount: str(d.amount), currency: LAMPORTS, attributes: { liability: "auction_bid" } });
      break;
    }
    case "AuctionBid":
      emit("LiabilityCreated", { playerId: pid(d.bidder), amount: str(d.amount), currency: LAMPORTS, attributes: { liability: "auction_bid" } });
      break;
    case "ListingCreated":
      emit("LiabilityCreated", { playerId: pid(d.seller), amount: str(d.priceLamports), currency: LAMPORTS, attributes: { liability: "listing_escrow" } });
      break;
    case "OfferCreated":
      emit("LiabilityCreated", { playerId: pid(d.buyer), amount: str(d.priceLamports), currency: LAMPORTS, attributes: { liability: "offer_escrow" } });
      break;
    case "OrderPlaced":
      emit("LiabilityCreated", { playerId: pid(d.maker), amount: str(d.amount), currency: LAMPORTS, attributes: { liability: "orderbook", side: bool(d.isBuy) ? "buy" : "sell", pricePerUnit: str(d.priceLamportsPerUnit) } });
      break;
    case "OrderMatched":
      emit("PaymentSettled", { playerId: null, amount: str(d.amount), currency: LAMPORTS, attributes: { venue: "orderbook", pricePerUnit: str(d.priceLamportsPerUnit), buyOrder: str(d.buyOrder), sellOrder: str(d.sellOrder) } });
      emit("LiabilitySettled", { playerId: null, amount: str(d.amount), currency: LAMPORTS, attributes: { liability: "orderbook" } });
      break;
    case "LimitOrderPlaced":
      emit("LiabilityCreated", { playerId: pid(d.maker), amount: str(d.limitPrice), currency: "HOT_MARKET_UNIT", attributes: { liability: "limit_order", side: bool(d.isBuy) ? "buy" : "sell", rarity: str(d.rarity) } });
      break;
    case "LimitOrderMatched":
      emit("PaymentSettled", { playerId: pid(d.maker), amount: str(d.price), currency: "HOT_MARKET_UNIT", attributes: { venue: "limit_order", rarity: str(d.rarity) } });
      emit("LiabilitySettled", { playerId: pid(d.maker), amount: str(d.price), currency: "HOT_MARKET_UNIT", attributes: { liability: "limit_order" } });
      break;
    case "HotMarketBought":
      emit("PurchaseCompleted", { playerId: pid(d.buyer), amount: str(d.price), currency: str(d.currency) ?? "HOT_MARKET_UNIT", attributes: { venue: "hot_market", rarity: str(d.rarity), soldSinceStart: str(d.soldSinceStart) } });
      emit("PaymentSettled", { playerId: pid(d.buyer), amount: str(d.price), currency: str(d.currency) ?? "HOT_MARKET_UNIT", attributes: { venue: "hot_market" } });
      break;
    case "HotMarketSold":
      emit("PaymentSettled", { playerId: pid(d.seller), amount: str(d.price), currency: str(d.currency) ?? "HOT_MARKET_UNIT", attributes: { venue: "hot_market", side: "sell", rarity: str(d.rarity) } });
      break;
    case "CraftOrderFulfilled":
      emit("PaymentSettled", { playerId: pid(d.fulfiller), counterpartyId: pid(d.creator), amount: str(d.premiumLamports), currency: LAMPORTS, attributes: { venue: "craft_order" } });
      break;
    case "LotteryTicketBought":
      emit("PurchaseCompleted", { playerId: pid(d.buyer), attributes: { venue: "lottery", roundId: str(d.roundId), ticket: str(d.ticketNumber) } });
      break;
    case "SeasonPassPurchased":
      emit("PurchaseCompleted", { playerId: pid(d.owner), attributes: { venue: "season_pass", seasonId: str(d.seasonId) } });
      break;
    // ---- rentals --------------------------------------------------------------
    case "RentalStarted":
      emit("AssetTransferred", { playerId: pid(d.owner), counterpartyId: pid(d.renter), attributes: { reason: "rental_start", endTime: str(d.endTime) } });
      break;
    case "RentalEnded":
      emit("AssetTransferred", { playerId: pid(d.owner), attributes: { reason: "rental_end" } });
      break;
    // ---- assets / crafting ----------------------------------------------------
    case "ToolMinted":
      emit("AssetCreated", { playerId: pid(d.to), attributes: { toolType: str(d.toolType), rarity: str(d.rarity) } });
      emit("TokenMinted", { playerId: pid(d.to), amount: "1", currency: "NFT" });
      break;
    case "ToolCrafted":
      emit("CraftCompleted", { asset: str(d.mintedMint), attributes: { burned: str(d.burnedMint), rarity: str(d.rarity), woodCost: str(d.woodCost), stoneCost: str(d.stoneCost), mintedCountAfter: str(d.mintedCountAfter) } });
      emit("AssetCreated", { asset: str(d.mintedMint), attributes: { rarity: str(d.rarity) } });
      emit("TokenBurned", { asset: str(d.burnedMint), amount: "1", currency: "NFT" });
      break;
    case "CraftEvent":
      emit("CraftCompleted", { attributes: { toolType: str(d.toolType), rarity: str(d.rarity), costs: { wood: str(d.woodCost), stone: str(d.stoneCost), food: str(d.foodCost), seeds: str(d.seedsCost), water: str(d.waterCost), potato: str(d.potatoCost) } } });
      break;
    case "ToolRepaired":
      emit("CraftCompleted", { asset: str(d.toolMint), attributes: { kind: "repair", repairedAmount: str(d.repairedAmount), newDurability: str(d.newDurability), stoneCost: str(d.stoneCost), woodCost: str(d.woodCost) } });
      break;
    case "ToolBurned":
      emit("TokenBurned", { playerId: pid(d.from), amount: "1", currency: "NFT" });
      break;
    case "RerollResult":
      emit("FusionCompleted", { asset: str(d.newMint), attributes: { kind: "reroll", burned: str(d.burnedMint), rarity: str(d.rarity), toolType: str(d.toolType) } });
      emit("AssetCreated", { asset: str(d.newMint), attributes: { rarity: str(d.rarity), toolType: str(d.toolType) } });
      emit("TokenBurned", { asset: str(d.burnedMint), amount: "1", currency: "NFT" });
      break;
    case "ForgeAttempted":
      emit("FusionCompleted", { asset: str(d.toolMint), attributes: { kind: "forge", slotType: str(d.slotType), levelBefore: str(d.levelBefore), levelAfter: str(d.levelAfter), outcome: str(d.outcome) } });
      break;
    case "PackOpened":
      emit("PackOpened", { attributes: { packType: str(d.packType), rarity: str(d.rarity), toolType: str(d.toolType) } });
      emit("PurchaseCompleted", { attributes: { venue: "pack" } });
      emit("AssetCreated", { attributes: { rarity: str(d.rarity), toolType: str(d.toolType) } });
      break;
    case "PackCommitExpired":
      emit("LiabilitySettled", { amount: str(d.refundedLamports), currency: LAMPORTS, attributes: { liability: "pack_commit", outcome: "refund" } });
      break;
    case "ForgeCommitExpired":
      emit("LiabilitySettled", { asset: str(d.toolMint), amount: str(d.refundedLamports), currency: LAMPORTS, attributes: { liability: "forge_commit", outcome: "refund", woodRefunded: str(d.woodRefunded), stoneRefunded: str(d.stoneRefunded) } });
      break;
    // ---- staking --------------------------------------------------------------
    case "Staked":
      emit("StakeStarted", {}); break;
    case "Unstaked":
      emit("StakeEnded", {}); break;
    case "CollectorStaked":
      emit("StakeStarted", { attributes: { kind: str(d.kind), unlockAt: str(d.unlockAt) } }); break;
    case "CollectorUnstaked":
      emit("StakeEnded", { attributes: { kind: str(d.kind) } }); break;
    // ---- rewards --------------------------------------------------------------
    case "MiningCollected":
      emit("RewardGranted", { asset: str(d.resourceMint), amount: str(d.amount), currency: "RESOURCE", attributes: { source: "mining", toolMint: str(d.toolMint), hours: str(d.hours), durabilityAfter: str(d.durabilityAfter) } });
      break;
    case "ExplorationCompleted":
      emit("QuestCompleted", { attributes: { kind: "exploration", success: bool(d.success), toolMint: str(d.toolMint) } });
      if (bool(d.success)) emit("RewardGranted", { currency: "RESOURCE", attributes: { source: "exploration", woodReward: str(d.woodReward), stoneReward: str(d.stoneReward) } });
      break;
    case "ReferralPayout":
      emit("RewardGranted", { playerId: pid(d.referrer), counterpartyId: pid(d.referred), amount: str(d.amount), currency: "RESOURCE", attributes: { source: "referral" } });
      break;
    case "ReferralBound":
      // Referral binding is NOT a wallet connection. Preserve the removed
      // fan-out ordinal so existing LiabilityCreated IDs do not change.
      n++;
      emit("LiabilityCreated", { playerId: pid(d.referrer), counterpartyId: pid(d.referred), attributes: { liability: "referral_reward_pending" } });
      break;
    case "LotteryClaimed":
      emit("RewardGranted", { playerId: pid(d.winner), amount: str(d.amount), currency: LAMPORTS, attributes: { source: "lottery", roundId: str(d.roundId) } });
      break;
    case "SeasonRewardClaimed":
      emit("RewardGranted", { playerId: pid(d.owner), attributes: { source: "season", level: str(d.level) } });
      break;
    case "PaidOut":
      emit("RewardGranted", { amount: str(d.amount), currency: LAMPORTS, attributes: { source: "vault", vaultBalanceAfter: str(d.vaultBalanceAfter) } });
      emit("TreasuryWithdrawn", { amount: str(d.amount), currency: LAMPORTS, attributes: { from: "gas_vault" } });
      break;
    case "VaultWithdrawal":
      // [AUDIT F-01] Every guarded payout out of the resource vault. The
      // on-chain cap bounds a stolen key; this event is what makes a drain
      // visible off-chain, so it is mapped rather than ignored.
      emit("TreasuryWithdrawn", {
        amount: str(d.amount),
        currency: "RESOURCE",
        asset: str(d.mint),
        attributes: {
          from: "resource_vault",
          mint: str(d.mint),
          recipient: pid(d.recipient),
          withdrawnInEpoch: str(d.withdrawn_in_epoch),
          capPerEpoch: str(d.cap_per_epoch),
          slot: str(d.slot),
        },
      });
      break;
    case "QuestRewardClaimed":
      emit("QuestCompleted", { attributes: { questId: str(d.questId) } });
      emit("RewardGranted", { asset: str(d.rewardMascot), amount: "1", currency: "NFT", attributes: { source: "quest", questId: str(d.questId) } });
      break;
    case "AchievementUnlocked":
      emit("QuestCompleted", { attributes: { kind: "achievement", achievementId: str(d.achievementId) } }); break;
    case "ChallengeContributed":
      emit("QuestCompleted", { amount: str(d.medals), currency: "MEDALS", attributes: { kind: "weekly_challenge", week: str(d.weekNumber) } }); break;
    case "ResourceIssued": {
      // The backend-authority mint path (inbox rewards, admin grants). Gross
      // is minted; fee stays in the treasury ATA → both legs are visible.
      const recipient = pid(d.recipient);
      emit("RewardClaimed", { playerId: recipient, amount: str(d.gross), currency: "RESOURCE", attributes: { kind: str(d.kind), fee: str(d.fee) } });
      emit("TokenMinted", { playerId: recipient, amount: str(d.gross), currency: "RESOURCE", attributes: { kind: str(d.kind), mintedInEpoch: str(d.mintedInEpoch), capPerEpoch: str(d.capPerEpoch), epochStartSlot: str(d.epochStartSlot) } });
      if (str(d.fee) && str(d.fee) !== "0") emit("TreasuryDeposited", { playerId: null, amount: str(d.fee), currency: "RESOURCE", attributes: { source: "issuance_fee", destination: "treasury_ata" } });
      break;
    }
    case "GasFeesSwept":
      emit("TreasuryDeposited", { playerId: null, amount: str(d.amountLamports), currency: LAMPORTS, attributes: { source: "gas_fees", destination: opts.treasury ? (str(d.to) === opts.treasury ? "treasury" : "other") : "unknown" } });
      break;
    // ---- security / config ----------------------------------------------------
    case "IssuanceCapChanged":
      emit("ConfigUpdated", { playerId: null, attributes: { setting: "issuance_cap", kind: str(d.kind), epochSlots: str(d.epochSlots), capPerEpoch: str(d.capPerEpoch), mintedInEpoch: str(d.mintedInEpoch), halted: str(d.capPerEpoch) === "0" } });
      break;
    case "PausedToggled":
      // Same on-chain switch backs both Watchtower types: PausedToggled is the
      // state change; EmergencyPause is emitted additionally when paused=true.
      emit("PausedToggled", { playerId: null, attributes: { paused: bool(d.paused), authority: str(d.authority) ? "config_authority" : null } });
      if (bool(d.paused)) emit("EmergencyPause", { playerId: null, attributes: { authority: "config_authority" } });
      break;
    case "FeesUpdated":
      emit("ConfigUpdated", { playerId: null, attributes: { setting: "fees", craftFee: str(d.craftFee), unstakeFee: str(d.unstakeFee) } });
      break;
    case "ResourceMintsUpdated": {
      const prev = (d.previous as unknown[]) ?? [], cur = (d.current as unknown[]) ?? [];
      const names = ["food", "wood", "stone", "seeds", "water", "potato"];
      const changed = names.filter((_, i) => str(prev[i]) !== str(cur[i]));
      emit("ConfigUpdated", { playerId: null, attributes: { setting: "resource_mints", changed, previous: Object.fromEntries(names.map((n, i) => [n, str(prev[i])])), current: Object.fromEntries(names.map((n, i) => [n, str(cur[i])])) } });
      break;
    }
    case "CraftEconomyUpdated":
      emit("ConfigUpdated", { playerId: null, attributes: { setting: "craft_economy", woodBase: d.woodBase, stoneBase: d.stoneBase, woodMult: d.woodMult, stoneMult: d.stoneMult } });
      break;
    case "QuestConfigInitialized":
      emit("ConfigUpdated", { playerId: null, attributes: { setting: "quest_config", authority: str(d.authority) ? "set" : null, mascotMint: str(d.mascotMint) } });
      break;
    case "HotMarketCranked":
      emit("ConfigUpdated", { playerId: null, attributes: { setting: "hot_market_price", rarity: str(d.rarity), priceCore: str(d.newPriceCore), priceGem: str(d.newPriceGem) } });
      break;
    case "HotMarketEventStarted":
      emit("ConfigUpdated", { playerId: null, attributes: { setting: "hot_market_event", rarity: str(d.rarity), endTs: str(d.endTs), multiplierBps: str(d.multiplierBps) } });
      break;
    // ---- [AUDIT F-01/F-02/F-03/F-15/F-16/F-23/F-27] guard + admin events ----
    // Every one of these is a privileged state change. They are mapped rather
    // than ignored: an operator rotating authority, widening a supply cap or
    // relaxing a vault guard must be visible off-chain.
    case "VaultGuardChanged":
      emit("ConfigUpdated", { playerId: null, attributes: { setting: "vault_guard", mint: str(d.mint), epochSlots: str(d.epoch_slots), capPerEpoch: str(d.cap_per_epoch), maxPerTx: str(d.max_per_tx) } });
      break;
    case "AuthorityRotationProposed":
      emit("AdminProposalCreated", { playerId: null, attributes: { setting: "authority", previous: pid(d.previous), next: pid(d.next), at: str(d.at) } });
      break;
    case "AuthorityChanged":
      emit("AuthorityChanged", { playerId: null, attributes: { setting: "authority", previous: pid(d.previous), next: pid(d.next), at: str(d.at) } });
      break;
    case "MiningToggled":
      emit("ConfigUpdated", { playerId: null, attributes: { setting: "mining_enabled", enabled: bool(d.enabled) } });
      break;
    case "SupplyCapChanged":
      emit("ConfigUpdated", { playerId: null, attributes: { setting: "supply_cap", kind: str(d.kind), maxSupply: str(d.max_supply) } });
      break;
    case "CollectorMintRegistered":
      emit("ConfigUpdated", { playerId: null, attributes: { setting: "collector_mint", mint: str(d.mint), kind: str(d.kind), registered: bool(d.registered) } });
      break;
    case "PlayerCapacityChanged":
      emit("ConfigUpdated", { playerId: pid(d.player), attributes: { setting: "player_capacity", previousVillagers: str(d.previous_villagers), nextVillagers: str(d.next_villagers), delta: str(d.delta), hasTent: bool(d.has_tent) } });
      break;
    // ---- [SECURITY_CHECKLIST_REVIEW F-C] roles, emergency switches and the
    // previously silent admin mutations: all privileged, all mapped.
    case "AuthorityRotationCancelled":
      emit("ConfigUpdated", { playerId: null, attributes: { setting: "authority_rotation_cancelled", cancelled: pid(d.cancelled) } });
      break;
    case "RolesChanged":
      emit("AuthorityChanged", { playerId: null, attributes: { setting: "roles", operator: pid(d.operator), guardian: pid(d.guardian) } });
      break;
    case "ConfigMigrated":
      emit("ConfigUpdated", { playerId: null, attributes: { setting: "config_v2", operator: pid(d.operator), guardian: pid(d.guardian) } });
      break;
    case "EmergencyStopActivated":
      if (bool(d.paused)) {
        emit("PausedToggled", { playerId: null, attributes: { paused: true, authority: "guardian_or_admin" } });
        emit("EmergencyPause", { playerId: null, attributes: { authority: "guardian_or_admin" } });
      }
      if (bool(d.cashout_frozen)) emit("ConfigUpdated", { playerId: null, attributes: { setting: "cashout_frozen", frozen: true } });
      break;
    case "CashoutFreezeChanged":
      emit("ConfigUpdated", { playerId: null, attributes: { setting: "cashout_frozen", frozen: bool(d.frozen) } });
      break;
    case "PackConfigChanged":
      emit("ConfigUpdated", { playerId: null, attributes: { setting: "pack_config", packType: str(d.pack_type), priceLamports: str(d.price_lamports) } });
      break;
    case "RerollConfigChanged":
      emit("ConfigUpdated", { playerId: null, attributes: { setting: "reroll_config" } });
      break;
    case "SeasonInitialized":
      emit("ConfigUpdated", { playerId: null, attributes: { setting: "season", seasonId: str(d.season_id), startTime: str(d.start_time) } });
      break;
    case "SeasonXpGranted":
      emit("ConfigUpdated", { playerId: pid(d.owner), attributes: { setting: "season_xp", seasonId: str(d.season_id), amount: str(d.amount), totalXp: str(d.total_xp) } });
      break;
    case "MaterialMintsInitialized":
      emit("ConfigUpdated", { playerId: null, attributes: { setting: "material_mints" } });
      break;
    case "LotteryRoundRefunded":
      emit("RewardGranted", { playerId: null, amount: str(d.lamports), currency: LAMPORTS, attributes: { source: "lottery_refund", roundId: str(d.round_id), ticketsSold: str(d.tickets_sold) } });
      break;
    // Explicitly ignored: no Watchtower semantics, kept out on purpose.
    case "AuctionCreated": case "LotteryDrawn": case "HotMarketSkipped": case "DrumCommitted": case "DrumRevealed":
    case "ChallengeCreated": case "QuestCreated":
      break;
    default:
      // Unknown to this parser version: surface as ConfigUpdated? No — never
      // guess. Return nothing; /watchtower/config reports parserVersion so
      // Watchtower can detect coverage gaps via event-types.json.
      break;
  }
  return out;
}

/**
 * Defence in depth: attributes may never carry a raw wallet. Any attribute
 * value equal to a pubkey-typed field of the source event that the WALLET
 * heuristics recognise is replaced by "<redacted-wallet>". Mints/assets are
 * not wallets and stay.
 */
const WALLET_KEYS = new Set(["user", "owner", "buyer", "seller", "bidder", "maker", "winner", "to", "from", "referrer", "referred", "creator", "fulfiller", "renter", "authority", "recipient"]);
function scrubWallets(attrs: Record<string, unknown>, data: Record<string, unknown>): Record<string, unknown> {
  const wallets = new Set(Object.entries(data).filter(([k, v]) => WALLET_KEYS.has(k) && typeof v === "string").map(([, v]) => v as string));
  if (wallets.size === 0) return attrs;
  const walk = (v: unknown): unknown => typeof v === "string" ? (wallets.has(v) ? "<redacted-wallet>" : v) : Array.isArray(v) ? v.map(walk) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, walk(x)])) : v;
  return walk(attrs) as Record<string, unknown>;
}

/** Per-tx reliability events (one per ChainTx row, not per event). */
export function normalizeChainTx(tx: { signature: string; slot: bigint | number | string; blockTime: Date | string | null; success: boolean; feePayer: string; errorJson: string | null; programIds: string | string[] }, salt: string): WatchtowerEvent[] {
  const programs = typeof tx.programIds === "string" ? (JSON.parse(tx.programIds) as string[]) : tx.programIds;
  const base = {
    gameId: "aof" as const, occurredAt: tx.blockTime ? new Date(tx.blockTime).toISOString() : null, slot: String(tx.slot), signature: tx.signature,
    playerId: tx.feePayer ? hashPlayer(tx.feePayer, salt) : null, confidence: "finalized" as const, parserVersion: PARSER_VERSION as typeof PARSER_VERSION,
    source: { program: programs[0] ?? "", event: "ChainTx", eventIndex: -1 },
  };
  if (tx.success) return [{ ...base, eventId: `${tx.signature}:tx:0`, type: "TransactionFinalized", category: "reliability", attributes: { programs } }];
  let error: unknown = tx.errorJson;
  try { error = tx.errorJson ? JSON.parse(tx.errorJson) : null; } catch { /* keep raw */ }
  return [{ ...base, eventId: `${tx.signature}:tx:0`, type: "TransactionFailed", category: "reliability", attributes: { programs, error } }];
}
