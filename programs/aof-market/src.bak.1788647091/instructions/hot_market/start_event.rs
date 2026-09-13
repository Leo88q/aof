use anchor_lang::prelude::*;
use crate::state::HotMarketPool;
use crate::errors::MarketError;
use crate::events::HotWindowStarted;

#[derive(Accounts)]
#[instruction(rarity: u8)]
pub struct StartEvent<'info> {
    #[account(
        mut,
        seeds = [b"hot_market_pool".as_ref(), &[rarity]],
        bump = pool.bump
    )]
    pub pool: Account<'info, HotMarketPool>,

    pub authority: Signer<'info>,
}

pub fn handler(
    ctx: Context<StartEvent>,
    rarity: u8,
    duration_seconds: i64,
    multiplier_bps: u16,
) -> Result<()> {
    require!(
        ctx.accounts.authority.key() == ctx.accounts.pool.authority,
        MarketError::Unauthorized
    );
    require!(
        duration_seconds > 0 && duration_seconds <= 7 * 24 * 3600,
        MarketError::MathOverflow
    );

    let now = Clock::get()?.unix_timestamp;
    let pool = &mut ctx.accounts.pool;
    pool.hot_window_end_ts = now + duration_seconds;
    pool.hot_multiplier_bps = multiplier_bps;

    emit!(HotWindowStarted {
        rarity,
        end_ts: pool.hot_window_end_ts,
        multiplier_bps,
    });

    Ok(())
}
