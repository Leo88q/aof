use anchor_lang::prelude::*;
use crate::state::RebirthConfig;
use crate::events::RebirthConfigInitialized;

#[derive(Accounts)]
pub struct InitRebirthConfig<'info> {
    #[account(
        init,
        payer = authority,
        space = RebirthConfig::SIZE,
        seeds = [b"rebirth_config"],
        bump
    )]
    pub rebirth_config: Account<'info, RebirthConfig>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitRebirthConfig>,
    bonus_per_rebirth_bps: u16,
    max_bonus_bps: u16,
    max_rebirths: u8,
    treasury: Pubkey,
    rebirth_cost_lamports: u64,
    cooldown_seconds: i64,
) -> Result<()> {
    let config = &mut ctx.accounts.rebirth_config;
    config.authority = ctx.accounts.authority.key();
    config.bump = ctx.bumps.rebirth_config;
    config.bonus_per_rebirth_bps = bonus_per_rebirth_bps;
    config.max_bonus_bps = max_bonus_bps;
    config.max_rebirths = max_rebirths;
    config.paused = false;
    // [ФИКС] цена возрождения + кулдаун
    config.treasury = treasury;
    config.rebirth_cost_lamports = rebirth_cost_lamports;
    config.cooldown_seconds = cooldown_seconds;

    emit!(RebirthConfigInitialized {
        authority: ctx.accounts.authority.key(),
        bonus_per_rebirth_bps,
        max_bonus_bps,
        max_rebirths,
    });

    Ok(())
}
