use anchor_lang::prelude::*;

#[error_code]
pub enum MarketError {
    #[msg("Market is paused")]
    Paused,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Invalid rarity: must be 1-4")]
    InvalidRarity,
    #[msg("Slippage exceeded")]
    SlippageExceeded,
    #[msg("Insufficient reserve")]
    InsufficientReserve,
    #[msg("Invalid hot window duration")]
    InvalidWindowDuration,
    #[msg("Order is not active")]
    OrderNotActive,
    #[msg("Invalid tier: must be 1-5")]
    InvalidTier,
}
