use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, Transfer};
use crate::constants::*;
use crate::state::*;
use crate::Stake;
use crate::errors::*;
use crate::events::*;

pub fn handler(ctx: Context<Stake>, lock_seconds: i64) -> Result<()> {
    // valid range: 0 (no lock accepted as 1 min min) .. 1 year
    require!(
        lock_seconds >= 60 && lock_seconds <= 365 * 86400,
        AofError::InvalidLockSeconds
    );
    let now = Clock::get()?.unix_timestamp;
    // transfer token to vault
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_token.to_account_info(),
                to: ctx.accounts.vault_token.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        1,
    )?;
    ctx.accounts.tool.staked = true;
    ctx.accounts.tool.unlock_at = now.checked_add(lock_seconds).ok_or(AofError::MathOverflow)?;
    emit!(Staked {
        user: ctx.accounts.user.key(),
        mint: ctx.accounts.mint.key(),
    });
    Ok(())
}