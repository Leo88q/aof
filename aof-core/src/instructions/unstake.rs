use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, Transfer};
use crate::constants::*;
use crate::state::*;
use crate::Unstake;
use crate::errors::*;
use crate::events::*;

pub fn handler(ctx: Context<Unstake>) -> Result<()> {
    // atomic fee from gastank
    require!(
        ctx.accounts.gastank.balance_micros >= ctx.accounts.config.unstake_fee,
        AofError::InsufficientBalance
    );
    ctx.accounts.gastank.balance_micros = ctx
        .accounts
        .gastank
        .balance_micros
        .checked_sub(ctx.accounts.config.unstake_fee)
        .ok_or(AofError::MathOverflow)?;
    // [ФИКС C6]: lock из stake реально блокирует ранний выход
    let now = Clock::get()?.unix_timestamp;
    require!(now >= ctx.accounts.tool.unlock_at, AofError::LockNotExpired);
    // transfer token back to user
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
        1,
    )?;
    ctx.accounts.tool.staked = false;
    ctx.accounts.tool.unlock_at = 0;
    emit!(Unstaked {
        user: ctx.accounts.user.key(),
        mint: ctx.accounts.mint.key(),
    });
    Ok(())
}