use anchor_lang::prelude::*;

#[account]
pub struct QuestConfig {
    pub authority: Pubkey,
    pub bump: u8,
    /// Маскот-токен для наград (существующий официальный токен)
    pub mascot_mint: Pubkey,
    /// SPL аккаунт казны с маскот-токенами (откуда выдаются награды)
    pub treasury_mascot: Pubkey,
    pub paused: bool,
}

impl QuestConfig {
    pub const SIZE: usize = 8 + 32 + 1 + 32 + 32 + 1;
}
