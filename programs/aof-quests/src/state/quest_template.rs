use anchor_lang::prelude::*;

#[account]
pub struct QuestTemplate {
    pub quest_id: u32,
    pub bump: u8,
    pub reward_mascot: u64,
    pub active: bool,
}

impl QuestTemplate {
    pub const SIZE: usize = 8 + 4 + 1 + 8 + 1;
}
