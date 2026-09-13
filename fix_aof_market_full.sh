#!/bin/bash
set -e

MARKET="/Users/zlata/Desktop/aof_gui/programs/aof-market"
TS=$(date +%s)

echo "🔧 Полная замена aof-market на версию из расширения"
echo "===================================================="

# ---------- БЭКАП ----------
echo "📦 Бэкап старого src/"
cp -r "$MARKET/src" "$MARKET/src.bak.$TS"
echo "✅ Бэкап: $MARKET/src.bak.$TS"

# ---------- УДАЛЯЕМ СТАРУЮ СТРУКТУРУ ----------
echo ""
echo "🗑️  Удаляем старую структуру (instructions/, config/, session/, trust/)"
rm -rf "$MARKET/src/instructions"
rm -rf "$MARKET/src/config"
rm -rf "$MARKET/src/session"
rm -rf "$MARKET/src/trust"
echo "✅ Удалено"

# ============================================================
# src/errors.rs
# ============================================================
cat > "$MARKET/src/errors.rs" << 'RUST_EOF'
use anchor_lang::prelude::*;

#[error_code]
pub enum MarketError {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Program or pool is paused")]
    Paused,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Slippage: price moved past max_price/min_price")]
    SlippageExceeded,
    #[msg("Hot window duration out of range")]
    InvalidWindowDuration,
    #[msg("Order is not active")]
    OrderNotActive,
    #[msg("Insufficient reserve in pool")]
    InsufficientReserve,
}
RUST_EOF

# ============================================================
# src/state.rs
# ============================================================
cat > "$MARKET/src/state.rs" << 'RUST_EOF'
use anchor_lang::prelude::*;

pub const CONFIG_SEED: &[u8] = b"market_config";
pub const POOL_SEED: &[u8] = b"hot_pool";
pub const LIMIT_ORDER_SEED: &[u8] = b"hot_limit_order";
pub const CONFIG_SPACE: usize = 8 + 32 + 32 + 32 + 32 + 2 + 1 + 1;
pub const POOL_SPACE: usize = 8 + 1 + 8 + 8 + 8 + 2 + 2 + 8 + 8 + 8 + 8 + 8 + 2 + 2 + 1 + 1;
pub const LIMIT_ORDER_SPACE: usize = 8 + 32 + 1 + 1 + 1 + 8 + 8 + 1;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum Currency {
    Core,
    Gem,
}

