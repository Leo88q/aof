use anchor_lang::prelude::*;

#[account]
pub struct DrumCommit {
    pub user: Pubkey,
    pub bump: u8,
    pub hash: [u8; 32],
    pub created_at: i64,
}

impl DrumCommit {
    pub const SIZE: usize = 8 + 32 + 1 + 32 + 8;
}
