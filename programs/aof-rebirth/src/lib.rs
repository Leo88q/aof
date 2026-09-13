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