#[account]
#[derive(InitSpace)]
pub struct MarketConfig {
    pub authority: Pubkey,
    pub treasury: Pubkey,
    pub core_mint: Pubkey,
    pub gem_mint: Pubkey,
    pub fee_bps: u16,
    pub paused: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct HotMarketPool {
    pub rarity: u8,
    pub target_price_core: u64,
    pub target_price_gem: u64,
    pub target_rate_per_hour: u64,
    pub decay_bps_per_hour: u16,
    pub growth_bps_per_sale: u16,
    pub sold_since_start: u64,
    pub purchases_in_window: u64,
    pub start_ts: i64,
    pub last_trade_ts: i64,
    pub hot_window_end_ts: i64,
    pub hot_multiplier_bps: u16,
    pub fee_bps: u16,
    pub paused: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct HotLimitOrder {
    pub maker: Pubkey,
    pub rarity: u8,
    pub currency: Currency,
    pub is_buy: bool,
    pub limit_price: u64,
    pub amount_escrowed: u64,
    pub active: bool,
}
RUST_EOF

# ============================================================
# src/events.rs
# ============================================================
cat > "$MARKET/src/events.rs" << 'RUST_EOF'
use anchor_lang::prelude::*;
use crate::state::Currency;

#[event]
pub struct HotMarketBought {
    pub buyer: Pubkey,
    pub rarity: u8,
    pub currency: Currency,
    pub price: u64,
    pub sold_since_start: u64,
}

#[event]
pub struct HotMarketSold {
    pub seller: Pubkey,
    pub rarity: u8,
    pub currency: Currency,
    pub price: u64,
}

#[event]
pub struct HotMarketEventStarted {
    pub rarity: u8,
    pub end_ts: i64,
    pub multiplier_bps: u16,
}

#[event]
pub struct HotMarketCranked {
    pub rarity: u8,
    pub new_price_core: u64,
    pub new_price_gem: u64,
}

#[event]
pub struct HotMarketSkipped {
    pub user: Pubkey,
    pub rarity: u8,
}

#[event]
pub struct LimitOrderPlaced {
    pub maker: Pubkey,
    pub rarity: u8,
    pub is_buy: bool,
    pub limit_price: u64,
}

#[event]
pub struct LimitOrderMatched {
    pub maker: Pubkey,
    pub rarity: u8,
    pub price: u64,
}
RUST_EOF

# ============================================================
# src/pricing.rs  (VRGDA-аппроксимация)
# ============================================================
cat > "$MARKET/src/pricing.rs" << 'RUST_EOF'
use anchor_lang::prelude::*;
use crate::errors::MarketError;

pub const MAX_GROWTH_ITER: u64 = 200;
pub const MAX_DECAY_HOURS: u64 = 72;
pub const PRICE_CAP_MULT: u128 = 100;

pub fn apply_growth(base: u64, growth_bps: u16, purchases_in_window: u64) -> Result<u64> {
    let mut price: u128 = base as u128;
    let factor = 10_000u128
        .checked_add(growth_bps as u128)
        .ok_or(MarketError::MathOverflow)?;
    let iters = purchases_in_window.min(MAX_GROWTH_ITER);
    let cap = (base as u128)
        .checked_mul(PRICE_CAP_MULT)
        .ok_or(MarketError::MathOverflow)?;
    for _ in 0..iters {
        price = price
            .checked_mul(factor)
            .ok_or(MarketError::MathOverflow)?
            / 10_000;
        if price >= cap {
            price = cap;
            break;
        }
    }
    Ok(price as u64)
}

pub fn apply_decay(current: u64, base: u64, decay_bps_per_hour: u16, hours_idle: i64) -> Result<u64> {
    if hours_idle <= 0 {
        return Ok(current);
    }
    let mut price: u128 = current as u128;
    let factor = 10_000u128.saturating_sub(decay_bps_per_hour as u128).max(1);
    let iters = (hours_idle as u64).min(MAX_DECAY_HOURS);
    for _ in 0..iters {
        price = price
            .checked_mul(factor)
            .ok_or(MarketError::MathOverflow)?
            / 10_000;
        if price <= base as u128 {
            return Ok(base);
        }
    }
    Ok(price.max(1) as u64)
}

pub fn current_price(
    base: u64,
    growth_bps: u16,
    decay_bps_per_hour: u16,
    purchases_in_window: u64,
    last_trade_ts: i64,
    now: i64,
) -> Result<u64> {
    let grown = apply_growth(base, growth_bps, purchases_in_window)?;
    let hours_idle = (now - last_trade_ts) / 3600;
    apply_decay(grown, base, decay_bps_per_hour, hours_idle)
}

pub fn apply_hot_multiplier(price: u64, hot_multiplier_bps: u16, is_hot: bool) -> Result<u64> {
    if !is_hot || hot_multiplier_bps == 0 {
        return Ok(price);
    }
    let v = (price as u128)
        .checked_mul(hot_multiplier_bps as u128)
        .ok_or(MarketError::MathOverflow)?
        .checked_div(10_000)
        .ok_or(MarketError::MathOverflow)?;
    Ok(v as u64)
}
RUST_EOF

# ============================================================
# src/lib.rs  (все инструкции в одном файле)
# ============================================================
cat > "$MARKET/src/lib.rs" << 'RUST_EOF'
use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{self, Token, TokenAccount, Mint, Transfer};

pub mod state;
pub mod errors;
pub mod events;
pub mod pricing;

pub use state::*;
pub use errors::*;
pub use events::*;

declare_id!("MktAoF1111111111111111111111111111111111");

#[derive(Accounts)]
pub struct InitConfig<'info> {
    #[account(init, payer = authority, space = CONFIG_SPACE, seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, MarketConfig>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub core_mint: Account<'info, Mint>,
    pub gem_mint: Account<'info, Mint>,
    /// CHECK: казна
    pub treasury: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetFees<'info> {
    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump, has_one = authority @ MarketError::Unauthorized)]
    pub config: Account<'info, MarketConfig>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct SetPaused<'info> {
    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump, has_one = authority @ MarketError::Unauthorized)]
    pub config: Account<'info, MarketConfig>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(rarity: u8)]
