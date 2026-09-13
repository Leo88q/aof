use anchor_lang::prelude::*;

#[account]
pub struct LpConfig {
    pub authority: Pubkey,
    pub bump: u8,
    /// Маскот-токен для ликвидности (существующий официальный токен)
    pub mascot_mint: Pubkey,
    pub paused: bool,
}

impl LpConfig {
    pub const SIZE: usize = 8 + 32 + 1 + 32 + 1;
}
