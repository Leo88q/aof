use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use crate::state::{LpConfig, LpPool, LpPosition};
use crate::errors::LiquidityError;
use crate::events::LpWithdrawn;

#[derive(Accounts)]
#[instruction(rarity: u8)]
pub struct LpWithdraw<'info> {
    #[account(
        seeds = [b"lp_config"],
        bump = lp_config.bump,
        constraint = !lp_config.paused @ LiquidityError::Paused
    )]
    pub lp_config: Account<'info, LpConfig>,

    #[account(
        mut,
        seeds = [b"lp_pool".as_ref(), &[rarity]],
        bump = lp_pool.bump
    )]
    pub lp_pool: Account<'info, LpPool>,

    #[account(
        mut,
        seeds = [b"lp_position".as_ref(), user.key().as_ref(), &[rarity]],
        bump = lp_position.bump,
        constraint = lp_position.user == user.key() @ LiquidityError::Unauthorized
    )]
    pub lp_position: Account<'info, LpPosition>,

    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        address = lp_config.mascot_mint @ LiquidityError::Unauthorized
    )]
    pub mascot_mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mascot_mint,
        associated_token::authority = user
    )]
    pub user_mascot: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mascot_mint,
        associated_token::authority = lp_pool
    )]
    pub pool_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<LpWithdraw>, rarity: u8, shares: u64) -> Result<()> {
    let position = &ctx.accounts.lp_position;
    require!(shares > 0, LiquidityError::ZeroAmount);
    require!(position.shares >= shares, LiquidityError::NotEnoughShares);

    let pool = &ctx.accounts.lp_pool;
    let price = pool.share_price();
    let amount_principal = shares * price;

    // Доля комиссий пропорционально долям
    let fees_share = if pool.total_shares > 0 {
        pool.accumulated_fees * shares / pool.total_shares
    } else {
        0
    };

    let total_out = amount_principal + fees_share;

    // Перевод из пула пользователю (подпись пула через PDA)
    let pool_seeds = &[
        b"lp_pool".as_ref(),
        &[rarity],
        &[ctx.accounts.lp_pool.bump],
    ];
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.pool_vault.to_account_info(),
                to: ctx.accounts.user_mascot.to_account_info(),
                authority: ctx.accounts.lp_pool.to_account_info(),
            },
            &[pool_seeds],
        ),
        total_out,
    )?;

    // Обновление состояния
    let pool = &mut ctx.accounts.lp_pool;
    pool.total_shares = pool.total_shares.saturating_sub(shares);
    pool.mascot_reserve = pool.mascot_reserve.saturating_sub(amount_principal);
    pool.accumulated_fees = pool.accumulated_fees.saturating_sub(fees_share);

    let position = &mut ctx.accounts.lp_position;
    position.shares = position.shares.saturating_sub(shares);

    emit!(LpWithdrawn {
        user: ctx.accounts.user.key(),
        rarity,
        shares_burned: shares,
        amount_received: amount_principal,
        fees_received: fees_share,
    });

    Ok(())
}
