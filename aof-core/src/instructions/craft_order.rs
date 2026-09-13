use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, Transfer};
use crate::constants::*;
use crate::{CraftOrderCreateCtx, CraftOrderFulfillCtx, CraftOrderCancelCtx};
use crate::errors::*;
use crate::events::*;

pub fn create_handler(
    ctx: Context<CraftOrderCreateCtx>,
    wood_needed: u64,
    stone_needed: u64,
    premium_lamports: u64,
) -> Result<()> {
    require!(premium_lamports > 0, AofError::ZeroAmount);
    anchor_lang::system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.creator.to_account_info(),
                to: ctx.accounts.craft_order.to_account_info(),
            },
        ),
        premium_lamports,
    )?;
    let o = &mut ctx.accounts.craft_order;
    o.creator = ctx.accounts.creator.key();
    o.wood_needed = wood_needed;
    o.stone_needed = stone_needed;
    o.premium_lamports = premium_lamports;
    o.active = true;
    Ok(())
}

/// Атомарный обмен: fulfiller присылает ровно нужные wood/stone создателю
/// заказа, получает премию (минус 2% комиссия) из эскроу.
pub fn fulfill_handler(ctx: Context<CraftOrderFulfillCtx>) -> Result<()> {
    require!(ctx.accounts.craft_order.active, AofError::NotActive);

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.fulfiller_wood.to_account_info(),
                to: ctx.accounts.creator_wood.to_account_info(),
                authority: ctx.accounts.fulfiller.to_account_info(),
            },
        ),
        ctx.accounts.craft_order.wood_needed,
    )?;
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.fulfiller_stone.to_account_info(),
                to: ctx.accounts.creator_stone.to_account_info(),
                authority: ctx.accounts.fulfiller.to_account_info(),
            },
        ),
        ctx.accounts.craft_order.stone_needed,
    )?;

    let premium = ctx.accounts.craft_order.premium_lamports;
    let fee = premium.checked_mul(CRAFT_ORDER_FEE_BPS as u64).ok_or(AofError::MathOverflow)? / 10_000;
    let fulfiller_cut = premium.checked_sub(fee).ok_or(AofError::MathOverflow)?;

    **ctx.accounts.craft_order.to_account_info().try_borrow_mut_lamports()? -= premium;
    **ctx.accounts.fulfiller.try_borrow_mut_lamports()? += fulfiller_cut;
    **ctx.accounts.treasury.try_borrow_mut_lamports()? += fee;

    ctx.accounts.craft_order.active = false;

    emit!(CraftOrderFulfilled {
        creator: ctx.accounts.craft_order.creator,
        fulfiller: ctx.accounts.fulfiller.key(),
        premium_lamports: premium,
    });
    Ok(())
}

pub fn cancel_handler(ctx: Context<CraftOrderCancelCtx>) -> Result<()> {
    require!(ctx.accounts.craft_order.active, AofError::NotActive);
    let amount = ctx.accounts.craft_order.premium_lamports;
    **ctx.accounts.craft_order.to_account_info().try_borrow_mut_lamports()? -= amount;
    **ctx.accounts.creator.try_borrow_mut_lamports()? += amount;
    ctx.accounts.craft_order.active = false;
    Ok(())
}
