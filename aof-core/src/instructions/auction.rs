use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{self, Token, Transfer, CloseAccount};
use crate::constants::*;
use crate::{AuctionCreateCtx, AuctionBidCtx, AuctionSettleCtx};
use crate::errors::*;
use crate::events::*;

pub fn create_handler(ctx: Context<AuctionCreateCtx>, min_bid: u64, duration_seconds: i64) -> Result<()> {
    require!(min_bid > 0, AofError::ZeroAmount);
    require!(duration_seconds > 0, AofError::InvalidRentalDuration);
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.seller_token.to_account_info(),
                to: ctx.accounts.auction_vault.to_account_info(),
                authority: ctx.accounts.seller.to_account_info(),
            },
        ),
        1,
    )?;
    let now = Clock::get()?.unix_timestamp;
    let a = &mut ctx.accounts.auction;
    a.seller = ctx.accounts.seller.key();
    a.mint = ctx.accounts.mint.key();
    a.min_bid = min_bid;
    a.current_bid = 0;
    // Keep a valid account key for the first bid. AuctionBidCtx always
    // validates previous_bidder against current_bidder, even when there is
    // no previous bid to refund.
    a.current_bidder = ctx.accounts.seller.key();
    a.end_time = now.checked_add(duration_seconds).ok_or(AofError::MathOverflow)?;
    a.active = true;
    emit!(AuctionCreated {
        seller: ctx.accounts.seller.key(),
        mint: ctx.accounts.mint.key(),
        min_bid,
        end_time: a.end_time,
    });
    Ok(())
}

pub fn bid_handler(ctx: Context<AuctionBidCtx>, amount: u64) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    require!(ctx.accounts.auction.active, AofError::NotActive);
    require!(now < ctx.accounts.auction.end_time, AofError::AuctionEnded);
    let min_required = if ctx.accounts.auction.current_bid > 0 {
        ctx.accounts.auction.current_bid
    } else {
        ctx.accounts.auction.min_bid.saturating_sub(1)
    };
    require!(amount > min_required, AofError::BidTooLow);

    // эскроу новой ставки в auction PDA
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.bidder.to_account_info(),
                to: ctx.accounts.auction.to_account_info(),
            },
        ),
        amount,
    )?;

    // возврат предыдущему ставившему, если был
    if ctx.accounts.auction.current_bid > 0 {
        **ctx.accounts.auction.to_account_info().try_borrow_mut_lamports()? -=
            ctx.accounts.auction.current_bid;
        **ctx.accounts.previous_bidder.try_borrow_mut_lamports()? += ctx.accounts.auction.current_bid;
    }

    let a = &mut ctx.accounts.auction;
    a.current_bid = amount;
    a.current_bidder = ctx.accounts.bidder.key();
    // anti-snipe: ставка в последние 5 минут продлевает аукцион на 5 минут
    if a.end_time - now < AUCTION_ANTI_SNIPE_WINDOW_SECONDS {
        a.end_time = now
            .checked_add(AUCTION_ANTI_SNIPE_EXTENSION_SECONDS)
            .ok_or(AofError::MathOverflow)?;
    }

    emit!(AuctionBid {
        mint: a.mint,
        bidder: ctx.accounts.bidder.key(),
        amount,
    });
    Ok(())
}

pub fn settle_handler(ctx: Context<AuctionSettleCtx>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    require!(ctx.accounts.auction.active, AofError::NotActive);
    require!(now >= ctx.accounts.auction.end_time, AofError::AuctionNotEnded);

    let amount = ctx.accounts.auction.current_bid;
    if amount > 0 {
        let fee = amount.checked_mul(AUCTION_FEE_BPS as u64).ok_or(AofError::MathOverflow)? / 10_000;
        let seller_cut = amount.checked_sub(fee).ok_or(AofError::MathOverflow)?;

        **ctx.accounts.auction.to_account_info().try_borrow_mut_lamports()? -= amount;
        **ctx.accounts.seller.try_borrow_mut_lamports()? += seller_cut;
        **ctx.accounts.treasury.try_borrow_mut_lamports()? += fee;

        let bump = ctx.bumps.auction;
        let mint_key = ctx.accounts.mint.key();
        let seeds: &[&[u8]] = &[AUCTION_SEED, mint_key.as_ref(), &[bump]];
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.auction_vault.to_account_info(),
                    to: ctx.accounts.winner_token.to_account_info(),
                    authority: ctx.accounts.auction.to_account_info(),
                },
                &[seeds],
            ),
            1,
        )?;
        ctx.accounts.tool.owner = ctx.accounts.auction.current_bidder;
        ctx.accounts.tool.operator = ctx.accounts.auction.current_bidder;

        emit!(AuctionSettled {
            mint: ctx.accounts.mint.key(),
            winner: ctx.accounts.auction.current_bidder,
            amount,
        });
    } else {
        // никто не ставил — вернуть NFT продавцу
        let bump = ctx.bumps.auction;
        let mint_key = ctx.accounts.mint.key();
        let seeds: &[&[u8]] = &[AUCTION_SEED, mint_key.as_ref(), &[bump]];
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.auction_vault.to_account_info(),
                    to: ctx.accounts.winner_token.to_account_info(), // == seller_token when no bids
                    authority: ctx.accounts.auction.to_account_info(),
                },
                &[seeds],
            ),
            1,
        )?;
    }

    // [AUDIT F-24] Recover the escrow ATA rent; the auction PDA itself is
    // closed by the `close = seller` constraint on the Accounts struct.
    let bump = ctx.bumps.auction;
    let mint_key = ctx.accounts.mint.key();
    let seeds: &[&[u8]] = &[AUCTION_SEED, mint_key.as_ref(), &[bump]];
    token::close_account(CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        token::CloseAccount {
            account: ctx.accounts.auction_vault.to_account_info(),
            destination: ctx.accounts.seller.to_account_info(),
            authority: ctx.accounts.auction.to_account_info(),
        },
        &[seeds],
    ))?;

    ctx.accounts.auction.active = false;
    Ok(())
}
