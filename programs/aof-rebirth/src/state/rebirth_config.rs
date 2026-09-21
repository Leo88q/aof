use anchor_lang::prelude::*;

#[account]
pub struct RebirthConfig {
    pub authority: Pubkey,
    pub bump: u8,
    /// Бонус за каждый ребёрт в bps (200 = +2%)
    pub bonus_per_rebirth_bps: u16,
    /// Кап суммарного бонуса в bps (2000 = +20%)
    pub max_bonus_bps: u16,
    /// Максимум ребёртов
    pub max_rebirths: u8,
    pub paused: bool,
    // [ФИКС] Цена возрождения: ребёрт больше не бесплатный
    pub treasury: Pubkey,
    pub rebirth_cost_lamports: u64,
    // [ФИКС] Кулдаун между ребёртами (секунды)
    pub cooldown_seconds: i64,
    /// [AUDIT F-02] Two-step authority rotation. Before this, the authority
    /// captured by the first `initialize()` was permanent: no instruction in any
    /// of the six programs could change it, so rotating a hot key or moving to a
    /// multisig required a redeploy plus an account migration.
    pub pending_authority: Pubkey,
    pub authority_updated_at: i64,
}

impl RebirthConfig {
    pub const SIZE: usize = (8 + 32 + 1 + 2 + 2 + 1 + 1 + 32 + 8 + 8) + 32 + 8;
}
