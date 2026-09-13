use anchor_lang::prelude::*;

#[account]
pub struct LpPosition {
    pub user: Pubkey,
    pub rarity: u8,
    pub bump: u8,
    pub shares: u64,
    pub deposited_at: i64,
}

impl LpPosition {
    pub const SIZE: usize = 8 + 32 + 1 + 1 + 8 + 8;
}
