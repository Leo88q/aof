use anchor_lang::prelude::*;

pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

pub use errors::*;
pub use instructions::*;
pub use state::*;

declare_id!("4rMWC1h9mt6JTfBsUPYLMCydPED4e31cffmix5nZyuRb");

#[program]
pub mod aof_rebirth {
    use super::*;

    // ===== [AUDIT F-02] two-step authority rotation =====
    pub fn set_pending_authority(ctx: Context<SetPendingAuthority>, new_authority: Pubkey) -> Result<()> {
        instructions::authority::set_pending_authority_handler(ctx, new_authority)
    }

    pub fn accept_authority(ctx: Context<AcceptAuthority>) -> Result<()> {
        instructions::authority::accept_authority_handler(ctx)
    }

    pub fn cancel_pending_authority(ctx: Context<CancelPendingAuthority>) -> Result<()> {
        instructions::authority::cancel_pending_authority_handler(ctx)
    }

    pub fn init_rebirth_config(
        ctx: Context<InitRebirthConfig>,
        bonus_per_rebirth_bps: u16,
        max_bonus_bps: u16,
        max_rebirths: u8,
        treasury: Pubkey,
        rebirth_cost_lamports: u64,
        cooldown_seconds: i64,
    ) -> Result<()> {
        instructions::init_rebirth_config::handler(ctx, bonus_per_rebirth_bps, max_bonus_bps, max_rebirths, treasury, rebirth_cost_lamports, cooldown_seconds)
    }

    pub fn do_rebirth(ctx: Context<DoRebirth>) -> Result<()> {
        instructions::do_rebirth::handler(ctx)
    }
}
