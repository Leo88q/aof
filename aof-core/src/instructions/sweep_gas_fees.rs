use anchor_lang::prelude::*;
use crate::constants::*;
use crate::SweepGasFees;
use crate::errors::*;
use crate::events::*;

/// [НОВОЕ]: craft/unstake списывают gastank.balance_micros логически, но
/// физические lamports остаются лежать в PDA пользователя навсегда — казна
/// их не получает без этой инструкции.
///
/// [SECURITY_CHECKLIST_REVIEW F-A] The sweep used `system_program::transfer`
/// with the gastank PDA as `from`. The System Program only debits accounts it
/// owns and that carry no data, while the gastank is owned by this program and
/// holds `GasTank` state, so every sweep failed and the fees never reached the
/// treasury. `withdraw_gas` already moves lamports directly for this reason;
/// the sweep now does the same through `economics::transfer_owned_lamports`
/// (owner == crate::ID, both writable, from != to, reserve preserved).
///
/// The reserve that must stay in the tank is everything that still belongs to
/// the user: the logical balance, the sub-micro `dust_lamports` carried over by
/// `deposit_gas` (sweeping it would take the user's funds), and rent.
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

    let floor = owed_lamports
        .checked_add(ctx.accounts.gastank.dust_lamports)
        .ok_or(AofError::MathOverflow)?
        .checked_add(min_balance)
        .ok_or(AofError::MathOverflow)?;
    require!(current_lamports > floor, AofError::NoExcessToSweep);
    let excess = current_lamports.checked_sub(floor).ok_or(AofError::MathOverflow)?;

    let gastank_info = ctx.accounts.gastank.to_account_info();
    let treasury_info = ctx.accounts.treasury.to_account_info();
    crate::economics::transfer_owned_lamports(&gastank_info, &treasury_info, excess, floor)?;

    emit!(GasFeesSwept {
        to: ctx.accounts.treasury.key(),
        amount_lamports: excess,
    });
    Ok(())
}
