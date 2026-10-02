use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount};
use crate::errors::QuestError;
use crate::state::{MindBank, QuestConfig, MIND_BANK_SEED, MIND_DECIMALS};

/// Versioned custody: separate from the existing QuestConfig treasury used by
/// historical quest/drum refunds. This instruction does not mint tokens, sell
/// spins, or enable new payments. The operator funds the bank ATA separately.
#[derive(Accounts)]
pub struct InitMindBank<'info> {
    #[account(seeds = [b"quest_config"], bump = quest_config.bump, has_one = authority @ QuestError::Unauthorized)]
    pub quest_config: Account<'info, QuestConfig>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub mind_mint: Account<'info, Mint>,
    #[account(init, payer = authority, space = MindBank::SIZE, seeds = [MIND_BANK_SEED], bump)]
    pub mind_bank: Box<Account<'info, MindBank>>,
    #[account(init, payer = authority, associated_token::mint = mind_mint, associated_token::authority = mind_bank)]
    pub mind_vault: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn init_handler(ctx: Context<InitMindBank>) -> Result<()> {
    require!(ctx.accounts.mind_mint.is_initialized && ctx.accounts.mind_mint.decimals == MIND_DECIMALS, QuestError::InvalidMindMint);
    let bank = &mut ctx.accounts.mind_bank;
    bank.mint = ctx.accounts.mind_mint.key();
    bank.vault = ctx.accounts.mind_vault.key();
    bank.reserved_atoms = 0;
    bank.open_spins = 0;
    bank.paused = true; // explicit operator action after signed devnet tests
    bank.bump = ctx.bumps.mind_bank;
    Ok(())
}

#[derive(Accounts)]
pub struct SetMindBankPaused<'info> {
    #[account(seeds = [b"quest_config"], bump = quest_config.bump, has_one = authority @ QuestError::Unauthorized)]
    pub quest_config: Account<'info, QuestConfig>,
    pub authority: Signer<'info>,
    #[account(mut, seeds = [MIND_BANK_SEED], bump = mind_bank.bump)]
    pub mind_bank: Account<'info, MindBank>,
}

pub fn set_paused_handler(ctx: Context<SetMindBankPaused>, paused: bool) -> Result<()> {
    // Refund/reveal paths must never depend on paused. The switch applies only
    // to future V2 commits, whose implementation is still release-gated.
    ctx.accounts.mind_bank.paused = paused;
    Ok(())
}
