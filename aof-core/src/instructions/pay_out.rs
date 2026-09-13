use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, Transfer};
use crate::constants::*;
use crate::state::*;
use crate::PayOut;
use crate::errors::*;
use crate::events::*;

pub fn handler(ctx: Context<PayOut>, amount: u64) -> Result<()> {
    require!(amount > 0, AofError::ZeroAmount);
    require!(
        ctx.accounts.vault_token.amount >= amount,
        AofError::VaultInsufficient
    );
    let vault_seeds = &[VAULT_SEED, &[ctx.bumps.vault]];
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_token.to_account_info(),
                to: ctx.accounts.user_token.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
            },
            &[vault_seeds],
        ),
        amount,
    )?;
    emit!(PaidOut {
        user: ctx.accounts.user_token.owner,
        amount,
        vault_balance_after: ctx
            .accounts
            .vault_token
            .amount
            .checked_sub(amount)
            .ok_or(AofError::MathOverflow)?,
    });
    Ok(())
}