pub struct InitPool<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = authority @ MarketError::Unauthorized)]
    pub config: Account<'info, MarketConfig>,
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(init, payer = authority, space = POOL_SPACE, seeds = [POOL_SEED, &[rarity]], bump)]
    pub pool: Account<'info, HotMarketPool>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(rarity: u8, currency: Currency, max_price: u64)]
pub struct HotMarketBuy<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, constraint = !config.paused @ MarketError::Paused)]
    pub config: Account<'info, MarketConfig>,
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(mut, seeds = [POOL_SEED, &[rarity]], bump = pool.bump, constraint = !pool.paused @ MarketError::Paused)]
    pub pool: Account<'info, HotMarketPool>,
    /// CHECK: казна
    #[account(mut, address = config.treasury)]
    pub treasury: UncheckedAccount<'info>,
    #[account(mut)]
    pub currency_mint: Account<'info, Mint>,
    #[account(mut, constraint = buyer_currency.mint == currency_mint.key(), constraint = buyer_currency.owner == buyer.key())]
    pub buyer_currency: Account<'info, TokenAccount>,
    #[account(mut, constraint = treasury_currency.mint == currency_mint.key())]
    pub treasury_currency: Account<'info, TokenAccount>,
    /// CHECK: новый mint инструмента, создаётся клиентом заранее
    pub new_tool_mint: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(rarity: u8)]
pub struct HotMarketSell<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, constraint = !config.paused @ MarketError::Paused)]
    pub config: Account<'info, MarketConfig>,
    #[account(mut)]
    pub seller: Signer<'info>,
    #[account(mut, seeds = [POOL_SEED, &[rarity]], bump = pool.bump, constraint = !pool.paused @ MarketError::Paused)]
    pub pool: Account<'info, HotMarketPool>,
    #[account(mut)]
    pub currency_mint: Account<'info, Mint>,
    #[account(mut, constraint = seller_currency.mint == currency_mint.key(), constraint = seller_currency.owner == seller.key())]
    pub seller_currency: Account<'info, TokenAccount>,
    #[account(mut, constraint = pool_currency.mint == currency_mint.key())]
    pub pool_currency: Account<'info, TokenAccount>,
    /// CHECK: инструмент, который продаётся в очередь
    pub sold_tool_mint: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(rarity: u8)]
pub struct StartEvent<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = authority @ MarketError::Unauthorized)]
    pub config: Account<'info, MarketConfig>,
    pub authority: Signer<'info>,
    #[account(mut, seeds = [POOL_SEED, &[rarity]], bump = pool.bump)]
    pub pool: Account<'info, HotMarketPool>,
}

#[derive(Accounts)]
#[instruction(rarity: u8)]
pub struct Crank<'info> {
    #[account(mut, seeds = [POOL_SEED, &[rarity]], bump = pool.bump)]
    pub pool: Account<'info, HotMarketPool>,
}

#[derive(Accounts)]
#[instruction(rarity: u8)]
pub struct Skip<'info> {
    pub user: Signer<'info>,
    #[account(seeds = [POOL_SEED, &[rarity]], bump = pool.bump)]
    pub pool: Account<'info, HotMarketPool>,
}

