use anchor_lang::prelude::*;
use crate::state::LpConfig;
use crate::events::LpConfigInitialized;
use crate::errors::LiquidityError;

#[derive(Accounts)]
pub struct InitLpConfig<'info> {
    #[account(
        init,
        payer = authority,
        space = LpConfig::SIZE,
        seeds = [b"lp_config"],
        bump
    )]
    pub lp_config: Account<'info, LpConfig>,

    #[account(mut)]
    pub authority: Signer<'info>,
    /// Canonical upgrade authority for the one-time LP-config bootstrap.
    #[account(address = Pubkey::find_program_address(
        &[crate::ID.as_ref()],
        &anchor_lang::solana_program::bpf_loader_upgradeable::id()
    ).0)]
    pub program_data: Account<'info, anchor_lang::ProgramData>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitLpConfig>, mascot_mint: Pubkey) -> Result<()> {
    let upgrade_authority = ctx
        .accounts
        .program_data
        .upgrade_authority_address
        .ok_or(LiquidityError::Unauthorized)?;
    require_keys_eq!(upgrade_authority, ctx.accounts.authority.key(), LiquidityError::Unauthorized);

    let config = &mut ctx.accounts.lp_config;
    config.authority = ctx.accounts.authority.key();
    config.bump = ctx.bumps.lp_config;
    config.mascot_mint = mascot_mint;
    config.paused = false;
    // [AUDIT F-02] no rotation in flight at bootstrap.
    config.pending_authority = Pubkey::default();
    config.authority_updated_at = Clock::get()?.unix_timestamp;

    emit!(LpConfigInitialized {
        authority: ctx.accounts.authority.key(),
        mascot_mint,
    });

    Ok(())
}
