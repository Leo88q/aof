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
    #[msg("Insufficient reserve in pool")]
    InsufficientReserve,

    // ===== [AUDIT F-02] authority rotation =====
    #[msg("No authority rotation is pending")]
    NoPendingAuthority,
    #[msg("Signer is not the pending authority")]
    NotPendingAuthority,
    #[msg("Invalid input")]
    InvalidInput,

    // ===== [F-CURRENCY-01] canonical currency binding =====
    /// `currency_mint` не совпал с каноническим минтом ВЫБРАННОЙ валюты
    /// (`MarketConfig.core_mint` / `MarketConfig.gem_mint`).
    ///
    /// Объявлен последним намеренно: Anchor выдаёт коды в порядке объявления,
    /// и вставка в середину сдвинула бы `NoPendingAuthority`/`NotPendingAuthority`/
    /// `InvalidInput` (6012–6014), на которые уже смотрят клиенты и IDL.
    #[msg("Currency mint is not the canonical mint for the selected currency")]
    InvalidCurrencyMint,
}