#[derive(Accounts)]
#[instruction(rarity: u8, currency: Currency, is_buy: bool, limit_price: u64, amount: u64)]
pub struct PlaceLimitOrder<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, constraint = !config.paused @ MarketError::Paused)]
    pub config: Account<'info, MarketConfig>,
    #[account(mut)]
    pub maker: Signer<'info>,
    #[account(init, payer = maker, space = LIMIT_ORDER_SPACE, seeds = [LIMIT_ORDER_SEED, maker.key().as_ref(), &[rarity]], bump)]
    pub order: Account<'info, HotLimitOrder>,
    #[account(mut)]
    pub currency_mint: Account<'info, Mint>,
    #[account(mut, constraint = maker_currency.mint == currency_mint.key(), constraint = maker_currency.owner == maker.key())]
    pub maker_currency: Account<'info, TokenAccount>,
    #[account(mut, constraint = order_vault.owner == order.key(), constraint = order_vault.mint == currency_mint.key())]
    pub order_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(rarity: u8)]
pub struct CancelLimitOrder<'info> {
    #[account(mut)]
    pub maker: Signer<'info>,
    #[account(mut, close = maker, seeds = [LIMIT_ORDER_SEED, maker.key().as_ref(), &[rarity]], bump, constraint = order.maker == maker.key() @ MarketError::Unauthorized)]
    pub order: Account<'info, HotLimitOrder>,
    #[account(mut)]
    pub currency_mint: Account<'info, Mint>,
    #[account(mut, constraint = order_vault.owner == order.key(), constraint = order_vault.mint == currency_mint.key())]
    pub order_vault: Account<'info, TokenAccount>,
    #[account(mut, constraint = maker_currency.mint == currency_mint.key(), constraint = maker_currency.owner == maker.key())]
    pub maker_currency: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

fn rarity_index_ok(r: u8) -> Result<()> {
    require!(r <= 3, MarketError::Unauthorized);
    Ok(())
}

#[program]
pub mod aof_market {
    use super::*;

    pub fn init_market_config(ctx: Context<InitConfig>, fee_bps: u16) -> Result<()> {
        let c = &mut ctx.accounts.config;
        c.authority = ctx.accounts.authority.key();
        c.treasury = ctx.accounts.treasury.key();
        c.core_mint = ctx.accounts.core_mint.key();
        c.gem_mint = ctx.accounts.gem_mint.key();
        c.fee_bps = fee_bps;
        c.paused = false;
        c.bump = ctx.bumps.config;
        Ok(())
    }

    pub fn set_fees(ctx: Context<SetFees>, fee_bps: u16) -> Result<()> {
        ctx.accounts.config.fee_bps = fee_bps;
        Ok(())
    }

    pub fn set_paused(ctx: Context<SetPaused>, paused: bool) -> Result<()> {
        ctx.accounts.config.paused = paused;
        Ok(())
    }

    pub fn init_pool(
        ctx: Context<InitPool>,
        rarity: u8,
        target_price_core: u64,
        target_price_gem: u64,
        target_rate_per_hour: u64,
        decay_bps_per_hour: u16,
        growth_bps_per_sale: u16,
        fee_bps: u16,
    ) -> Result<()> {
        rarity_index_ok(rarity)?;
        let now = Clock::get()?.unix_timestamp;
        let p = &mut ctx.accounts.pool;
        p.rarity = rarity;
        p.target_price_core = target_price_core;
        p.target_price_gem = target_price_gem;
        p.target_rate_per_hour = target_rate_per_hour;
        p.decay_bps_per_hour = decay_bps_per_hour;
        p.growth_bps_per_sale = growth_bps_per_sale;
        p.sold_since_start = 0;
        p.purchases_in_window = 0;
        p.start_ts = now;
        p.last_trade_ts = now;
        p.hot_window_end_ts = 0;
        p.hot_multiplier_bps = 0;
        p.fee_bps = fee_bps;
        p.paused = false;
        p.bump = ctx.bumps.pool;
        Ok(())
    }

