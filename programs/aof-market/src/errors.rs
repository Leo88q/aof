use anchor_lang::prelude::*;

#[error_code]
pub enum MarketError {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Program or pool is paused")]
    Paused,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Slippage: price moved past max_price/min_price")]
    SlippageExceeded,
    #[msg("Hot window duration out of range")]
    InvalidWindowDuration,
    #[msg("Order is not active")]
    OrderNotActive,
    #[msg("Insufficient reserve in pool")]
    InsufficientReserve,
}
