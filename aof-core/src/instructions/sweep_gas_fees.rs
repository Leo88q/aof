use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::constants::*;
use crate::SweepGasFees;
use crate::errors::*;
use crate::events::*;

/// [НОВОЕ]: craft/unstake списывают gastank.balance_micros логически, но
/// физические lamports остаются лежать в PDA пользователя навсегда — казна
/// их не получает без этой инструкции.
pub fn handler(ctx: Context<SweepGasFees>) -> Result<()> {
    let rent = Rent::get()?;
    let min_balance = rent.minimum_balance(GASTANK_SPACE);

    let current_lamports = ctx.accounts.gastank.to_account_info().lamports();
    let owed_lamports = ctx
        .accounts
        .gastank
        .balance_micros
        .checked_mul(MICROS_TO_LAMPORTS)
        .ok_or(AofError::MathOverflow)?;

    let floor = owed_lamports.checked_add(min_balance).ok_or(AofError::MathOverflow)?;
    require!(current_lamports > floor, AofError::NoExcessToSweep);
    let excess = current_lamports.checked_sub(floor).ok_or(AofError::MathOverflow)?;

    let owner_key = ctx.accounts.gastank.owner;
    let bump = ctx.bumps.gastank;
    let seeds = &[GASTANK_SEED, owner_key.as_ref(), &[bump]];
    let signer = &[&seeds[..]];
    let cpi = system_program::Transfer {
        from: ctx.accounts.gastank.to_account_info(),
        to: ctx.accounts.treasury.to_account_info(),
    };
    system_program::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            cpi,
            signer,
        ),
        excess,
    )?;

    emit!(GasFeesSwept {
        to: ctx.accounts.treasury.key(),
        amount_lamports: excess,
    });
    Ok(())
}
