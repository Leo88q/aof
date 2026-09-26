use anchor_lang::prelude::*;

#[event]
pub struct QuestConfigInitialized {
    pub authority: Pubkey,
    pub mascot_mint: Pubkey,
}

#[event]
pub struct QuestCreated {
    pub quest_id: u32,
    pub reward_mascot: u64,
}

#[event]
pub struct QuestRewardClaimed {
    pub user: Pubkey,
    pub quest_id: u32,
    pub reward_mascot: u64,
}

#[event]
pub struct AchievementUnlocked {
    pub user: Pubkey,
    pub achievement_id: u32,
}

#[event]
pub struct ChallengeCreated {
    pub week_number: u32,
    pub medals_pool: u64,
}

#[event]
pub struct ChallengeContributed {
    pub user: Pubkey,
    pub week_number: u32,
    pub medals: u64,
}

#[event]
pub struct DrumCommitted {
    pub user: Pubkey,
}

#[event]
pub struct DrumRevealed {
    pub user: Pubkey,
}

/// [AUDIT F-02] Authority rotation, both steps.
#[event]
pub struct AuthorityRotationProposed {
    pub previous: Pubkey,
    pub next: Pubkey,
    pub at: i64,
}

#[event]
pub struct AuthorityChanged {
    pub previous: Pubkey,
    pub next: Pubkey,
    pub at: i64,
}

/// [SECURITY_CHECKLIST_REVIEW F-C] A cancelled authority rotation used to be
/// silent, so monitoring could not see a proposed takeover being withdrawn.
#[event]
pub struct AuthorityRotationCancelled {
    pub authority: Pubkey,
    pub cancelled: Pubkey,
    pub slot: u64,
}
