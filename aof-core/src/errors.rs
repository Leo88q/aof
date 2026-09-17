use anchor_lang::prelude::*;

#[error_code]
pub enum AofError {
    #[msg("Unauthorized: signer does not match required authority")]
    Unauthorized,
    #[msg("Math overflow or underflow detected")]
    MathOverflow,
    #[msg("Insufficient balance for operation")]
    InsufficientBalance,
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Program is paused")]
    Paused,
    #[msg("Invalid resource kind for mint")]
    InvalidResourceKind,
    #[msg("Tool rarity must be above Common for craft")]
    InvalidRarityForCraft,
    #[msg("Tool is not owned by user")]
    NotToolOwner,
    #[msg("Tool durability insufficient")]
    InsufficientDurability,
    #[msg("Tool is currently mining")]
    ToolIsMining,
    #[msg("Mining not yet complete")]
    MiningNotComplete,
    #[msg("Invalid mining hours for tool rarity")]
    InvalidMiningHours,
    #[msg("Durability would exceed maximum")]
    DurabilityExceedsMax,
    #[msg("Tool is already staked or not staked")]
    InvalidStakeState,
    #[msg("Tool is not staked")]
    NotStaked,
    #[msg("Tool is already staked")]
    AlreadyStaked,
    #[msg("Tool is already mining")]
    AlreadyMining,
    #[msg("Tool is not mining")]
    NotMining,
    #[msg("Lock period not yet expired")]
    LockNotExpired,
    #[msg("Cooldown period not yet expired")]
    CooldownNotExpired,
    #[msg("Legendary tools cannot be rerolled")]
    CannotRerollLegendary,
    #[msg("Reroll requires two tools of same rarity")]
    RerollMismatchedRarity,
    #[msg("Program already initialized")]
    AlreadyInitialized,
    #[msg("Invalid migration authority")]
    InvalidMigrationAuthority,
    #[msg("Vault balance insufficient for payout")]
    VaultInsufficient,
    #[msg("Invalid lock seconds for stake")]
    InvalidLockSeconds,
    #[msg("Tool type string too long")]
    ToolTypeTooLong,
    #[msg("Rent exemption check failed")]
    RentExemptionFailed,

    // ===== [НОВОЕ] для добавленной логики (см. AUDIT_AND_CHANGES.md) =====
    #[msg("Rarity counter account does not match the tool's target rarity")]
    RarityCounterMismatch,
    #[msg("No excess lamports available to sweep from gas tank")]
    NoExcessToSweep,
    #[msg("Invalid mint address")]
    InvalidMint,
    #[msg("No idle villagers available for mining")]
    NoIdleVillagers,
    #[msg("Requested mining hours exceed max hours for this tool rarity")]
    HoursExceedRarityCap,
    #[msg("Signer does not own this staked collector")]
    NotCollectorOwner,
    #[msg("Collector mint registry is not configured")]
    CollectorNotConfigured,

