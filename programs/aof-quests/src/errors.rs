use anchor_lang::prelude::*;

#[error_code]
pub enum QuestError {
    #[msg("Quests paused")]
    Paused,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Quest not active")]
    QuestNotActive,
    #[msg("Quest not completed")]
    QuestNotCompleted,
    #[msg("Reward already claimed")]
    AlreadyClaimed,
    #[msg("Achievement already unlocked")]
    AlreadyUnlocked,
    #[msg("Challenge not active")]
    ChallengeNotActive,
    #[msg("Invalid hash")]
    InvalidHash,
    #[msg("Commit expired")]
    CommitExpired,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Feature disabled until its economic proof is implemented")]
    FeatureDisabled,

    // ===== [AUDIT F-02] authority rotation =====
    #[msg("No authority rotation is pending")]
    NoPendingAuthority,
    #[msg("Signer is not the pending authority")]
    NotPendingAuthority,
    #[msg("Invalid input")]
    InvalidInput,
    #[msg("Invalid data")]
    InvalidData,
    #[msg("Already initialized")]
    AlreadyInitialized,

    // Appended codes must not move.
    #[msg("Not a randomness account of the trusted program")]
    InvalidRandomnessAccount,
    #[msg("Randomness is not freshly committed")]
    RandomnessNotFresh,
    #[msg("Randomness has not been revealed in this slot")]
    RandomnessNotRevealed,
    #[msg("VRF pool slot is busy with another commit")]
    VrfSlotBusy,
    #[msg("VRF pool slot is retired")]
    VrfSlotRetired,
    #[msg("VRF pool slot is not held by this commit")]
    VrfSlotNotHeld,
    #[msg("Reveal window has closed; the spin can only be refunded")]
    RevealWindowClosed,
    #[msg("Spin is still inside its reveal window")]
    CommitNotExpired,
    #[msg("Mascot treasury cannot cover the largest prize")]
    TreasuryTooLow,
    #[msg("Mind bank is paused; new spins cannot be accepted")]
    MindBankPaused,
    #[msg("The isolated MIND vault cannot cover all outstanding spin obligations")]
    MindBankInsolvent,
    #[msg("MIND mint must be an initialized 9-decimal SPL token")]
    InvalidMindMint,
}
