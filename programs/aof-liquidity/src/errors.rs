use anchor_lang::prelude::*;

#[error_code]
pub enum LiquidityError {
    #[msg("Liquidity paused")]
    Paused,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Invalid rarity: must be 1-4")]
    InvalidRarity,
    #[msg("Not enough shares")]
    NotEnoughShares,
    #[msg("Zero amount")]
    ZeroAmount,
    #[msg("Math overflow")]
    MathOverflow,

    // ===== [AUDIT F-02] authority rotation =====
    #[msg("No authority rotation is pending")]
    NoPendingAuthority,
    #[msg("Signer is not the pending authority")]
    NotPendingAuthority,
    #[msg("Invalid input")]
    InvalidInput,
}
