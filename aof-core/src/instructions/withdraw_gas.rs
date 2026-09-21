use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::constants::*;
use crate::WithdrawGas;
use crate::errors::*;

pub fn micros_to_lamports(micros: u64) -> Result<u64> {
    micros.checked_mul(MICROS_TO_LAMPORTS).ok_or(AofError::MathOverflow.into())
}

pub fn handler(ctx: Context<WithdrawGas>, amount: u64) -> Result<()> {
    require!(amount > 0, AofError::ZeroAmount);
    let now = Clock::get()?.unix_timestamp;
    require!(
        now >= ctx.accounts.gastank.cooldown_until,
        AofError::CooldownNotExpired
    );
    require!(
        amount <= ctx.accounts.gastank.balance_micros,
        AofError::InsufficientBalance
    );
    let lamports = micros_to_lamports(amount)?;

    let rent = Rent::get()?;
    let min_balance = rent.minimum_balance(GASTANK_SPACE);
    // [ФИКС]: Account<'info, T> не предоставляет .get_lamports() в
    // anchor-lang 0.30 — канонический способ через AccountInfo:
    let gastank_lamports = ctx.accounts.gastank.to_account_info().lamports();
    require!(
        gastank_lamports.checked_sub(lamports).ok_or(AofError::MathOverflow)? >= min_balance,
        AofError::RentExemptionFailed
    );

    // [ФИКС #2]: system_program::transfer запрещён для аккаунтов с данными.
    // Используем прямое манипулирование лампортами (канонический способ для PDA-аккаунтов).
    let gastank_info = ctx.accounts.gastank.to_account_info();
    let user_info = ctx.accounts.user.to_account_info();
    **gastank_info.try_borrow_mut_lamports()? -= lamports;
    **user_info.try_borrow_mut_lamports()? += lamports;
    ctx.accounts.gastank.balance_micros = ctx
        .accounts
        .gastank
        .balance_micros
        .checked_sub(amount)
        .ok_or(AofError::MathOverflow)?;
    // [AUDIT F-20] The 12h cooldown used to be armed by *every* withdrawal, so
    // a player with 0.5 SOL deposited could not touch their own funds again for
    // half a day, and a partial withdrawal burned the whole window. Small
    // withdrawals stay instant; the rate limit still applies to the sizes that
    // actually matter for draining the tank.
    if amount > GASTANK_INSTANT_WITHDRAW_MICROS {
        ctx.accounts.gastank.cooldown_until = now
            .checked_add(GASTANK_COOLDOWN_SECONDS)
            .ok_or(AofError::MathOverflow)?;
    }
    Ok(())
}
