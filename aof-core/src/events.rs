use anchor_lang::prelude::*;
use crate::state::Rarity;

#[event]
pub struct ToolMinted {
    pub to: Pubkey,
    pub mint: Pubkey,
    pub tool_type: String,
    pub rarity: Rarity,
}

#[event]
pub struct ToolBurned {
    pub from: Pubkey,
    pub mint: Pubkey,
}

#[event]
pub struct Staked {
    pub user: Pubkey,
    pub mint: Pubkey,
}

#[event]
pub struct Unstaked {
    pub user: Pubkey,
    pub mint: Pubkey,
}

/// Emitted by every mint path once the cap has been charged. The chain
/// indexer uses this (not SPL MintTo deltas) as the authoritative issuance
/// record, and the cap fields let dashboards show headroom per epoch.
#[event]
pub struct ResourceIssued {
    pub kind: u8,
    pub mint: Pubkey,
    pub recipient: Pubkey,
    pub gross: u64,
    pub fee: u64,
    pub minted_in_epoch: u64,
    pub cap_per_epoch: u64,
    pub epoch_start_slot: u64,
    pub slot: u64,
}

#[event]
pub struct IssuanceCapChanged {
    pub kind: u8,
    pub epoch_slots: u64,
    pub cap_per_epoch: u64,
    pub minted_in_epoch: u64,
    pub slot: u64,
}

/// Emitted by set_paused. `authority` identifies who flipped the switch.
#[event]
pub struct PausedToggled {
    pub paused: bool,
    pub authority: Pubkey,
    pub slot: u64,
}

/// Emitted by set_fees (values in base units).
#[event]
pub struct FeesUpdated {
    pub craft_fee: u64,
    pub unstake_fee: u64,
    pub authority: Pubkey,
    pub slot: u64,
}

/// Emitted by set_resource_mints; previous values are included so a
/// mint swap (a critical config change) is fully reconstructible from logs.
#[event]
pub struct ResourceMintsUpdated {
    pub previous: [Pubkey; 6],
    pub current: [Pubkey; 6],
    pub authority: Pubkey,
    pub slot: u64,
}

/// Emitted by set_craft_economy.
#[event]
pub struct CraftEconomyUpdated {
    pub wood_base: [u64; 4],
    pub stone_base: [u64; 4],
    pub wood_mult: [u64; 4],
    pub stone_mult: [u64; 4],
    pub authority: Pubkey,
    pub slot: u64,
}

#[event]
pub struct PaidOut {
    pub user: Pubkey,
    pub amount: u64,
    pub vault_balance_after: u64,
}

#[event]
pub struct MiningCollected {
    pub user: Pubkey,
    pub tool_mint: Pubkey,
    pub resource_mint: Pubkey,
    pub hours: u8,
    pub amount: u64,
    pub durability_after: u8,
}

// ===== [НОВОЕ] для добавленной логики =====

#[event]
pub struct ToolCrafted {
    pub user: Pubkey,
    pub burned_mint: Pubkey,
    pub minted_mint: Pubkey,
    pub rarity: Rarity,
    pub wood_cost: u64,
    pub stone_cost: u64,
    pub minted_count_after: u64,
}

#[event]
pub struct ToolRepaired {
    pub user: Pubkey,
    pub tool_mint: Pubkey,
    pub repaired_amount: u8,
    pub stone_cost: u64,
    pub wood_cost: u64,
    pub new_durability: u8,
}

#[event]
pub struct GasFeesSwept {
    pub to: Pubkey,
    pub amount_lamports: u64,
}

#[event]
pub struct CollectorStaked {
    pub user: Pubkey,
    pub mint: Pubkey,
    pub kind: crate::state::CollectorKind,
    pub unlock_at: i64,
}

#[event]
pub struct CollectorUnstaked {
    pub user: Pubkey,
    pub mint: Pubkey,
    pub kind: crate::state::CollectorKind,
}

// ===== [НОВОЕ] полная реализация TOR v4 =====

#[event]
pub struct PackOpened {
    pub user: Pubkey,
    pub mint: Pubkey,
    pub pack_type: u8,
    pub rarity: Rarity,
    pub tool_type: String,
}

#[event]
pub struct PackCommitExpired {
    pub user: Pubkey,
    pub mint: Pubkey,
    pub pack_type: u8,
    pub refunded_lamports: u64,
}

