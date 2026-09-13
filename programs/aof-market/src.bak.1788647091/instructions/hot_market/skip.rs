use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::{HotMarketPool, HotMarketQueue, MascotConfig};
use crate::errors::MarketError;
use crate::events::HotMarketSkip;

/// [ФИКС] Скип-фис в bps от текущей SOL-цены лота (500 = 5%).
/// Раньше скип был бесплатным и только для authority.
pub const SKIP_FEE_BPS: u64 = 500;
/// Минимальный скип-фис в lamports — защита от почти-бесплатного спама при низкой цене.
pub const MIN_SKIP_FEE_LAMPORTS: u64 = 1_000_000; // 0.001 SOL

#[derive(Accounts)]
#[instruction(rarity: u8)]
pub struct SkipLot<'info> {
    #[account(
        seeds = [b"hot_market_pool".as_ref(), &[rarity]],
        bump = pool.bump,
        constraint = !pool.paused @ MarketError::Paused
    )]
    pub pool: Account<'info, HotMarketPool>,

    #[account(
        mut,
        seeds = [b"hot_market_queue".as_ref(), &[rarity]],
        bump = queue.bump
    )]
    pub queue: Account<'info, HotMarketQueue>,

    #[account(
        seeds = [b"mascot_config"],
        bump = mascot_config.bump
    )]
    pub mascot_config: Account<'info, MascotConfig>,

    #[account(mut)]
    pub player: Signer<'info>,

    /// CHECK: SOL-казна, получает скип-фис; адрес фиксируется конфигом
    #[account(mut, address = mascot_config.treasury_sol @ MarketError::Unauthorized)]
    pub treasury_sol: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<SkipLot>, rarity: u8) -> Result<()> {
    let queue = &ctx.accounts.queue;
    // Скипать можно только если в очереди есть хотя бы 2 лота (должен остаться следующий)
    require!(queue.len > 1, MarketError::QueueEmpty);

    // [ФИКС] Реролл теперь доступен любому игроку, но платный:
    // фис = процент от текущей SOL-цены лота (не ниже минимума).
    // Это закрывает вектор бесплатного перебора лотов.
    let now = Clock::get()?.unix_timestamp;
    let current_price_sol = ctx.accounts.pool.price_sol(now);
    let mut skip_fee = current_price_sol.saturating_mul(SKIP_FEE_BPS) / 10_000;
    if skip_fee < MIN_SKIP_FEE_LAMPORTS {
        skip_fee = MIN_SKIP_FEE_LAMPORTS;
    }

    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.player.to_account_info(),
                to: ctx.accounts.treasury_sol.to_account_info(),
            },
        ),
        skip_fee,
    )?;

    let queue = &mut ctx.accounts.queue;
    let skipped = queue.first().ok_or(MarketError::QueueEmpty)?;
    queue.advance();
    let new_first = queue.first().ok_or(MarketError::QueueEmpty)?;

    emit!(HotMarketSkip {
        rarity,
        skipped_tool: skipped,
        new_tool: new_first,
    });

    Ok(())
}
