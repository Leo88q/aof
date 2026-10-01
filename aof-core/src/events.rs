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

/// Канонический перенос инструмента вместе с владением (`transfer_tool`).
/// Индексаторы используют событие как источник правды о смене владельца:
/// SPL-перевод без него владение не меняет.
#[event]
pub struct ToolTransferred {
    pub mint: Pubkey,
    pub from: Pubkey,
    pub to: Pubkey,
}

/// `sync_tool_owner` привёл кэш `ToolData.owner`/`operator` в соответствие с
/// фактическим держателем supply-1 токена после обычного SPL-перевода.
///
/// `previous_*` — значения кэша ДО синхронизации, а не предыдущий владелец
/// токена: программа не видит обычные SPL-переводы и не знает, сколько
/// держателей сменилось с последней синхронизации.
#[event]
pub struct ToolOwnershipSynced {
    pub mint: Pubkey,
    pub previous_owner: Pubkey,
    pub previous_operator: Pubkey,
    pub new_owner: Pubkey,
    /// Слот, в котором кэш был согласован с токеном.
    pub slot: u64,
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
    pub circuit_base: [u64; 4],
    pub silicon_base: [u64; 4],
    pub circuit_mult: [u64; 4],
    pub silicon_mult: [u64; 4],
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
    pub circuit_cost: u64,
    pub silicon_cost: u64,
    pub minted_count_after: u64,
}