#[event]
pub struct RerollResult {
    pub user: Pubkey,
    pub burned_mint: Pubkey,
    pub new_mint: Pubkey,
    pub rarity: Rarity,
    pub tool_type: String,
}

#[event]
pub struct ExplorationCompleted {
    pub user: Pubkey,
    pub tool_mint: Pubkey,
    pub success: bool,
    pub wood_reward: u64,
    pub stone_reward: u64,
}

#[event]
pub struct ReferralBound {
    pub referrer: Pubkey,
    pub referred: Pubkey,
}

#[event]
pub struct ReferralPayout {
    pub referrer: Pubkey,
    pub referred: Pubkey,
    pub amount: u64,
}

#[event]
pub struct ForgeAttempted {
    pub user: Pubkey,
    pub tool_mint: Pubkey,
    pub slot_type: u8,
    pub level_before: u8,
    pub level_after: u8,
    pub outcome: u8, // 0=success 1=partial_fail 2=full_loss
}

#[event]
pub struct LotteryTicketBought {
    pub round_id: u64,
    pub buyer: Pubkey,
    pub ticket_number: u64,
}

#[event]
pub struct LotteryDrawn {
    pub round_id: u64,
    pub winning_ticket: u64,
    pub pool_lamports: u64,
}

#[event]
pub struct LotteryClaimed {
    pub round_id: u64,
    pub winner: Pubkey,
    pub amount: u64,
}

#[event]
pub struct ListingCreated {
    pub seller: Pubkey,
    pub mint: Pubkey,
    pub price_lamports: u64,
}

#[event]
pub struct ListingSold {
    pub seller: Pubkey,
    pub buyer: Pubkey,
    pub mint: Pubkey,
    pub price_lamports: u64,
}

#[event]
pub struct AuctionCreated {
    pub seller: Pubkey,
    pub mint: Pubkey,
    pub min_bid: u64,
    pub end_time: i64,
}

#[event]
pub struct AuctionBid {
    pub mint: Pubkey,
    pub bidder: Pubkey,
    pub amount: u64,
}

#[event]
pub struct AuctionSettled {
    pub mint: Pubkey,
    pub winner: Pubkey,
    pub amount: u64,
}

#[event]
pub struct OfferCreated {
    pub buyer: Pubkey,
    pub mint: Pubkey,
    pub price_lamports: u64,
}

#[event]
pub struct OfferAccepted {
    pub buyer: Pubkey,
    pub seller: Pubkey,
    pub mint: Pubkey,
    pub price_lamports: u64,
}

#[event]
pub struct RentalStarted {
    pub mint: Pubkey,
    pub owner: Pubkey,
    pub renter: Pubkey,
    pub end_time: i64,
}

#[event]
pub struct RentalEnded {
    pub mint: Pubkey,
    pub owner: Pubkey,
}

#[event]
pub struct OrderPlaced {
    pub maker: Pubkey,
    pub is_buy: bool,
    pub price_lamports_per_unit: u64,
    pub amount: u64,
}

#[event]
pub struct OrderMatched {
    pub buy_order: Pubkey,
    pub sell_order: Pubkey,
    pub amount: u64,
    pub price_lamports_per_unit: u64,
}

#[event]
pub struct CraftOrderFulfilled {
    pub creator: Pubkey,
    pub fulfiller: Pubkey,
    pub premium_lamports: u64,
}

#[event]
pub struct SeasonPassPurchased {
    pub owner: Pubkey,
    pub season_id: u32,
}

#[event]
pub struct SeasonRewardClaimed {
    pub owner: Pubkey,
    pub level: u8,
}

#[event]
pub struct CraftEvent {
    pub user: Pubkey,
    pub tool_type: String,
    pub rarity: u8,
    pub wood_cost: u64,
    pub stone_cost: u64,
    pub food_cost: u64,
    pub seeds_cost: u64,
    pub water_cost: u64,
    pub potato_cost: u64,
}

#[event]
pub struct ForgeCommitExpired {
    pub user: Pubkey,
    pub tool_mint: Pubkey,
    pub slot_type: u8,
    pub refunded_lamports: u64,
    pub wood_refunded: u64,
    pub stone_refunded: u64,
}
