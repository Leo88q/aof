use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount};
use crate::errors::QuestError;
use crate::state::{PotatoBank, QuestConfig, POTATO_BANK_SEED, POTATO_DECIMALS};

/// Versioned custody: separate from the existing QuestConfig treasury used by
/// historical quest/drum refunds. This instruction does not mint tokens, sell
/// spins, or enable new payments. The operator funds the bank ATA separately.
#[derive(Accounts)]
pub struct InitPotatoBank<'info> {
    #[account(seeds = [b"quest_config"], bump = quest_config.bump, has_one = authority @ QuestError::Unauthorized)]
    pub quest_config: Account<'info, QuestConfig>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub potato_mint: Account<'info, Mint>,
    #[account(init, payer = authority, space = PotatoBank::SIZE, seeds = [POTATO_BANK_SEED], bump)]
    pub potato_bank: Box<Account<'info, PotatoBank>>,
    #[account(init, payer = authority, associated_token::mint = potato_mint, associated_token::authority = potato_bank)]
    pub potato_vault: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn init_handler(ctx: Context<InitPotatoBank>) -> Result<()> {
    require!(ctx.accounts.potato_mint.is_initialized && ctx.accounts.potato_mint.decimals == POTATO_DECIMALS, QuestError::InvalidPotatoMint);
    let bank = &mut ctx.accounts.potato_bank;
    bank.mint = ctx.accounts.potato_mint.key();
    bank.vault = ctx.accounts.potato_vault.key();
    bank.reserved_atoms = 0;
    bank.open_spins = 0;
    bank.paused = true; // explicit operator action after signed devnet tests
    bank.bump = ctx.bumps.potato_bank;
    Ok(())
}

#[derive(Accounts)]
pub struct SetPotatoBankPaused<'info> {
    #[account(seeds = [b"quest_config"], bump = quest_config.bump, has_one = authority @ QuestError::Unauthorized)]
    pub quest_config: Account<'info, QuestConfig>,
    pub authority: Signer<'info>,
    #[account(mut, seeds = [POTATO_BANK_SEED], bump = potato_bank.bump)]
    pub potato_bank: Account<'info, PotatoBank>,
}

pub fn set_paused_handler(ctx: Context<SetPotatoBankPaused>, paused: bool) -> Result<()> {
    // Refund/reveal paths must never depend on paused. The switch applies only
    // to future V2 commits, whose implementation is still release-gated.
    ctx.accounts.potato_bank.paused = paused;
    Ok(())
}
