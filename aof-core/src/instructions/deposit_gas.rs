use anchor_lang::prelude::*;
use crate::constants::*;
use crate::state::*;
use crate::errors::*;
use crate::DepositGas;

/// Canonical converter lamports -> micros (1e9/1e3 = 1e6).
pub fn lamports_to_micros(lamports: u64) -> Result<u64> {
    Ok(lamports / MICROS_TO_LAMPORTS)
}

pub fn handler(ctx: Context<DepositGas>, amount: u64) -> Result<()> {
    require!(amount > 0, AofError::ZeroAmount);
    // transfer SOL lamports from user to gastank PDA
    let cpi = anchor_lang::system_program::Transfer {
        from: ctx.accounts.user.to_account_info(),
        to: ctx.accounts.gastank.to_account_info(),
    };
    anchor_lang::system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            cpi,
        ),
        amount,
    )?;
    // [AUDIT F-20] Credit micros for the deposit plus any dust carried over
    // from previous sub-micro deposits, and keep the new remainder. Nothing is
    // lost: the leftover becomes the first lamports of the next deposit.
    let total = amount
        .checked_add(ctx.accounts.gastank.dust_lamports)
        .ok_or(AofError::MathOverflow)?;
    let micros = lamports_to_micros(total)?;
    ctx.accounts.gastank.dust_lamports = total % MICROS_TO_LAMPORTS;
    ctx.accounts.gastank.owner = ctx.accounts.user.key();
    ctx.accounts.gastank.balance_micros = ctx
        .accounts
        .gastank
        .balance_micros
        .checked_add(micros)
        .ok_or(AofError::MathOverflow)?;
    Ok(())
}