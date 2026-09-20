use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{self, Token, Transfer};
use crate::constants::*;
use crate::{MarketplaceList, MarketplaceBuy, MarketplaceCancel};
use crate::errors::*;
use crate::events::*;

pub fn list_handler(ctx: Context<MarketplaceList>, price_lamports: u64) -> Result<()> {
    require!(price_lamports > 0, AofError::ZeroAmount);
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.seller_token.to_account_info(),
                to: ctx.accounts.listing_vault.to_account_info(),
                authority: ctx.accounts.seller.to_account_info(),
            },
        ),
        1,
    )?;
    let l = &mut ctx.accounts.listing;
    l.seller = ctx.accounts.seller.key();
    l.mint = ctx.accounts.mint.key();
    l.price_lamports = price_lamports;
    l.active = true;
    emit!(ListingCreated {
        seller: ctx.accounts.seller.key(),
        mint: ctx.accounts.mint.key(),
        price_lamports,
    });
    Ok(())
}

pub fn buy_handler(ctx: Context<MarketplaceBuy>, max_price_lamports: u64, expires_at: i64) -> Result<()> {
    validate_purchase_bounds(ctx.accounts.listing.price_lamports, max_price_lamports,
        expires_at, Clock::get()?.unix_timestamp)?;
    require!(ctx.accounts.listing.active, AofError::NotActive);
    let price = ctx.accounts.listing.price_lamports;
    let fee = price.checked_mul(MARKETPLACE_FEE_BPS as u64).ok_or(AofError::MathOverflow)? / 10_000;
    let seller_cut = price.checked_sub(fee).ok_or(AofError::MathOverflow)?;

    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.buyer.to_account_info(),
                to: ctx.accounts.seller.to_account_info(),
            },
        ),
        seller_cut,
    )?;
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.buyer.to_account_info(),
                to: ctx.accounts.treasury.to_account_info(),
            },
        ),
        fee,
    )?;

    let listing_bump = ctx.bumps.listing;
    let mint_key = ctx.accounts.mint.key();
    let seeds: &[&[u8]] = &[LISTING_SEED, mint_key.as_ref(), &[listing_bump]];
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.listing_vault.to_account_info(),
                to: ctx.accounts.buyer_token.to_account_info(),
                authority: ctx.accounts.listing.to_account_info(),
            },
            &[seeds],
        ),
        1,
    )?;

    ctx.accounts.listing.active = false;
    ctx.accounts.tool.owner = ctx.accounts.buyer.key();
    ctx.accounts.tool.operator = ctx.accounts.buyer.key();

    emit!(ListingSold {
        seller: ctx.accounts.listing.seller,
        buyer: ctx.accounts.buyer.key(),
        mint: ctx.accounts.mint.key(),
        price_lamports: price,
    });
    Ok(())
}

pub fn cancel_handler(ctx: Context<MarketplaceCancel>) -> Result<()> {
    require!(ctx.accounts.listing.active, AofError::NotActive);
    let listing_bump = ctx.bumps.listing;
    let mint_key = ctx.accounts.mint.key();
    let seeds: &[&[u8]] = &[LISTING_SEED, mint_key.as_ref(), &[listing_bump]];
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.listing_vault.to_account_info(),
                to: ctx.accounts.seller_token.to_account_info(),
                authority: ctx.accounts.listing.to_account_info(),
            },
            &[seeds],
        ),
        1,
    )?;
    ctx.accounts.listing.active = false;
    Ok(())
}

/// Signed maximum price and deadline are checked BEFORE any CPI or mutation.
fn validate_purchase_bounds(price: u64, maximum: u64, deadline: i64, now: i64) -> Result<()> {
    require!(maximum > 0 && price <= maximum, AofError::PriceLimitExceeded);
    require!(deadline > now && deadline.saturating_sub(now) <= 300, AofError::QuoteExpired);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn purchase_bounds() {
        assert!(validate_purchase_bounds(100, 100, 200, 100).is_ok());
        assert!(validate_purchase_bounds(99, 100, 200, 100).is_ok());
        assert!(validate_purchase_bounds(101, 100, 200, 100).is_err());
        assert!(validate_purchase_bounds(100, 100, 100, 100).is_err());
        assert!(validate_purchase_bounds(100, 100, 401, 100).is_err());
        assert!(validate_purchase_bounds(0, 0, 200, 100).is_err());
    }
}
