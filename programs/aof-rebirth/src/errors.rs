use anchor_lang::prelude::*;

#[error_code]
pub enum RebirthError {
    #[msg("Rebirth paused")]
    Paused,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Max rebirths reached")]
    MaxRebirthsReached,
    #[msg("Bonus cap reached")]
    BonusCapReached,
    #[msg("Not eligible for rebirth")]
    NotEligible,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Rebirth cooldown still active")]
    CooldownActive,
    #[msg("Rebirth is disabled until the full reset is atomic")]
    FeatureDisabled,
}
