use anchor_lang::prelude::*;
use anchor_spl::token::Mint;
use crate::state::MascotConfig;
use crate::errors::MarketError;
use crate::events::MarketConfigInitialized;

#[derive(Accounts)]
pub struct InitMarketConfig<'info> {
    #[account(
        init,
        payer = authority,
        space = MascotConfig::SIZE,
        seeds = [b"mascot_config"],
        bump
    )]
    pub mascot_config: Account<'info, MascotConfig>,

    #[account()]
    pub mascot_mint: Account<'info, Mint>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitMarketConfig>,
    treasury_mascot: Pubkey,
    treasury_sol: Pubkey,
    fee_bps: u16,
) -> Result<()> {
    require!(fee_bps <= 1000, MarketError::FeeTooHigh);

    let config = &mut ctx.accounts.mascot_config;
    config.mascot_mint = ctx.accounts.mascot_mint.key();
    config.authority = ctx.accounts.authority.key();
    config.bump = ctx.bumps.mascot_config;
    config.treasury_mascot = treasury_mascot;
    config.treasury_sol = treasury_sol;
    config.fee_bps = fee_bps;
    config.paused = false;

    emit!(MarketConfigInitialized {
        mascot_mint: ctx.accounts.mascot_mint.key(),
        fee_bps,
    });

    Ok(())
}
