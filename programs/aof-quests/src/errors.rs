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
}
