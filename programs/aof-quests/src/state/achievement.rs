use anchor_lang::prelude::*;

#[account]
pub struct AchievementRecord {
    pub user: Pubkey,
    pub achievement_id: u32,
    pub bump: u8,
    pub unlocked_at: i64,
}

impl AchievementRecord {
    pub const SIZE: usize = 8 + 32 + 4 + 1 + 8;
}
