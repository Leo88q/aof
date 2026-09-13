use anchor_lang::prelude::*;
use crate::state::{HotMarketPool, HotMarketQueue, MascotConfig, PoolParams};
use crate::errors::MarketError;
use crate::events::PoolInitialized;

#[derive(Accounts)]
#[instruction(rarity: u8)]
pub struct InitPool<'info> {
    #[account(
        init,
        payer = authority,
        space = HotMarketPool::SIZE,
        seeds = [b"hot_market_pool".as_ref(), &[rarity]],
        bump
    )]
    pub pool: Account<'info, HotMarketPool>,

    #[account(
        init,
        payer = authority,
        space = HotMarketQueue::SIZE,
        seeds = [b"hot_market_queue".as_ref(), &[rarity]],
        bump
    )]
    pub queue: Account<'info, HotMarketQueue>,

    #[account(
        seeds = [b"mascot_config"],
        bump = mascot_config.bump
    )]
    pub mascot_config: Account<'info, MascotConfig>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitPool>, rarity: u8, params: PoolParams) -> Result<()> {
    require!(rarity >= 1 && rarity <= 4, MarketError::InvalidRarity);
    require!(params.fee_bps <= 1000, MarketError::FeeTooHigh);

    let pool = &mut ctx.accounts.pool;
    pool.rarity = rarity;
    pool.bump = ctx.bumps.pool;
    pool.authority = ctx.accounts.authority.key();
    pool.base_price_mascot = params.base_price_mascot;
    pool.base_price_sol_lamports = params.base_price_sol_lamports;
    pool.growth_per_purchase_bps = params.growth_per_purchase_bps;
    pool.decay_per_hour_bps = params.decay_per_hour_bps;
    pool.target_sales_per_hour = params.target_sales_per_hour;
    pool.current_price_mascot = params.base_price_mascot;
    pool.current_price_sol_lamports = params.base_price_sol_lamports;
    let now = Clock::get()?.unix_timestamp;
    pool.last_trade_ts = now;
    pool.sold_count = 0;
    pool.purchases_in_window = 0;
    pool.start_ts = now;
    pool.hot_window_end_ts = 0;
    pool.hot_multiplier_bps = 0;
    pool.fee_bps = params.fee_bps;
    pool.paused = false;

    let queue = &mut ctx.accounts.queue;
    queue.rarity = rarity;
    queue.bump = ctx.bumps.queue;
    queue.head = 0;
    queue.len = 0;
    queue.items = Vec::new();

    emit!(PoolInitialized {
        rarity,
        base_price_mascot: params.base_price_mascot,
        base_price_sol_lamports: params.base_price_sol_lamports,
    });

    Ok(())
}
