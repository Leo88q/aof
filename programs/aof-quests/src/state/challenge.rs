use anchor_lang::prelude::*;

#[account]
pub struct ChallengeRound {
    pub week_number: u32,
    pub bump: u8,
    pub medals_pool: u64,
    pub contributed_total: u64,
    pub active: bool,
}

impl ChallengeRound {
    pub const SIZE: usize = 8 + 4 + 1 + 8 + 8 + 1;
}

#[account]
pub struct ChallengeContribution {
    pub user: Pubkey,
    pub week_number: u32,
    pub bump: u8,
    pub medals: u64,
}

impl ChallengeContribution {
    pub const SIZE: usize = 8 + 32 + 4 + 1 + 8;
}
