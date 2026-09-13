use anchor_lang::prelude::*;

#[account]
pub struct QuestProgress {
    pub user: Pubkey,
    pub quest_id: u32,
    pub bump: u8,
    pub completed: bool,
    pub claimed: bool,
}

impl QuestProgress {
    pub const SIZE: usize = 8 + 32 + 4 + 1 + 1 + 1;
}
