use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::constants::*;
use crate::{RentalListCtx, RentalStartCtx, RentalEndCtx, RentalRevokeCtx};
use crate::errors::*;
use crate::events::*;

pub fn list_handler(
    ctx: Context<RentalListCtx>,
    owner_split_bps: u16,
    min_duration: i64,
    max_duration: i64,
    price_per_hour_lamports: u64,
) -> Result<()> {
    require!(
        min_duration >= RENTAL_MIN_DURATION_SECONDS && max_duration <= RENTAL_MAX_DURATION_SECONDS
            && min_duration <= max_duration,
        AofError::InvalidRentalDuration
    );
    // [ФИКС] Сплит в пределах 0..=10000 bps
    require!(owner_split_bps <= 10_000, AofError::MathOverflow);

    let l = &mut ctx.accounts.rental_listing;
    l.owner = ctx.accounts.owner.key();
    l.mint = ctx.accounts.mint.key();
    l.owner_split_bps = owner_split_bps;
    l.min_duration = min_duration;
    l.max_duration = max_duration;
    l.active = true;
    // [ФИКС] Цена аренды за час
    l.price_per_hour_lamports = price_per_hour_lamports;
    Ok(())
}

/// Аренда НЕ требует трансфера NFT — владение (`owner`) не меняется,
/// меняется только `operator`, которого проверяют start_mining/collect_mining/
/// repair (Solana-эквивалент "delegate authority" из TOR v4 §5.3).
///
/// [ФИКС Группы 3]: аренда теперь ПЛАТНАЯ — арендатор платит авансом за весь
/// срок, сумма делится между владельцем (owner_split_bps) и казной (остаток).
/// Раньше аренда была полностью бесплатной, owner_split_bps был мёртв.
pub fn start_handler(ctx: Context<RentalStartCtx>, duration_seconds: i64) -> Result<()> {
    require!(ctx.accounts.rental_listing.active, AofError::NotActive);
    require!(
        duration_seconds >= ctx.accounts.rental_listing.min_duration
            && duration_seconds <= ctx.accounts.rental_listing.max_duration,
        AofError::InvalidRentalDuration
    );
    require!(
        ctx.accounts.tool.operator == ctx.accounts.tool.owner,
        AofError::NotActive // уже сдан кому-то другому
    );

    // [ФИКС] Плата за аренду: аванс за весь срок, сплит владелец/казна
    let listing = &ctx.accounts.rental_listing;
    let total_fee = listing
        .price_per_hour_lamports
        .checked_mul(duration_seconds as u64)
        .ok_or(AofError::MathOverflow)?
        / 3600;

    if total_fee > 0 {
        let owner_share = total_fee
            .checked_mul(listing.owner_split_bps as u64)
            .ok_or(AofError::MathOverflow)?
            / 10_000;
        let treasury_share = total_fee
            .checked_sub(owner_share)
            .ok_or(AofError::MathOverflow)?;

        if owner_share > 0 {
            system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer {
                        from: ctx.accounts.renter.to_account_info(),
                        to: ctx.accounts.owner.to_account_info(),
                    },
                ),
                owner_share,
            )?;
        }
        if treasury_share > 0 {
            system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer {
                        from: ctx.accounts.renter.to_account_info(),
                        to: ctx.accounts.treasury.to_account_info(),
                    },
                ),
                treasury_share,
            )?;
        }
    }

    let now = Clock::get()?.unix_timestamp;
    let end = now.checked_add(duration_seconds).ok_or(AofError::MathOverflow)?;

    ctx.accounts.tool.operator = ctx.accounts.renter.key();

    let ra = &mut ctx.accounts.rental_agreement;
    ra.mint = ctx.accounts.mint.key();
    ra.owner = ctx.accounts.rental_listing.owner;
    ra.renter = ctx.accounts.renter.key();
    ra.start = now;
    ra.end = end;
    ra.revoke_requested_at = 0;

    emit!(RentalStarted {
        mint: ctx.accounts.mint.key(),
        owner: ra.owner,
        renter: ra.renter,
        end_time: end,
    });
    Ok(())
}

/// Обычное завершение — после `end`, вызывается кем угодно (рентер или
/// владелец), возвращает operator владельцу.
pub fn end_handler(ctx: Context<RentalEndCtx>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let is_renter = ctx.accounts.caller.key() == ctx.accounts.rental_agreement.renter;
    let past_end = now >= ctx.accounts.rental_agreement.end;
    require!(is_renter || past_end, AofError::RentalGraceNotExpired);

    // Resolve to the current ToolData owner rather than trusting the owner
    // snapshot in the agreement. This also repairs agreements created before
    // an ownership transfer was blocked by the settlement constraints.
    let current_owner = ctx.accounts.tool.owner;
    ctx.accounts.tool.operator = current_owner;
    emit!(RentalEnded {
        mint: ctx.accounts.mint.key(),
        owner: current_owner,
    });
    Ok(())
}

/// Досрочный принудительный отзыв владельцем — с grace period 12ч
/// (см. TOR v4 §4.2: "доступен, но с 12ч grace period для арендатора").
/// Первый вызов только фиксирует момент запроса; фактическое завершение —
/// повторный вызов после истечения grace.
pub fn revoke_handler(ctx: Context<RentalRevokeCtx>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let revoke_requested_at = ctx.accounts.rental_agreement.revoke_requested_at;
    if revoke_requested_at == 0 {
        ctx.accounts.rental_agreement.revoke_requested_at = now;
        return Ok(());
    }
    require!(
        now >= revoke_requested_at + RENTAL_REVOKE_GRACE_SECONDS,
        AofError::RentalGraceNotExpired
    );
    let current_owner = ctx.accounts.tool.owner;
    ctx.accounts.tool.operator = current_owner;
    // Do not put `close = renter_refund` on RentalRevokeCtx: Anchor would
    // close the agreement even on the first call that only records the grace
    // period. Close it only after the grace period has elapsed.
    ctx.accounts
        .rental_agreement
        .close(ctx.accounts.renter_refund.to_account_info())?;
    emit!(RentalEnded {
        mint: ctx.accounts.mint.key(),
        owner: current_owner,
    });
    Ok(())
}
