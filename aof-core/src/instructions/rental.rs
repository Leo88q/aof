use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{self, CloseAccount, Transfer};
use crate::constants::*;
use crate::{RentalDelistCtx, RentalListCtx, RentalStartCtx, RentalEndCtx, RentalRevokeCtx};
use crate::errors::*;
use crate::events::*;

/// [SECURITY_CHECKLIST_REVIEW F-H] (owner share, platform share) of a rental
/// fee. The owner share is capped at RENTAL_MAX_OWNER_SPLIT_BPS, also for
/// listings created before the cap (100% owner splits used to zero the fee).
pub fn rental_fee_split(price_per_hour: u64, duration_seconds: i64, owner_split_bps: u16) -> Result<(u64, u64)> {
    require!(duration_seconds > 0, AofError::InvalidRentalDuration);
    let total = (price_per_hour as u128)
        .checked_mul(duration_seconds as u128)
        .ok_or(AofError::MathOverflow)?
        / 3600;
    let total = u64::try_from(total).map_err(|_| AofError::MathOverflow)?;
    let split = owner_split_bps.min(RENTAL_MAX_OWNER_SPLIT_BPS) as u128;
    let owner_share = (total as u128 * split / 10_000) as u64;
    Ok((owner_share, total - owner_share))
}

/// [SECURITY_CHECKLIST_REVIEW F-H] Part of the owner's share the renter gets
/// back when the owner revokes early: pro rata to the unused time.
pub fn rental_refund(owner_share: u64, start: i64, end: i64, now: i64) -> u64 {
    if end <= start || now >= end {
        return 0;
    }
    let remaining = (end - now.max(start)) as u128;
    (owner_share as u128 * remaining / (end - start) as u128) as u64
}

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
    // [SECURITY_CHECKLIST_REVIEW F-H] the platform keeps >= RENTAL_FEE_BPS.
    require!(owner_split_bps <= RENTAL_MAX_OWNER_SPLIT_BPS, AofError::InvalidAmount);
    // [SECURITY_CHECKLIST_REVIEW F-H] The NFT is escrowed for as long as the
    // listing exists: a listed tool can no longer be sold, auctioned, burned or
    // staked behind the renter's back (a rented tool in auction escrow used to
    // block the auction settlement for up to 30 days).
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.owner_token.to_account_info(),
                to: ctx.accounts.rental_vault.to_account_info(),
                authority: ctx.accounts.owner.to_account_info(),
            },
        ),
        1,
    )?;

    let l = &mut ctx.accounts.rental_listing;
    l.owner = ctx.accounts.owner.key();
    l.mint = ctx.accounts.mint.key();
    l.owner_split_bps = owner_split_bps;
    l.min_duration = min_duration;
    l.max_duration = max_duration;
    l.active = true;
    // [ФИКС] Цена аренды за час
    l.price_per_hour_lamports = price_per_hour_lamports;
    emit!(RentalListed {
        mint: l.mint,
        owner: l.owner,
        price_per_hour_lamports,
        owner_split_bps,
    });
    Ok(())
}

/// Аренда НЕ требует трансфера NFT — владение (`owner`) не меняется,
/// меняется только `operator`, которого проверяют start_mining/collect_mining/
/// repair (Solana-эквивалент "delegate authority" из TOR v4 §5.3).
///
/// [ФИКС Группы 3]: аренда теперь ПЛАТНАЯ — арендатор платит авансом за весь
/// срок, сумма делится между владельцем (owner_split_bps) и казной (остаток).
/// Раньше аренда была полностью бесплатной, owner_split_bps был мёртв.
pub fn start_handler(ctx: Context<RentalStartCtx>, duration_seconds: i64, max_total_fee: u64) -> Result<()> {
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

    // [ФИКС] Плата за аренду: аванс за весь срок, сплит владелец/казна.
    // [SECURITY_CHECKLIST_REVIEW F-H] Terms can change between listings, so the
    // renter signs a ceiling on the total fee.
    let listing = &ctx.accounts.rental_listing;
    let (owner_share, treasury_share) =
        rental_fee_split(listing.price_per_hour_lamports, duration_seconds, listing.owner_split_bps)?;
    let total_fee = owner_share.checked_add(treasury_share).ok_or(AofError::MathOverflow)?;
    require!(total_fee <= max_total_fee, AofError::PriceLimitExceeded);

    if total_fee > 0 {

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
    // [SECURITY_CHECKLIST_REVIEW F-H] Early revocation refunds the renter the
    // owner's share of the unused time (the platform share is not refunded).
    let (owner_share, _) = rental_fee_split(
        ctx.accounts.rental_listing.price_per_hour_lamports,
        ctx.accounts.rental_agreement.end - ctx.accounts.rental_agreement.start,
        ctx.accounts.rental_listing.owner_split_bps,
    )?;
    let refund = rental_refund(
        owner_share,
        ctx.accounts.rental_agreement.start,
        ctx.accounts.rental_agreement.end,
        now,
    );
    if refund > 0 {
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.owner.to_account_info(),
                    to: ctx.accounts.renter_refund.to_account_info(),
                },
            ),
            refund,
        )?;
    }
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

/// [SECURITY_CHECKLIST_REVIEW F-H] Withdraw a listing that is not rented out:
/// the escrowed NFT returns to the tool's current owner, the listing and escrow
/// rent to whoever paid it. Listings created before the escrow have an empty
/// vault; they are simply closed, which also frees the PDA for a new owner.
pub fn delist_handler(ctx: Context<RentalDelistCtx>) -> Result<()> {
    let mint_key = ctx.accounts.mint.key();
    let bump = ctx.bumps.rental_listing;
    let seeds: &[&[u8]] = &[RENTAL_LISTING_SEED, mint_key.as_ref(), &[bump]];
    if ctx.accounts.rental_vault.amount == 1 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.rental_vault.to_account_info(),
                    to: ctx.accounts.owner_token.to_account_info(),
                    authority: ctx.accounts.rental_listing.to_account_info(),
                },
                &[seeds],
            ),
            1,
        )?;
    }
    token::close_account(CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        CloseAccount {
            account: ctx.accounts.rental_vault.to_account_info(),
            destination: ctx.accounts.lister.to_account_info(),
            authority: ctx.accounts.rental_listing.to_account_info(),
        },
        &[seeds],
    ))?;
    emit!(RentalDelisted {
        mint: mint_key,
        owner: ctx.accounts.tool.owner,
    });
    Ok(())
}
