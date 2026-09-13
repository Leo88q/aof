use anchor_lang::prelude::*;

#[event]
pub struct RebirthConfigInitialized {
    pub authority: Pubkey,
    pub bonus_per_rebirth_bps: u16,
    pub max_bonus_bps: u16,
    pub max_rebirths: u8,
}

#[event]
pub struct RebirthPerformed {
    pub user: Pubkey,
    pub generation: u16,
    pub rebirth_count: u8,
    pub permanent_bonus_bps: u16,
}
