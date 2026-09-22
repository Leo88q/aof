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
}