    // ===== [НОВОЕ] полная реализация TOR v4 =====
    #[msg("Commit hash does not match revealed secret")]
    CommitMismatch,
    #[msg("Commit has expired (SlotHashes window passed) — abort and refund")]
    CommitExpired,
    #[msg("Odds weights must sum to 10000 basis points")]
    InvalidOddsWeights,
    #[msg("Exploration cooldown has not expired")]
    ExplorationCooldown,
    #[msg("Daily exploration trip limit reached")]
    ExplorationDailyLimitReached,
    #[msg("Exploration tier is already at maximum")]
    ExplorationMaxTier,
    #[msg("Referral link already exists for this user")]
    ReferralAlreadyBound,
    #[msg("Referrer has reached their active referral cap")]
    ReferralCapReached,
    #[msg("A wallet cannot refer itself")]
    InvalidReferral,
    #[msg("Referral tier is already at maximum")]
    ReferralMaxTier,
    #[msg("Enchant slot is already at maximum level")]
    EnchantMaxLevel,
    #[msg("Auction has already ended")]
    AuctionEnded,
    #[msg("Auction has not ended yet")]
    AuctionNotEnded,
    #[msg("Bid must exceed current highest bid")]
    BidTooLow,
    #[msg("Listing/Offer/Auction is not active")]
    NotActive,
    #[msg("Rental period out of allowed range")]
    InvalidRentalDuration,
    #[msg("Rental is still active — cannot revoke without grace period")]
    RentalGraceNotExpired,
    #[msg("Signer is not the current operator of this tool")]
    NotToolOperator,
    #[msg("Order kinds/side do not cross (price/side mismatch)")]
    OrdersDoNotCross,
    #[msg("Order has no remaining amount")]
    OrderExhausted,
    #[msg("Lottery round is already drawn or closed")]
    LotteryRoundClosed,
    #[msg("Lottery round is not drawn yet")]
    LotteryNotDrawn,
    #[msg("Not the winning ticket for this round")]
    NotWinningTicket,
    #[msg("Daily lottery ticket limit reached")]
    LotteryDailyLimitReached,
    #[msg("Season reward level already claimed")]
    SeasonRewardAlreadyClaimed,
    #[msg("Season reward requires premium pass")]
    SeasonPremiumRequired,
    #[msg("Not enough XP for this season level")]
    SeasonInsufficientXp,
    #[msg("Season has ended")]
    SeasonEnded,
    #[msg("Lottery draw has not been committed yet")]
    LotteryDrawNotCommitted,
    #[msg("Lottery draw is already committed")]
    LotteryDrawAlreadyCommitted,
    #[msg("Revealed secret does not match committed hash")]
    InvalidHash,

    // =====================================================================
    // [БЛОК L] Хлебная экономика: новые ошибки
    // =====================================================================
    #[msg("Energy account depleted")]
    EnergyDepleted,
    #[msg("Energy cost exceeds available balance")]
    InsufficientEnergy,
    #[msg("Farm tile is busy (growing)")]
    FarmTileBusy,
    #[msg("Farm tile is not ready for harvest")]
    FarmTileNotReady,
    #[msg("Farm tile is empty (nothing planted)")]
    FarmTileEmpty,
    #[msg("Tool is busy (mining), cannot harvest")]
    ToolBusy,
    #[msg("Mill has active batch in progress")]
    MillInProgress,
    #[msg("Mill batch is not ready yet")]
    MillNotReady,
    #[msg("Oven has active batch in progress")]
    OvenInProgress,
    #[msg("Oven batch is not ready yet")]
    OvenNotReady,
    #[msg("Invalid batch size (must be 1, 2, or 3)")]
    InvalidBatchSize,
    #[msg("Invalid fuel kind (must be 0=wood or 1=coal)")]
    InvalidFuelKind,
    #[msg("Material mint is not registered in MaterialMints PDA")]
    MaterialNotRegistered,
    #[msg("Weather state already updated for this day")]
    WeatherAlreadyUpdated,
    #[msg("Well has no water to collect")]
    WellEmpty,
    #[msg("Recipe not found in RecipeConfig")]
    RecipeNotFound,
    #[msg("Fortune boost has expired")]
    FortuneBoostExpired,
    #[msg("Fortune boost is already active")]
    FortuneBoostAlreadyActive,
    #[msg("Love heart is not transferable")]
    LoveHeartNotTransferable,

    #[msg("Invalid amount")]
    InvalidAmount,

    #[msg("Durability overflow")]
    DurabilityOverflow,
    #[msg("Invalid weather seed (must be derived from slot hash)")]
    InvalidWeatherSeed,

    #[msg("Invalid reveal: hash mismatch")]
    InvalidReveal,
    #[msg("Commit already revealed")]
    AlreadyRevealed,
    #[msg("Invalid flask type")]
    InvalidFlaskType,
    #[msg("Energy cap exceeded")]
    EnergyCapExceeded,
    #[msg("Tool type is not valid for this instruction")]
    InvalidToolType,

    #[msg("Program data does not contain a valid upgrade authority")]
    InvalidProgramData,
    #[msg("Feature is disabled until its on-chain economic and recovery path is complete")]
    FeatureDisabled,
    #[msg("Commit is still inside its reveal window; it cannot be expired yet")]
    CommitNotExpired,
}
