use anchor_lang::prelude::*;

#[error_code]
pub enum MarketError {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Program or pool is paused")]
    Paused,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Price must be greater than zero")]
    ZeroPrice,
    #[msg("Fee or rate is outside the supported bounds")]
    InvalidFee,
    #[msg("Rate is outside the supported bounds")]
    InvalidRate,
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Slippage: price moved past max_price/min_price")]
    SlippageExceeded,
    #[msg("Hot window duration out of range")]
    InvalidWindowDuration,
    #[msg("Order is not active")]
    OrderNotActive,
    #[msg("Market trading is disabled until canonical ToolData transfer is implemented")]
    TradingDisabled,
    #[msg("Insufficient reserve in pool")]
    InsufficientReserve,
}
