use anchor_lang::prelude::*;
use crate::constants::*;
use crate::{OfferCreateCtx, OfferAcceptCtx, OfferCancelCtx};
use crate::errors::*;
use crate::events::*;
use anchor_spl::token::{self, Token, Transfer};

pub fn create_handler(ctx: Context<OfferCreateCtx>, price_lamports: u64) -> Result<()> {
    require!(price_lamports > 0, AofError::ZeroAmount);
    anchor_lang::system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.buyer.to_account_info(),
                to: ctx.accounts.offer.to_account_info(),
            },
        ),
        price_lamports,
    )?;
    let o = &mut ctx.accounts.offer;
    o.buyer = ctx.accounts.buyer.key();
    o.mint = ctx.accounts.mint.key();
    o.price_lamports = price_lamports;
    o.active = true;
    emit!(OfferCreated {
        buyer: ctx.accounts.buyer.key(),
        mint: ctx.accounts.mint.key(),
        price_lamports,
    });
    Ok(())
}

/// Продавец (текущий owner NFT) принимает оффер в любой момент — NFT НЕ
/// эскроится заранее (в отличие от листинга/аукциона), стандартный
/// "offer"-паттерн: свобода владельца передумать, продать иначе, и т.д.
pub fn accept_handler(ctx: Context<OfferAcceptCtx>) -> Result<()> {
    require!(ctx.accounts.offer.active, AofError::NotActive);
    let price = ctx.accounts.offer.price_lamports;
    let fee = price.checked_mul(OFFER_FEE_BPS as u64).ok_or(AofError::MathOverflow)? / 10_000;
    let seller_cut = price.checked_sub(fee).ok_or(AofError::MathOverflow)?;

    **ctx.accounts.offer.to_account_info().try_borrow_mut_lamports()? -= price;
    **ctx.accounts.seller.try_borrow_mut_lamports()? += seller_cut;
    **ctx.accounts.treasury.try_borrow_mut_lamports()? += fee;

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.seller_token.to_account_info(),
                to: ctx.accounts.buyer_token.to_account_info(),
                authority: ctx.accounts.seller.to_account_info(),
            },
        ),
        1,
    )?;

    ctx.accounts.tool.owner = ctx.accounts.offer.buyer;
    ctx.accounts.tool.operator = ctx.accounts.offer.buyer;
    ctx.accounts.offer.active = false;

    emit!(OfferAccepted {
        buyer: ctx.accounts.offer.buyer,
        seller: ctx.accounts.seller.key(),
        mint: ctx.accounts.mint.key(),
        price_lamports: price,
    });
    Ok(())
}

pub fn cancel_handler(ctx: Context<OfferCancelCtx>) -> Result<()> {
    require!(ctx.accounts.offer.active, AofError::NotActive);
    let amount = ctx.accounts.offer.price_lamports;
    **ctx.accounts.offer.to_account_info().try_borrow_mut_lamports()? -= amount;
    **ctx.accounts.buyer.try_borrow_mut_lamports()? += amount;
    ctx.accounts.offer.active = false;
    Ok(())
}
