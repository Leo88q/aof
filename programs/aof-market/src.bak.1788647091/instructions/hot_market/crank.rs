use anchor_lang::prelude::*;
use crate::state::HotMarketPool;
use crate::events::PriceCranked;

#[derive(Accounts)]
#[instruction(rarity: u8)]
pub struct HotMarketCrank<'info> {
    #[account(
        mut,
        seeds = [b"hot_market_pool".as_ref(), &[rarity]],
        bump = pool.bump
    )]
    pub pool: Account<'info, HotMarketPool>,

    #[account(mut)]
    pub caller: Signer<'info>,
}

pub fn handler(ctx: Context<HotMarketCrank>, rarity: u8) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let pool = &mut ctx.accounts.pool;

    let old_mascot = pool.current_price_mascot;
    let old_sol = pool.current_price_sol_lamports;

    pool.current_price_mascot = pool.price_mascot(now);
    pool.current_price_sol_lamports = pool.price_sol(now);

    if now - pool.last_trade_ts > 3600 {
        pool.purchases_in_window = 0;
    }

    emit!(PriceCranked {
        rarity,
        old_price_mascot: old_mascot,
        new_price_mascot: pool.current_price_mascot,
        old_price_sol: old_sol,
        new_price_sol: pool.current_price_sol_lamports,
    });

    Ok(())
}