    pub fn hot_market_buy(ctx: Context<HotMarketBuy>, rarity: u8, currency: Currency, max_price: u64) -> Result<()> {
        rarity_index_ok(rarity)?;
        let now = Clock::get()?.unix_timestamp;
        let pool = &mut ctx.accounts.pool;
        let base = match currency {
            Currency::Core => pool.target_price_core,
            Currency::Gem => pool.target_price_gem,
        };
        let raw = pricing::current_price(
            base,
            pool.growth_bps_per_sale,
            pool.decay_bps_per_hour,
            pool.purchases_in_window,
            pool.last_trade_ts,
            now,
        )?;
        let is_hot = pool.hot_window_end_ts > now;
        let price = pricing::apply_hot_multiplier(raw, pool.hot_multiplier_bps, is_hot)?;
        require!(price <= max_price, MarketError::SlippageExceeded);
        let fee = (price as u128)
            .checked_mul(pool.fee_bps as u128)
            .ok_or(MarketError::MathOverflow)?
            .checked_div(10_000)
            .ok_or(MarketError::MathOverflow)? as u64;
        let net = price.checked_sub(fee).ok_or(MarketError::MathOverflow)?;
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.buyer_currency.to_account_info(),
                    to: ctx.accounts.treasury_currency.to_account_info(),
                    authority: ctx.accounts.buyer.to_account_info(),
                },
            ),
            price,
        )?;
        let _ = net;
        pool.purchases_in_window = pool.purchases_in_window.saturating_add(1);
        pool.sold_since_start = pool.sold_since_start.checked_add(1).ok_or(MarketError::MathOverflow)?;
        pool.last_trade_ts = now;
        emit!(HotMarketBought {
            buyer: ctx.accounts.buyer.key(),
            rarity,
            currency,
            price,
            sold_since_start: pool.sold_since_start,
        });
        Ok(())
    }

    pub fn hot_market_sell_into_queue(ctx: Context<HotMarketSell>, rarity: u8, currency: Currency, min_price: u64) -> Result<()> {
        rarity_index_ok(rarity)?;
        let now = Clock::get()?.unix_timestamp;
        let pool = &mut ctx.accounts.pool;
        let base = match currency {
            Currency::Core => pool.target_price_core,
            Currency::Gem => pool.target_price_gem,
        };
        let price = pricing::current_price(
            base,
            pool.growth_bps_per_sale,
            pool.decay_bps_per_hour,
            pool.purchases_in_window,
            pool.last_trade_ts,
            now,
        )?;
        require!(price >= min_price, MarketError::SlippageExceeded);
        require!(ctx.accounts.pool_currency.amount >= price, MarketError::InsufficientReserve);
        let pool_bump = pool.bump;
        let seeds: &[&[u8]] = &[POOL_SEED, &[rarity], &[pool_bump]];
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.pool_currency.to_account_info(),
                    to: ctx.accounts.seller_currency.to_account_info(),
                    authority: ctx.accounts.pool.to_account_info(),
                },
                &[seeds],
            ),
            price,
        )?;
        pool.last_trade_ts = now;
        pool.purchases_in_window = pool.purchases_in_window.saturating_sub(1);
        emit!(HotMarketSold {
            seller: ctx.accounts.seller.key(),
            rarity,
            currency,
            price,
        });
        Ok(())
    }

    pub fn start_market_event(ctx: Context<StartEvent>, rarity: u8, duration_seconds: i64, multiplier_bps: u16) -> Result<()> {
        rarity_index_ok(rarity)?;
        require!(duration_seconds > 0 && duration_seconds <= 24 * 3600, MarketError::InvalidWindowDuration);
        let now = Clock::get()?.unix_timestamp;
        let pool = &mut ctx.accounts.pool;
        pool.hot_window_end_ts = now.checked_add(duration_seconds).ok_or(MarketError::MathOverflow)?;
        pool.hot_multiplier_bps = multiplier_bps;
        emit!(HotMarketEventStarted { rarity, end_ts: pool.hot_window_end_ts, multiplier_bps });
        Ok(())
    }

    pub fn crank_market(ctx: Context<Crank>, rarity: u8) -> Result<()> {
        rarity_index_ok(rarity)?;
        let now = Clock::get()?.unix_timestamp;
        let pool = &mut ctx.accounts.pool;
        let hours_idle = (now - pool.last_trade_ts) / 3600;
        if hours_idle >= 1 {
            pool.purchases_in_window = 0;
        }
        emit!(HotMarketCranked {
            rarity,
            new_price_core: pricing::current_price(pool.target_price_core, pool.growth_bps_per_sale, pool.decay_bps_per_hour, pool.purchases_in_window, pool.last_trade_ts, now)?,
            new_price_gem: pricing::current_price(pool.target_price_gem, pool.growth_bps_per_sale, pool.decay_bps_per_hour, pool.purchases_in_window, pool.last_trade_ts, now)?,
        });
        Ok(())
    }

    pub fn hot_market_skip(ctx: Context<Skip>, rarity: u8) -> Result<()> {
        rarity_index_ok(rarity)?;
        emit!(HotMarketSkipped { user: ctx.accounts.user.key(), rarity });
        Ok(())
    }

    pub fn place_limit_order(
        ctx: Context<PlaceLimitOrder>,
        rarity: u8,
        currency: Currency,
        is_buy: bool,
        limit_price: u64,
        amount: u64,
    ) -> Result<()> {
        rarity_index_ok(rarity)?;
        require!(amount > 0, MarketError::ZeroAmount);
        if is_buy {
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.maker_currency.to_account_info(),
                        to: ctx.accounts.order_vault.to_account_info(),
                        authority: ctx.accounts.maker.to_account_info(),
                    },
                ),
                limit_price.checked_mul(amount).ok_or(MarketError::MathOverflow)?,
            )?;
        }
        let o = &mut ctx.accounts.order;
        o.maker = ctx.accounts.maker.key();
        o.rarity = rarity;
        o.currency = currency;
        o.is_buy = is_buy;
        o.limit_price = limit_price;
        o.amount_escrowed = amount;
        o.active = true;
        emit!(LimitOrderPlaced { maker: ctx.accounts.maker.key(), rarity, is_buy, limit_price });
        Ok(())
    }

    pub fn cancel_limit_order(ctx: Context<CancelLimitOrder>, rarity: u8) -> Result<()> {
        rarity_index_ok(rarity)?;
        require!(ctx.accounts.order.active, MarketError::OrderNotActive);
        if ctx.accounts.order.is_buy {
            let maker_key = ctx.accounts.maker.key();
            let bump = ctx.bumps.order;
            let seeds: &[&[u8]] = &[LIMIT_ORDER_SEED, maker_key.as_ref(), &[rarity], &[bump]];
            let refund = ctx.accounts.order.limit_price.checked_mul(ctx.accounts.order.amount_escrowed).ok_or(MarketError::MathOverflow)?;
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.order_vault.to_account_info(),
                        to: ctx.accounts.maker_currency.to_account_info(),
                        authority: ctx.accounts.order.to_account_info(),
                    },
                    &[seeds],
                ),
                refund,
            )?;
        }
        ctx.accounts.order.active = false;
        Ok(())
    }
}
RUST_EOF

# ============================================================
# Cargo.toml — убеждаемся что anchor-spl есть
# ============================================================
echo ""
echo "📝 Проверяем Cargo.toml"
if ! grep -q "anchor-spl" "$MARKET/Cargo.toml"; then
    echo "⚠️  Добавляем anchor-spl зависимость"
    sed -i '' '/anchor-lang.*init-if-needed/a\
anchor-spl = "0.30.1"' "$MARKET/Cargo.toml"
fi

echo ""
echo "================================================"
echo "🔨 Запуск сборки"
echo "================================================"
cd /Users/zlata/Desktop/aof_gui
anchor build 2>&1 | tee /tmp/build5.log

echo ""
echo "=== Последние 15 строк ==="
tail -15 /tmp/build5.log

echo ""
echo "=== Ошибок ==="
grep -cE "^error" /tmp/build5.log && grep -E "^error\[" /tmp/build5.log | sort | uniq -c | sort -rn | head -10 || echo "0 ошибок"
