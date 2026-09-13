use anchor_lang::prelude::*;
use crate::state::LpConfig;
use crate::events::LpConfigInitialized;

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
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitLpConfig>, mascot_mint: Pubkey) -> Result<()> {
    let config = &mut ctx.accounts.lp_config;
    config.authority = ctx.accounts.authority.key();
    config.bump = ctx.bumps.lp_config;
    config.mascot_mint = mascot_mint;
    config.paused = false;

    emit!(LpConfigInitialized {
        authority: ctx.accounts.authority.key(),
        mascot_mint,
    });

    Ok(())
}
