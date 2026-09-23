use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use crate::state::{LpConfig, LpPool, LpPosition};
use crate::errors::LiquidityError;
use crate::events::LpDeposited;

#[derive(Accounts)]
#[instruction(rarity: u8)]
pub struct LpDeposit<'info> {
    #[account(
        seeds = [b"lp_config"],
        bump = lp_config.bump,
        constraint = !lp_config.paused @ LiquidityError::Paused
    )]
    pub lp_config: Account<'info, LpConfig>,

    #[account(
        init_if_needed,
        payer = user,
        space = LpPool::SIZE,
        seeds = [b"lp_pool".as_ref(), &[rarity]],
        bump,
        constraint = lp_pool.rarity == 0 || lp_pool.rarity == rarity @ LiquidityError::InvalidRarity
    )]
    pub lp_pool: Account<'info, LpPool>,

    #[account(
        init_if_needed,
        payer = user,
        space = LpPosition::SIZE,
        seeds = [b"lp_position".as_ref(), user.key().as_ref(), &[rarity]],
        bump,
        constraint = lp_position.user == Pubkey::default() || lp_position.user == user.key() @ LiquidityError::Unauthorized,
        constraint = lp_position.rarity == 0 || lp_position.rarity == rarity @ LiquidityError::InvalidRarity
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
        init_if_needed,
        payer = user,
        associated_token::mint = mascot_mint,
        associated_token::authority = lp_pool
    )]
    pub pool_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<LpDeposit>, rarity: u8, amount: u64) -> Result<()> {
    require!(rarity >= 1 && rarity <= 4, LiquidityError::InvalidRarity);
    require!(amount > 0, LiquidityError::ZeroAmount);

    let pool = &ctx.accounts.lp_pool;
    let shares_minted = pool.shares_for_deposit(amount)?;
    require!(shares_minted > 0, LiquidityError::ZeroAmount);

    // Перевод маскот-токена в пул
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_mascot.to_account_info(),
                to: ctx.accounts.pool_vault.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        amount,
    )?;

    // Обновление состояния
    let pool = &mut ctx.accounts.lp_pool;
    pool.rarity = rarity;
    pool.bump = ctx.bumps.lp_pool;
    pool.total_shares = pool.total_shares.checked_add(shares_minted).ok_or(LiquidityError::MathOverflow)?;
    pool.mascot_reserve = pool.mascot_reserve.checked_add(amount).ok_or(LiquidityError::MathOverflow)?;

    let position = &mut ctx.accounts.lp_position;
    position.user = ctx.accounts.user.key();
    position.rarity = rarity;
    position.bump = ctx.bumps.lp_position;
    position.shares = position.shares.checked_add(shares_minted).ok_or(LiquidityError::MathOverflow)?;
    if position.deposited_at == 0 {
        position.deposited_at = Clock::get()?.unix_timestamp;
    }

    emit!(LpDeposited {
        user: ctx.accounts.user.key(),
        rarity,
        amount,
        shares_minted,
    });

    Ok(())
}