#[event]
pub struct ToolRepaired {
    pub user: Pubkey,
    pub tool_mint: Pubkey,
    pub repaired_amount: u8,
    pub silicon_cost: u64,
    pub circuit_cost: u64,
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
    pub pack_commit: Pubkey,
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
    pub circuit_reward: u64,
    pub silicon_reward: u64,
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

/// [AUDIT orderbook price unit] v2 order placement: `price_lamports_per_whole`
/// is per whole resource, `total_lamports` is what the escrow holds (rounded
/// up). Emitted separately from `OrderPlaced` so the indexer never has to guess
/// which price unit a row uses.
#[event]
pub struct OrderPlacedV2 {
    pub maker: Pubkey,
    pub is_buy: bool,
    pub price_lamports_per_whole: u64,
    pub amount: u64,
    pub total_lamports: u64,
}

#[event]
pub struct OrderMatchedV2 {
    pub buy_order: Pubkey,
    pub sell_order: Pubkey,
    pub amount: u64,
    pub price_lamports_per_whole: u64,
    pub gross_lamports: u64,
    pub taker_fee_lamports: u64,
    pub maker_fee_lamports: u64,
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

/// [PAYER] Пропуск создаёт сам игрок (`init_season_pass`), поэтому создание —
/// отдельное наблюдаемое событие, не связанное с оплатой проекта.
#[event]
pub struct SeasonPassInitialized {
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
    pub circuit_cost: u64,
    pub silicon_cost: u64,
    pub data_cost: u64,
    pub neuron_cost: u64,
    pub power_cost: u64,
    pub mind_cost: u64,
}

#[event]
pub struct ForgeCommitExpired {
    pub user: Pubkey,
    pub tool_mint: Pubkey,
    pub slot_type: u8,
    pub refunded_lamports: u64,
    pub circuit_refunded: u64,
    pub silicon_refunded: u64,
}

// ===== [F-06] Switchboard On-Demand settlement (see vrf.rs) =====

/// Mechanic ids used by the VRF events.
pub const VRF_MECHANIC_PACK: u8 = 0;
pub const VRF_MECHANIC_REROLL: u8 = 1;
pub const VRF_MECHANIC_EXPLORATION: u8 = 2;
pub const VRF_MECHANIC_FORGE: u8 = 3;
pub const VRF_MECHANIC_LOTTERY: u8 = 4;

/// A paid commit locked a pool randomness account and is waiting for the
/// oracle. Monitoring alerts on commits that stay unsettled.
#[event]
pub struct VrfCommitted {
    pub mechanic: u8,
    pub commit: Pubkey,
    pub user: Pubkey,
    pub randomness: Pubkey,
    pub seed_slot: u64,
    pub commit_slot: u64,
    /// Lamports held in escrow by the commit (price/fee + settlement deposit).
    pub escrow_lamports: u64,
}

/// The oracle value that settled a commit. Every outcome is a pure function of
/// (value, mechanic tag, commit key) and the snapshot on the commit, so anyone
/// can recompute it from this event.
#[event]
pub struct VrfSettled {
    pub mechanic: u8,
    pub commit: Pubkey,
    pub randomness: Pubkey,
    pub seed_slot: u64,
    pub value: [u8; 32],
    pub cranker: Pubkey,
}

/// Refund of a commit the oracle never revealed inside the reveal window.
#[event]
pub struct VrfCommitRefunded {
    pub mechanic: u8,
    pub commit: Pubkey,
    pub user: Pubkey,
    pub refunded_lamports: u64,
}

#[event]
pub struct VrfSlotAdded {
    pub index: u32,
    pub randomness: Pubkey,
    pub vrf_slot: Pubkey,
}

#[event]
pub struct VrfSlotRetiredChanged {
    pub vrf_slot: Pubkey,
    pub retired: bool,
}

/// A lock whose holder account no longer exists was cleared.
#[event]
pub struct VrfSlotRecovered {
    pub vrf_slot: Pubkey,
    pub stale_lock: Pubkey,
}

#[event]
pub struct LotteryTicketRefunded {
    pub round_id: u64,
    pub ticket_number: u64,
    pub buyer: Pubkey,
    pub lamports: u64,
}

/// [AUDIT F-01] Every authority withdrawal from the vault, with the guard
/// budget it was charged against. Indexers/monitoring must alert on spikes
/// here: the guard bounds a single key, it does not make it invisible.
#[event]
pub struct VaultWithdrawal {
    pub mint: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub withdrawn_in_epoch: u64,
    pub cap_per_epoch: u64,
    pub slot: u64,
}

/// [AUDIT F-01] Vault guard created or reconfigured.
#[event]
pub struct VaultGuardChanged {
    pub mint: Pubkey,
    pub epoch_slots: u64,
    pub cap_per_epoch: u64,
    pub max_per_tx: u64,
    pub slot: u64,
}

/// [AUDIT F-02] Authority rotation, both steps. `previous`/`next` are recorded
/// so an unauthorised rotation attempt is visible on-chain even when it fails.
#[event]
pub struct AuthorityRotationProposed {
    pub previous: Pubkey,
    pub next: Pubkey,
    pub at: i64,
}

#[event]
pub struct AuthorityChanged {
    pub previous: Pubkey,
    pub next: Pubkey,
    pub at: i64,
}

/// [AUDIT F-27] Mining kill-switch flips.
#[event]
pub struct MiningToggled {
    pub enabled: bool,
    pub at: i64,
}

/// [AUDIT F-03] Global supply ceiling changed for one resource kind.
#[event]
pub struct SupplyCapChanged {
    pub kind: u8,
    pub max_supply: u64,
    pub at: i64,
}

/// [AUDIT F-16] Collector perk allowlist changes.
#[event]
pub struct CollectorMintRegistered {
    pub mint: Pubkey,
    pub kind: u8,
    pub registered: bool,
}

/// [AUDIT F-15] Villager capacity changes, with before/after for auditing.
#[event]
pub struct PlayerCapacityChanged {
    pub player: Pubkey,
    pub previous_villagers: u32,
    pub next_villagers: u32,
    pub delta: i32,
    pub has_tent: bool,
}

/// [AUDIT F-23] A never-drawn lottery round was swept back to the treasury
/// instead of stranding its pool.
#[event]
pub struct LotteryRoundRefunded {
    pub round_id: u64,
    pub lamports: u64,
    pub tickets_sold: u64,
    pub at: i64,
}

/// [SECURITY_CHECKLIST_REVIEW F-C] A cancelled authority rotation used to be
/// silent, so monitoring could not see a proposed takeover being withdrawn.
#[event]
pub struct AuthorityRotationCancelled {
    pub authority: Pubkey,
    pub cancelled: Pubkey,
    pub slot: u64,
}

/// [SECURITY_CHECKLIST_REVIEW F-C] Admin configuration changes are observable.
#[event]
pub struct PackConfigChanged {
    pub pack_type: u8,
    pub price_lamports: u64,
    pub odds_bps: [u16; 5],
    pub slot: u64,
}

#[event]
pub struct RerollConfigChanged {
    pub odds_bps: [u16; 5],
    pub slot: u64,
}

#[event]
pub struct SeasonInitialized {
    pub season_id: u32,
    pub start_time: i64,
}

#[event]
pub struct SeasonXpGranted {
    pub owner: Pubkey,
    pub season_id: u32,
    pub amount: u32,
    pub total_xp: u32,
}

#[event]
pub struct MaterialMintsInitialized {
    pub authority: Pubkey,
    pub slot: u64,
}

// ===== [SECURITY_CHECKLIST_REVIEW F-C] roles and emergency switches =====
#[event]
pub struct ConfigMigrated {
    pub authority: Pubkey,
    pub operator: Pubkey,
    pub guardian: Pubkey,
    pub slot: u64,
}

#[event]
pub struct RolesChanged {
    pub authority: Pubkey,
    pub operator: Pubkey,
    pub guardian: Pubkey,
    pub slot: u64,
}

#[event]
pub struct EmergencyStopActivated {
    pub caller: Pubkey,
    pub paused: bool,
    pub cashout_frozen: bool,
    pub slot: u64,
}

#[event]
pub struct CashoutFreezeChanged {
    pub authority: Pubkey,
    pub frozen: bool,
    pub slot: u64,
}

// ===== [SECURITY_CHECKLIST_REVIEW F-G / F-H] trading =====
#[event]
pub struct AuctionCancelled {
    pub seller: Pubkey,
    pub mint: Pubkey,
}

#[event]
pub struct RentalListed {
    pub mint: Pubkey,
    pub owner: Pubkey,
    pub price_per_hour_lamports: u64,
    pub owner_split_bps: u16,
}

#[event]
pub struct RentalDelisted {
    pub mint: Pubkey,
    pub owner: Pubkey,
}

/// [§3.4] Полный сброс перерождения применён. Событие фиксирует и факт
/// сброса прогресса, и сколько излишков сожжено: индексор не должен выводить
/// это из молчания, а игрок — обнаружить сброс без объяснения.
#[event]
pub struct RebirthReset {
    pub user: Pubkey,
    pub season_id: u32,
    /// Сколько XP было у пропуска до сброса (для индексатора и истории).
    pub xp_before: u32,
    pub has_tent_before: bool,
    pub burned_accounts: u16,
    pub burned_atoms: u64,
}
