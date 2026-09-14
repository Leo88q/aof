use anchor_lang::prelude::*;
use crate::state::RebirthConfig;
use crate::events::RebirthConfigInitialized;
use crate::errors::RebirthError;

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
    /// Canonical upgrade authority for the one-time rebirth-config bootstrap.
    #[account(address = Pubkey::find_program_address(
        &[crate::ID.as_ref()],
        &anchor_lang::solana_program::bpf_loader_upgradeable::id()
    ).0)]
    pub program_data: Account<'info, anchor_lang::ProgramData>,
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
    let upgrade_authority = ctx
        .accounts
        .program_data
        .upgrade_authority_address
        .ok_or(RebirthError::Unauthorized)?;
    require_keys_eq!(upgrade_authority, ctx.accounts.authority.key(), RebirthError::Unauthorized);

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
