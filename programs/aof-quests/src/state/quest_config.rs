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
    /// [AUDIT F-02] Two-step authority rotation. Before this, the authority
    /// captured by the first `initialize()` was permanent: no instruction in any
    /// of the six programs could change it, so rotating a hot key or moving to a
    /// multisig required a redeploy plus an account migration.
    pub pending_authority: Pubkey,
    pub authority_updated_at: i64,
}

impl QuestConfig {
    pub const SIZE: usize = (8 + 32 + 1 + 32 + 32 + 1) + 32 + 8;
}
