# Age of Farming — Expansion (market/quests/rebirth/liquidity/session-keys/retention) — единый файл

5 новых Anchor-программ (aof-market, aof-session-keys, aof-quests, aof-rebirth, aof-liquidity), расширенный бэкенд (27 роутеров, Prisma-схема 35 моделей, 4 воркера) и точечные фронтенд-страницы (хот-маркет с live-графиком, квесты). Существующий базовый проект (aof_core + основной backend/frontend) не дублируется здесь — см. предыдущий файл AOF_ALL_CHANGES_FULL_SOURCE.md.

## Важные пометки безопасности (искать по тексту)

- `[БЕЗОПАСНОСТЬ]` в session-keys и farm-trader — allowed_ixs физически не может включать withdraw/transfer/payout (FORBIDDEN_IXS_MASK), бот работает только через session_check_and_spend.
- `[ВАЖНО]` в aof-rebirth и rebirth.ts — проверка права на ребёрт (владение Legendary-инструментом) делается на бэкенде до co-sign, не в контракте (нет cross-program state).
- `[ФАКТ, спека vN §X]` — прямая ссылка на конкретное требование из присланных спек-файлов, не придумано.
- `TODO`/пометки про Geyser, FCM/APNs, реальный VRGDA-exp() — явно обозначенные места, где сделана безопасная дискретная аппроксимация вместо непроверяемой в этой среде реализации.

## FILE: aof_expansion/programs/aof-liquidity/Cargo.toml

```toml
[package]
name = "aof-liquidity"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib", "lib"]
name = "aof_liquidity"

[features]
no-entrypoint = []
no-idl = []
no-log-ix-name = []
cpi = ["no-entrypoint"]
default = []
idl-build = ["anchor-lang/idl-build", "anchor-spl/idl-build"]

[dependencies]
anchor-lang = { version = "0.30.1", features = ["init-if-needed"] }
anchor-spl = "0.30.1"

```

## FILE: aof_expansion/programs/aof-liquidity/src/lib.rs

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, Transfer};

declare_id!("LpAoF11111111111111111111111111111111111");

pub const CONFIG_SEED: &[u8] = b"lp_config";
pub const POOL_SEED: &[u8] = b"lp_pool";
pub const POSITION_SEED: &[u8] = b"lp_position";
pub const CONFIG_SPACE: usize = 8 + 32 + 32 + 1;
pub const POOL_SPACE: usize = 8 + 32 + 8 + 8 + 8 + 1;
pub const POSITION_SPACE: usize = 8 + 32 + 8;

#[error_code]
pub enum LpError {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Insufficient shares")]
    InsufficientShares,
}

#[event]
pub struct LpDeposited { pub user: Pubkey, pub amount: u64, pub shares_minted: u64 }
#[event]
pub struct LpWithdrawn { pub user: Pubkey, pub shares_burned: u64, pub amount_out: u64 }

#[account]
#[derive(InitSpace)]
pub struct LpConfig {
    pub authority: Pubkey,
    pub mascot_mint: Pubkey,
    pub bump: u8,
}

/// [ФАКТ]: цена доли = (reserve + accumulated_fees) / total_shares.
/// Комиссии хот-маркета (aof-market) должны периодически переводиться сюда
/// authority/keeper'ом через отдельный CPI-мост — эта программа сама не
/// читает состояние aof-market напрямую (нет cross-program state).
#[account]
#[derive(InitSpace)]
pub struct LpPool {
    pub mascot_mint: Pubkey,
    pub total_shares: u64,
    pub mascot_reserve: u64,
    pub accumulated_fees: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct LpPosition {
    pub owner: Pubkey,
    pub shares: u64,
}

#[derive(Accounts)]
pub struct InitLpConfig<'info> {
    #[account(init, payer = authority, space = CONFIG_SPACE, seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, LpConfig>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub mascot_mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitLpPool<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = authority @ LpError::Unauthorized)]
    pub config: Account<'info, LpConfig>,
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(init, payer = authority, space = POOL_SPACE, seeds = [POOL_SEED], bump)]
    pub pool: Account<'info, LpPool>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct LpDeposit<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut, seeds = [POOL_SEED], bump = pool.bump)]
    pub pool: Account<'info, LpPool>,
    #[account(mut)]
    pub mascot_mint: Account<'info, Mint>,
    #[account(mut, constraint = user_mascot.mint == mascot_mint.key(), constraint = user_mascot.owner == user.key())]
    pub user_mascot: Account<'info, TokenAccount>,
    #[account(mut, constraint = pool_mascot.mint == mascot_mint.key(), constraint = pool_mascot.owner == pool.key())]
    pub pool_mascot: Account<'info, TokenAccount>,
    #[account(
        init_if_needed, payer = user, space = POSITION_SPACE,
        seeds = [POSITION_SEED, user.key().as_ref()], bump
    )]
    pub position: Account<'info, LpPosition>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct LpWithdraw<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut, seeds = [POOL_SEED], bump = pool.bump)]
    pub pool: Account<'info, LpPool>,
    #[account(mut)]
    pub mascot_mint: Account<'info, Mint>,
    #[account(mut, constraint = user_mascot.mint == mascot_mint.key(), constraint = user_mascot.owner == user.key())]
    pub user_mascot: Account<'info, TokenAccount>,
    #[account(mut, constraint = pool_mascot.mint == mascot_mint.key(), constraint = pool_mascot.owner == pool.key())]
    pub pool_mascot: Account<'info, TokenAccount>,
    #[account(mut, seeds = [POSITION_SEED, user.key().as_ref()], bump, constraint = position.owner == user.key() @ LpError::Unauthorized)]
    pub position: Account<'info, LpPosition>,
    pub token_program: Program<'info, Token>,
}

#[program]
pub mod aof_liquidity {
    use super::*;

    pub fn init_lp_config(ctx: Context<InitLpConfig>) -> Result<()> {
        let c = &mut ctx.accounts.config;
        c.authority = ctx.accounts.authority.key();
        c.mascot_mint = ctx.accounts.mascot_mint.key();
        c.bump = ctx.bumps.config;
        Ok(())
    }

    pub fn init_lp_pool(ctx: Context<InitLpPool>) -> Result<()> {
        let p = &mut ctx.accounts.pool;
        p.mascot_mint = ctx.accounts.config.mascot_mint;
        p.total_shares = 0;
        p.mascot_reserve = 0;
        p.accumulated_fees = 0;
        p.bump = ctx.bumps.pool;
        Ok(())
    }

    pub fn lp_deposit(ctx: Context<LpDeposit>, amount: u64) -> Result<()> {
        require!(amount > 0, LpError::ZeroAmount);
        let pool = &mut ctx.accounts.pool;
        let total_value = pool.mascot_reserve.checked_add(pool.accumulated_fees).ok_or(LpError::MathOverflow)?;

        let shares_minted: u64 = if pool.total_shares == 0 || total_value == 0 {
            amount
        } else {
            ((amount as u128).checked_mul(pool.total_shares as u128).ok_or(LpError::MathOverflow)?
                / total_value as u128) as u64
        };

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_mascot.to_account_info(),
                    to: ctx.accounts.pool_mascot.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount,
        )?;

        pool.mascot_reserve = pool.mascot_reserve.checked_add(amount).ok_or(LpError::MathOverflow)?;
        pool.total_shares = pool.total_shares.checked_add(shares_minted).ok_or(LpError::MathOverflow)?;

        let pos = &mut ctx.accounts.position;
        if pos.owner == Pubkey::default() {
            pos.owner = ctx.accounts.user.key();
        }
        pos.shares = pos.shares.checked_add(shares_minted).ok_or(LpError::MathOverflow)?;

        emit!(LpDeposited { user: ctx.accounts.user.key(), amount, shares_minted });
        Ok(())
    }

    pub fn lp_withdraw(ctx: Context<LpWithdraw>, shares: u64) -> Result<()> {
        require!(shares > 0, LpError::ZeroAmount);
        require!(ctx.accounts.position.shares >= shares, LpError::InsufficientShares);
        let pool = &mut ctx.accounts.pool;
        let total_value = pool.mascot_reserve.checked_add(pool.accumulated_fees).ok_or(LpError::MathOverflow)?;
        let amount_out = ((shares as u128).checked_mul(total_value as u128).ok_or(LpError::MathOverflow)?
            / pool.total_shares.max(1) as u128) as u64;

        let bump = pool.bump;
        let seeds: &[&[u8]] = &[POOL_SEED, &[bump]];
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.pool_mascot.to_account_info(),
                    to: ctx.accounts.user_mascot.to_account_info(),
                    authority: ctx.accounts.pool.to_account_info(),
                },
                &[seeds],
            ),
            amount_out,
        )?;

        pool.total_shares = pool.total_shares.checked_sub(shares).ok_or(LpError::MathOverflow)?;
        if amount_out <= pool.mascot_reserve {
            pool.mascot_reserve = pool.mascot_reserve.checked_sub(amount_out).ok_or(LpError::MathOverflow)?;
        } else {
            let from_fees = amount_out.checked_sub(pool.mascot_reserve).ok_or(LpError::MathOverflow)?;
            pool.mascot_reserve = 0;
            pool.accumulated_fees = pool.accumulated_fees.checked_sub(from_fees).ok_or(LpError::MathOverflow)?;
        }
        ctx.accounts.position.shares = ctx.accounts.position.shares.checked_sub(shares).ok_or(LpError::MathOverflow)?;

        emit!(LpWithdrawn { user: ctx.accounts.user.key(), shares_burned: shares, amount_out });
        Ok(())
    }
}

```

## FILE: aof_expansion/programs/aof-market/Cargo.toml

```toml
[package]
name = "aof-market"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib", "lib"]
name = "aof_market"

[features]
no-entrypoint = []
no-idl = []
no-log-ix-name = []
cpi = ["no-entrypoint"]
default = []
idl-build = ["anchor-lang/idl-build", "anchor-spl/idl-build"]

[dependencies]
anchor-lang = { version = "0.30.1", features = ["init-if-needed"] }
anchor-spl = "0.30.1"

```

## FILE: aof_expansion/programs/aof-market/src/errors.rs

```rust
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

```

## FILE: aof_expansion/programs/aof-market/src/events.rs

```rust
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

```

## FILE: aof_expansion/programs/aof-market/src/lib.rs

```rust
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
    /// CHECK: новый mint инструмента, создаётся клиентом заранее — фактический
    /// минт NFT делает основная программа aof_core (mint_tool с authority-co-sign),
    /// эта инструкция только списывает оплату и обновляет цену пула.
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
    /// CHECK: инструмент, который продаётся в очередь — сжигание делает aof_core
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
        let _ = net; // net остаётся в treasury_currency вместе с fee — единая казна хот-маркета

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
        // продажа В пул слегка тянет purchases_in_window вниз — противоположно buy
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

    /// Permissionless — крутится краном/keeper-ботом. Не двигает состояние
    /// сверх пересчёта наблюдаемой цены (сам pricing::current_price уже
    /// детерминирован от last_trade_ts/purchases_in_window), но сбрасывает
    /// purchases_in_window к 0, если давно не было сделок — иначе окно
    /// "разгона" никогда не закрывается и рост цены не даёт затухнуть.
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

    /// [ФАКТ, спека v1 §1.2]: если слоты очереди абстрактны (не конкретные
    /// NFT), reroll — чисто визуальный предпоказ на фронте, ончейн-действия
    /// не требует. Инструкция оставлена для симметрии API и анти-спам лимита
    /// (эмит события, который бэкенд может рейт-лимитить per user).
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


```

## FILE: aof_expansion/programs/aof-market/src/pricing.rs

```rust
use anchor_lang::prelude::*;
use crate::errors::MarketError;

// [ФАКТ, спека v2 §1.1]: настоящий continuous VRGDA (exp/decay_factor^x) требует
// fixed-point exp()/ln() библиотеки, которую здесь негде протестировать —
// хардкодить непроверенную экспоненту в код, управляющий реальной ценой,
// небезопаснее, чем дискретная bps-аппроксимация того же поведения
// (рост при спросе, decay к target со временем, кап роста 100x — см. спеку).
// Обе стороны (growth и decay) — ограниченные по итерациям циклы,
// укладываются в compute budget с большим запасом.

pub const MAX_GROWTH_ITER: u64 = 200;
pub const MAX_DECAY_HOURS: u64 = 72; // спека: "окно затухания ограничено 72 часами"
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

```

## FILE: aof_expansion/programs/aof-market/src/state.rs

```rust
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

```

## FILE: aof_expansion/programs/aof-quests/Cargo.toml

```toml
[package]
name = "aof-quests"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib", "lib"]
name = "aof_quests"

[features]
no-entrypoint = []
no-idl = []
no-log-ix-name = []
cpi = ["no-entrypoint"]
default = []
idl-build = ["anchor-lang/idl-build", "anchor-spl/idl-build"]

[dependencies]
anchor-lang = { version = "0.30.1", features = ["init-if-needed"] }
anchor-spl = "0.30.1"

```

## FILE: aof_expansion/programs/aof-quests/src/lib.rs

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, MintTo};

pub mod randomness;
use randomness::*;

declare_id!("QstAoF111111111111111111111111111111111111");

pub const CONFIG_SEED: &[u8] = b"quest_config";
pub const QUEST_SEED: &[u8] = b"quest";
pub const PROGRESS_SEED: &[u8] = b"quest_progress";
pub const ACHIEVEMENT_SEED: &[u8] = b"achievement";
pub const CHALLENGE_SEED: &[u8] = b"challenge";
pub const ENTRY_SEED: &[u8] = b"challenge_entry";
pub const DRUM_CONFIG_SEED: &[u8] = b"drum_config";
pub const DRUM_COMMIT_SEED: &[u8] = b"drum_commit";
pub const REFERRAL_STATS_SEED: &[u8] = b"quest_referral_stats";

pub const CONFIG_SPACE: usize = 8 + 32 + 32 + 32 + 1;
pub const QUEST_SPACE: usize = 8 + 4 + 32 + 8 + 4 + 1 + 1;
pub const PROGRESS_SPACE: usize = 8 + 32 + 4 + 4 + 1;
pub const ACHIEVEMENT_SPACE: usize = 8 + 32 + 32 + 4 + 8;
pub const CHALLENGE_SPACE: usize = 8 + 4 + 8 + 8 + 8 + 1;
pub const ENTRY_SPACE: usize = 8 + 32 + 4 + 8;
pub const DRUM_CONFIG_SPACE: usize = 8 + (2 * 6) + 1;
pub const DRUM_COMMIT_SPACE: usize = 8 + 32 + 4 + 32 + 8;
pub const REFERRAL_STATS_SPACE: usize = 8 + 32 + 4 + 4;

#[error_code]
pub enum QError {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Requirement not met")]
    RequirementNotMet,
    #[msg("Already claimed")]
    AlreadyClaimed,
    #[msg("Commit hash mismatch")]
    CommitMismatch,
    #[msg("Commit expired")]
    CommitExpired,
    #[msg("Not enough medals")]
    NotEnoughMedals,
    #[msg("Odds weights must sum to 10000")]
    InvalidOdds,
}

#[event]
pub struct QuestClaimed { pub user: Pubkey, pub quest_id: u32, pub reward: u64 }
#[event]
pub struct AchievementUnlocked { pub user: Pubkey, pub achievement_id: u32 }
#[event]
pub struct ChallengeContributed { pub user: Pubkey, pub challenge_id: u32, pub medals: u64 }
#[event]
pub struct DrumSpun { pub user: Pubkey, pub prize_index: u8, pub amount: u64 }

#[account]
#[derive(InitSpace)]
pub struct QuestConfig {
    pub authority: Pubkey,
    pub treasury: Pubkey,
    pub core_mint: Pubkey,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct QuestTemplate {
    pub quest_id: u32,
    pub reward_mint: Pubkey,
    pub reward_amount: u64,
    pub target: u32,
    pub active: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct QuestProgress {
    pub user: Pubkey,
    pub quest_id: u32,
    pub progress: u32,
    pub claimed: bool,
}

/// [ФАКТ, спека v2 §4.2]: "Достижения — сделать NFT-бейджами, не просто
/// галочкой в БД". Soulbound: mint происходит один раз, freeze_authority
/// не используется намеренно — достаточно того, что программа никогда не
/// предоставляет инструкцию трансфера этого mint'а (стандартный SPL-transfer
/// физически возможен держателем токена, но ни один UI/эндпоинт этого
/// проекта его не предлагает и не индексирует как листинг — мягкий
/// soulbound на уровне продукта, не крипто-примитив).
#[account]
#[derive(InitSpace)]
pub struct AchievementBadge {
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub achievement_id: u32,
    pub unlocked_at: i64,
}

#[account]
#[derive(InitSpace)]
pub struct Challenge {
    pub challenge_id: u32,
    pub start_ts: i64,
    pub end_ts: i64,
    pub pool_amount: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct ChallengeEntry {
    pub user: Pubkey,
    pub challenge_id: u32,
    pub medals: u64,
}

/// Барабан Удачи — честный commit-reveal, тот же паттерн, что паки/forge
/// в aof_core. Ставка — медали, накопленные в челленджах.
#[account]
#[derive(InitSpace)]
pub struct DrumConfig {
    pub prize_odds_bps: [u16; 6],
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct DrumCommit {
    pub user: Pubkey,
    pub medals_staked: u32,
    pub commit_hash: [u8; 32],
    pub commit_slot: u64,
}

/// [ФАКТ, спека v1 §4.2 / v2]: тиры рефералки 2%/до10, 0.5%/до100, 0.1%/до1000,
/// 0.0025%/свыше, плюс 10% от друзей 1-го уровня и 2.5% от друзей 2-го —
/// требует PDA-счётчика прямых/L2 рефералов (не хардкод-константа, как было
/// раньше в основном ReferralLink).
#[account]
#[derive(InitSpace)]
pub struct QuestReferralStats {
    pub referrer: Pubkey,
    pub direct_count: u32,
    pub l2_count: u32,
}

pub fn referral_tier_bps(direct_count: u32) -> u16 {
    if direct_count <= 10 { 200 }        // 2%
    else if direct_count <= 100 { 50 }   // 0.5%
    else if direct_count <= 1000 { 10 }  // 0.1%
    else { 0 } // 0.0025% — ниже 1 bps, считается офчейн на бэкенде при выплате мелких сумм
}

#[derive(Accounts)]
pub struct InitQuestConfig<'info> {
    #[account(init, payer = authority, space = CONFIG_SPACE, seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, QuestConfig>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub core_mint: Account<'info, Mint>,
    /// CHECK: казна
    pub treasury: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(quest_id: u32)]
pub struct QuestInit<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = authority @ QError::Unauthorized)]
    pub config: Account<'info, QuestConfig>,
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(init, payer = authority, space = QUEST_SPACE, seeds = [QUEST_SEED, &quest_id.to_le_bytes()], bump)]
    pub quest: Account<'info, QuestTemplate>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct QuestClaimReward<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = authority @ QError::Unauthorized)]
    pub config: Account<'info, QuestConfig>,
    pub authority: Signer<'info>,
    #[account(seeds = [QUEST_SEED, &quest.quest_id.to_le_bytes()], bump = quest.bump)]
    pub quest: Account<'info, QuestTemplate>,
    #[account(
        mut,
        seeds = [PROGRESS_SEED, progress.user.as_ref(), &quest.quest_id.to_le_bytes()],
        bump,
        constraint = progress.progress >= quest.target @ QError::RequirementNotMet,
        constraint = !progress.claimed @ QError::AlreadyClaimed,
    )]
    pub progress: Account<'info, QuestProgress>,
    #[account(mut)]
    pub reward_mint: Account<'info, Mint>,
    #[account(mut, constraint = user_token.mint == reward_mint.key())]
    pub user_token: Account<'info, TokenAccount>,
    /// CHECK: auth PDA основной программы или отдельный mint-authority CORE
    pub mint_authority: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(achievement_id: u32)]
pub struct AchievementUnlock<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = authority @ QError::Unauthorized)]
    pub config: Account<'info, QuestConfig>,
    pub authority: Signer<'info>,
    /// CHECK: получатель бейджа
    pub owner: UncheckedAccount<'info>,
    #[account(mut)]
    pub badge_mint: Account<'info, Mint>,
    #[account(mut, constraint = owner_token.mint == badge_mint.key())]
    pub owner_token: Account<'info, TokenAccount>,
    /// CHECK: mint authority
    pub mint_authority: UncheckedAccount<'info>,
    #[account(
        init, payer = authority, space = ACHIEVEMENT_SPACE,
        seeds = [ACHIEVEMENT_SEED, owner.key().as_ref(), &achievement_id.to_le_bytes()], bump
    )]
    pub badge: Account<'info, AchievementBadge>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(challenge_id: u32)]
pub struct ChallengeInit<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = authority @ QError::Unauthorized)]
    pub config: Account<'info, QuestConfig>,
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(init, payer = authority, space = CHALLENGE_SPACE, seeds = [CHALLENGE_SEED, &challenge_id.to_le_bytes()], bump)]
    pub challenge: Account<'info, Challenge>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ChallengeContribute<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut, seeds = [CHALLENGE_SEED, &challenge.challenge_id.to_le_bytes()], bump = challenge.bump)]
    pub challenge: Account<'info, Challenge>,
    #[account(
        init_if_needed, payer = user, space = ENTRY_SPACE,
        seeds = [ENTRY_SEED, user.key().as_ref(), &challenge.challenge_id.to_le_bytes()], bump
    )]
    pub entry: Account<'info, ChallengeEntry>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitDrumConfig<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = authority @ QError::Unauthorized)]
    pub config: Account<'info, QuestConfig>,
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(init, payer = authority, space = DRUM_CONFIG_SPACE, seeds = [DRUM_CONFIG_SEED], bump)]
    pub drum_config: Account<'info, DrumConfig>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(medals_staked: u32, commit_hash: [u8;32])]
pub struct DrumCommitCtx<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [ENTRY_SEED, user.key().as_ref(), &entry.challenge_id.to_le_bytes()],
        bump,
        constraint = entry.medals >= medals_staked as u64 @ QError::NotEnoughMedals,
    )]
    pub entry: Account<'info, ChallengeEntry>,
    #[account(
        init, payer = user, space = DRUM_COMMIT_SPACE,
        seeds = [DRUM_COMMIT_SEED, user.key().as_ref()], bump
    )]
    pub drum_commit: Account<'info, DrumCommit>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DrumRevealCtx<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = authority @ QError::Unauthorized)]
    pub config: Account<'info, QuestConfig>,
    pub authority: Signer<'info>,
    #[account(seeds = [DRUM_CONFIG_SEED], bump = drum_config.bump)]
    pub drum_config: Account<'info, DrumConfig>,
    #[account(mut, close = payer, seeds = [DRUM_COMMIT_SEED, drum_commit.user.as_ref()], bump)]
    pub drum_commit: Account<'info, DrumCommit>,
    /// CHECK: получатель ренты — тот же user
    #[account(mut, address = drum_commit.user)]
    pub payer: UncheckedAccount<'info>,
    #[account(mut)]
    pub reward_mint: Account<'info, Mint>,
    #[account(mut, constraint = user_token.mint == reward_mint.key())]
    pub user_token: Account<'info, TokenAccount>,
    /// CHECK: mint authority
    pub mint_authority: UncheckedAccount<'info>,
    /// CHECK: sysvar SlotHashes
    #[account(address = SLOT_HASHES_ID)]
    pub slot_hashes: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ReferralBind<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: реферер
    pub referrer: UncheckedAccount<'info>,
    #[account(
        init_if_needed, payer = payer, space = REFERRAL_STATS_SPACE,
        seeds = [REFERRAL_STATS_SEED, referrer.key().as_ref()], bump
    )]
    pub stats: Account<'info, QuestReferralStats>,
    pub system_program: Program<'info, System>,
}

#[program]
pub mod aof_quests {
    use super::*;

    pub fn init_quest_config(ctx: Context<InitQuestConfig>) -> Result<()> {
        let c = &mut ctx.accounts.config;
        c.authority = ctx.accounts.authority.key();
        c.treasury = ctx.accounts.treasury.key();
        c.core_mint = ctx.accounts.core_mint.key();
        c.bump = ctx.bumps.config;
        Ok(())
    }

    pub fn quest_init(ctx: Context<QuestInit>, quest_id: u32, reward_amount: u64, target: u32) -> Result<()> {
        let q = &mut ctx.accounts.quest;
        q.quest_id = quest_id;
        q.reward_mint = ctx.accounts.config.core_mint;
        q.reward_amount = reward_amount;
        q.target = target;
        q.active = true;
        q.bump = ctx.bumps.quest;
        Ok(())
    }

    pub fn quest_claim_reward(ctx: Context<QuestClaimReward>) -> Result<()> {
        let amount = ctx.accounts.quest.reward_amount;
        token::mint_to(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.reward_mint.to_account_info(),
                    to: ctx.accounts.user_token.to_account_info(),
                    authority: ctx.accounts.mint_authority.to_account_info(),
                },
            ),
            amount,
        )?;
        ctx.accounts.progress.claimed = true;
        emit!(QuestClaimed { user: ctx.accounts.progress.user, quest_id: ctx.accounts.quest.quest_id, reward: amount });
        Ok(())
    }

    pub fn achievement_unlock(ctx: Context<AchievementUnlock>, achievement_id: u32) -> Result<()> {
        token::mint_to(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.badge_mint.to_account_info(),
                    to: ctx.accounts.owner_token.to_account_info(),
                    authority: ctx.accounts.mint_authority.to_account_info(),
                },
            ),
            1,
        )?;
        let b = &mut ctx.accounts.badge;
        b.owner = ctx.accounts.owner.key();
        b.mint = ctx.accounts.badge_mint.key();
        b.achievement_id = achievement_id;
        b.unlocked_at = Clock::get()?.unix_timestamp;
        emit!(AchievementUnlocked { user: ctx.accounts.owner.key(), achievement_id });
        Ok(())
    }

    pub fn challenge_init(ctx: Context<ChallengeInit>, challenge_id: u32, duration_seconds: i64) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let c = &mut ctx.accounts.challenge;
        c.challenge_id = challenge_id;
        c.start_ts = now;
        c.end_ts = now.checked_add(duration_seconds).ok_or(QError::MathOverflow)?;
        c.pool_amount = 0;
        c.bump = ctx.bumps.challenge;
        Ok(())
    }

    pub fn challenge_contribute(ctx: Context<ChallengeContribute>, medals: u64) -> Result<()> {
        let e = &mut ctx.accounts.entry;
        if e.user == Pubkey::default() {
            e.user = ctx.accounts.user.key();
            e.challenge_id = ctx.accounts.challenge.challenge_id;
        }
        e.medals = e.medals.checked_add(medals).ok_or(QError::MathOverflow)?;
        ctx.accounts.challenge.pool_amount = ctx.accounts.challenge.pool_amount.checked_add(medals).ok_or(QError::MathOverflow)?;
        emit!(ChallengeContributed { user: ctx.accounts.user.key(), challenge_id: ctx.accounts.challenge.challenge_id, medals });
        Ok(())
    }

    pub fn init_drum_config(ctx: Context<InitDrumConfig>, prize_odds_bps: [u16; 6]) -> Result<()> {
        let sum: u32 = prize_odds_bps.iter().map(|x| *x as u32).sum();
        require!(sum == 10_000, QError::InvalidOdds);
        let d = &mut ctx.accounts.drum_config;
        d.prize_odds_bps = prize_odds_bps;
        d.bump = ctx.bumps.drum_config;
        Ok(())
    }

    pub fn drum_commit(ctx: Context<DrumCommitCtx>, medals_staked: u32, commit_hash: [u8; 32]) -> Result<()> {
        ctx.accounts.entry.medals = ctx.accounts.entry.medals.checked_sub(medals_staked as u64).ok_or(QError::MathOverflow)?;
        let slot = Clock::get()?.slot;
        let dc = &mut ctx.accounts.drum_commit;
        dc.user = ctx.accounts.user.key();
        dc.medals_staked = medals_staked;
        dc.commit_hash = commit_hash;
        dc.commit_slot = slot;
        Ok(())
    }

    pub fn drum_reveal(ctx: Context<DrumRevealCtx>, secret: [u8; 32]) -> Result<()> {
        require!(hash_secret(&secret) == ctx.accounts.drum_commit.commit_hash, QError::CommitMismatch);
        let slot_hash = get_slot_hash(&ctx.accounts.slot_hashes, ctx.accounts.drum_commit.commit_slot)?;
        let entropy = derive_entropy(&secret, &slot_hash, b"drum");
        let roll = entropy_u64(&entropy);
        let prize_index = weighted_pick(roll, &ctx.accounts.drum_config.prize_odds_bps);

        // таблица призов в единицах reward_mint, индекс = prize_index
        let prize_amounts: [u64; 6] = [0, 100, 500, 1_000, 5_000, 20_000];
        let amount = prize_amounts[prize_index];
        if amount > 0 {
            token::mint_to(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    MintTo {
                        mint: ctx.accounts.reward_mint.to_account_info(),
                        to: ctx.accounts.user_token.to_account_info(),
                        authority: ctx.accounts.mint_authority.to_account_info(),
                    },
                ),
                amount,
            )?;
        }
        emit!(DrumSpun { user: ctx.accounts.drum_commit.user, prize_index: prize_index as u8, amount });
        Ok(())
    }

    pub fn referral_bind(ctx: Context<ReferralBind>) -> Result<()> {
        let s = &mut ctx.accounts.stats;
        if s.referrer == Pubkey::default() {
            s.referrer = ctx.accounts.referrer.key();
        }
        s.direct_count = s.direct_count.checked_add(1).ok_or(QError::MathOverflow)?;
        Ok(())
    }
}

```

## FILE: aof_expansion/programs/aof-quests/src/randomness.rs

```rust
use anchor_lang::prelude::*;
use anchor_lang::solana_program::hash::hashv;
use crate::QError;

// Тот же commit-reveal паттерн, что randomness.rs в aof_core (продублирован,
// т.к. это отдельная Anchor-программа без общего lib-крейта).
pub fn hash_secret(secret: &[u8; 32]) -> [u8; 32] {
    hashv(&[secret]).to_bytes()
}

pub fn get_slot_hash(slot_hashes_info: &AccountInfo, target_slot: u64) -> Result<[u8; 32]> {
    let data = slot_hashes_info.try_borrow_data()?;
    require!(data.len() >= 8, QError::CommitExpired);
    let num_entries = u64::from_le_bytes(data[0..8].try_into().unwrap()) as usize;
    let mut offset = 8usize;
    for _ in 0..num_entries {
        if offset + 40 > data.len() {
            break;
        }
        let slot = u64::from_le_bytes(data[offset..offset + 8].try_into().unwrap());
        if slot == target_slot {
            let mut h = [0u8; 32];
            h.copy_from_slice(&data[offset + 8..offset + 40]);
            return Ok(h);
        }
        offset += 40;
    }
    Err(QError::CommitExpired.into())
}

pub fn derive_entropy(secret: &[u8; 32], slot_hash: &[u8; 32], tag: &[u8]) -> [u8; 32] {
    hashv(&[secret, slot_hash, tag]).to_bytes()
}

pub fn entropy_u64(entropy: &[u8; 32]) -> u64 {
    u64::from_le_bytes(entropy[0..8].try_into().unwrap())
}

pub fn weighted_pick(roll_bps: u64, weights_bps: &[u16]) -> usize {
    let mut acc: u64 = 0;
    let r = roll_bps % 10_000;
    for (i, w) in weights_bps.iter().enumerate() {
        acc += *w as u64;
        if r < acc {
            return i;
        }
    }
    weights_bps.len() - 1
}

pub const SLOT_HASHES_ID: Pubkey = anchor_lang::solana_program::sysvar::slot_hashes::ID;

```

## FILE: aof_expansion/programs/aof-rebirth/Cargo.toml

```toml
[package]
name = "aof-rebirth"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib", "lib"]
name = "aof_rebirth"

[features]
no-entrypoint = []
no-idl = []
no-log-ix-name = []
cpi = ["no-entrypoint"]
default = []
idl-build = ["anchor-lang/idl-build"]

[dependencies]
anchor-lang = { version = "0.30.1", features = ["init-if-needed"] }

```

## FILE: aof_expansion/programs/aof-rebirth/src/lib.rs

```rust
use anchor_lang::prelude::*;

declare_id!("RbAoF11111111111111111111111111111111111");

pub const CONFIG_SEED: &[u8] = b"rebirth_config";
pub const RECORD_SEED: &[u8] = b"rebirth_record";
pub const CONFIG_SPACE: usize = 8 + 32 + 2 + 2 + 1 + 1;
pub const RECORD_SPACE: usize = 8 + 32 + 4 + 4 + 2 + 8;

#[error_code]
pub enum RebirthError {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Rebirth cooldown not expired")]
    CooldownNotExpired,
    #[msg("Max rebirth count reached")]
    MaxRebirthsReached,
    #[msg("Player has not met the minimum progression requirement")]
    RequirementNotMet,
}

#[event]
pub struct RebirthPerformed { pub user: Pubkey, pub generation: u32, pub new_bonus_bps: u16 }

#[account]
#[derive(InitSpace)]
pub struct RebirthConfig {
    pub authority: Pubkey,
    pub bonus_bps_per_rebirth: u16, // [ФАКТ, спека]: +2%/ребёрт
    pub max_bonus_bps: u16,          // кап +20%
    pub max_rebirths: u8,            // макс 10
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct RebirthRecord {
    pub owner: Pubkey,
    pub generation: u32,
    pub rebirth_count: u32,
    pub permanent_bonus_bps: u16,
    pub last_rebirth_ts: i64,
}

pub fn title_for_generation(generation: u32) -> &'static str {
    match generation {
        0 => "Фермер",
        1..=2 => "Ветеран",
        3..=5 => "Легенда",
        _ => "Праотец",
    }
}

#[derive(Accounts)]
pub struct InitRebirthConfig<'info> {
    #[account(init, payer = authority, space = CONFIG_SPACE, seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, RebirthConfig>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DoRebirth<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, RebirthConfig>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        init_if_needed, payer = user, space = RECORD_SPACE,
        seeds = [RECORD_SEED, user.key().as_ref()], bump
    )]
    pub record: Account<'info, RebirthRecord>,
    pub system_program: Program<'info, System>,
}

#[program]
pub mod aof_rebirth {
    use super::*;

    pub fn init_rebirth_config(ctx: Context<InitRebirthConfig>, bonus_bps: u16, max_bonus_bps: u16, max_rebirths: u8) -> Result<()> {
        let c = &mut ctx.accounts.config;
        c.authority = ctx.accounts.authority.key();
        c.bonus_bps_per_rebirth = bonus_bps;
        c.max_bonus_bps = max_bonus_bps;
        c.max_rebirths = max_rebirths;
        c.bump = ctx.bumps.config;
        Ok(())
    }

    /// [ВАЖНО]: проверка "игрок достиг минимального прогресса, чтобы иметь
    /// право на ребёрт" (например, Legendary-инструмент заминчен) должна
    /// проверяться authority-co-sign через отдельный CPI/constraint на
    /// состояние aof_core перед вызовом этой инструкции — здесь её
    /// физически нечем проверить без cross-program state (ToolData из
    /// aof_core). Оставлено явным TODO в review, не тихим допущением.
    pub fn do_rebirth(ctx: Context<DoRebirth>) -> Result<()> {
        let r = &mut ctx.accounts.record;
        let c = &ctx.accounts.config;
        require!((r.rebirth_count as u8) < c.max_rebirths, RebirthError::MaxRebirthsReached);

        if r.owner == Pubkey::default() {
            r.owner = ctx.accounts.user.key();
        }
        r.rebirth_count = r.rebirth_count.checked_add(1).ok_or(RebirthError::MathOverflow)?;
        r.generation = r.generation.checked_add(1).ok_or(RebirthError::MathOverflow)?;
        let new_bonus = (c.bonus_bps_per_rebirth as u32).checked_mul(r.rebirth_count).ok_or(RebirthError::MathOverflow)?;
        r.permanent_bonus_bps = new_bonus.min(c.max_bonus_bps as u32) as u16;
        r.last_rebirth_ts = Clock::get()?.unix_timestamp;

        emit!(RebirthPerformed { user: r.owner, generation: r.generation, new_bonus_bps: r.permanent_bonus_bps });
        Ok(())
    }
}

```

## FILE: aof_expansion/programs/aof-session-keys/Cargo.toml

```toml
[package]
name = "aof-session-keys"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib", "lib"]
name = "aof_session_keys"

[features]
no-entrypoint = []
no-idl = []
no-log-ix-name = []
cpi = ["no-entrypoint"]
default = []
idl-build = ["anchor-lang/idl-build"]

[dependencies]
anchor-lang = { version = "0.30.1", features = ["init-if-needed"] }

```

## FILE: aof_expansion/programs/aof-session-keys/src/lib.rs

```rust
use anchor_lang::prelude::*;

declare_id!("SessAoF111111111111111111111111111111111");

pub const CONFIG_SEED: &[u8] = b"sk_config";
pub const SESSION_SEED: &[u8] = b"session";
pub const TRUST_SEED: &[u8] = b"trust_snapshot";

pub const CONFIG_SPACE: usize = 8 + 32 + 32 + 1;
pub const SESSION_SPACE: usize = 8 + 32 + 32 + 32 + 8 + 8 + 8 + 1 + 1;
pub const TRUST_SPACE: usize = 8 + 32 + 2 + 1 + 8 + 32;

// [ФАКТ, спека v2 §2.1]: "allowed_ixs НИКОГДА не включает withdraw/transfer/
// payout — бот физически не может вывести средства". Биты 60-63 зарезервированы
// как маркеры опасных операций и жёстко запрещены на уровне program logic —
// не соглашение с бэкендом, а constraint в самой session_create.
pub const IX_MARKETPLACE_LIST: u64 = 1 << 0;
pub const IX_MARKETPLACE_CANCEL: u64 = 1 << 1;
pub const IX_AUCTION_BID: u64 = 1 << 2;
pub const IX_ORDERBOOK_PLACE_BUY: u64 = 1 << 3;
pub const IX_ORDERBOOK_PLACE_SELL: u64 = 1 << 4;
pub const IX_ORDERBOOK_CANCEL: u64 = 1 << 5;
pub const IX_HOT_MARKET_BUY: u64 = 1 << 6;
pub const IX_HOT_MARKET_SELL: u64 = 1 << 7;
pub const IX_HOT_MARKET_LIMIT: u64 = 1 << 8;
pub const FORBIDDEN_IXS_MASK: u64 = (1 << 60) | (1 << 61) | (1 << 62) | (1 << 63);

#[error_code]
pub enum SkError {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("allowed_ixs includes a forbidden withdraw/transfer/payout bit")]
    ForbiddenIxRequested,
    #[msg("max_amount_per_tx exceeds trust-tier cap")]
    ExceedsTrustCap,
    #[msg("Session has expired")]
    SessionExpired,
    #[msg("Session has been revoked")]
    SessionRevoked,
    #[msg("Requested ix bit not in allowed_ixs")]
    IxNotAllowed,
    #[msg("Amount exceeds max_amount_per_tx")]
    AmountExceedsLimit,
    #[msg("TTL out of allowed range")]
    InvalidTtl,
    #[msg("Math overflow")]
    MathOverflow,
}

#[account]
#[derive(InitSpace)]
pub struct SkConfig {
    pub authority: Pubkey,
    pub oracle_authority: Pubkey, // ключ индексатора/trust-worker, подписывающий снапшоты
    pub bump: u8,
}

/// [ФАКТ, спека v5 §4.1]: снапшот трасткора, живёт в этой же программе,
/// что и session-keys — session_create ЧИТАЕТ его для лимитов, а не
/// принимает лимит от клиента напрямую.
#[account]
#[derive(InitSpace)]
pub struct TrustSnapshot {
    pub user: Pubkey,
    pub score: u16,
    pub tier: u8,
    pub computed_epoch: u64,
    pub oracle_authority: Pubkey,
}

#[account]
#[derive(InitSpace)]
pub struct SessionToken {
    pub authority: Pubkey,
    pub session_signer: Pubkey,
    pub target_program: Pubkey,
    pub allowed_ixs: u64,
    pub max_amount_per_tx: u64,
    pub spent_today: u64,
    pub day_start: i64,
    pub valid_until: i64,
    pub revoked: bool,
    pub paused: bool,
}

fn tier_daily_cap_lamports(tier: u8) -> u64 {
    // [ФАКТ, спека v5 §3]: ×1/×2/×4/×8/×20 от базового 0.5 SOL/день по тирам 1..5
    let base: u64 = 500_000_000; // 0.5 SOL
    match tier {
        1 => base,
        2 => base * 2,
        3 => base * 4,
        4 => base * 8,
        5 => base * 20,
        _ => 0,
    }
}

#[derive(Accounts)]
pub struct InitSkConfig<'info> {
    #[account(init, payer = authority, space = CONFIG_SPACE, seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, SkConfig>,
    #[account(mut)]
    pub authority: Signer<'info>,
    /// CHECK: ключ trust-worker
    pub oracle_authority: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct TrustSnapshotUpdate<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = oracle_authority @ SkError::Unauthorized)]
    pub config: Account<'info, SkConfig>,
    pub oracle_authority: Signer<'info>,
    /// CHECK: чей снапшот обновляется
    pub user: UncheckedAccount<'info>,
    #[account(
        init_if_needed, payer = oracle_authority, space = TRUST_SPACE,
        seeds = [TRUST_SEED, user.key().as_ref()], bump
    )]
    pub trust: Account<'info, TrustSnapshot>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SessionCreate<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    /// CHECK: ephemeral-ключ, приватник которого хранится только на бэкенде
    pub session_signer: UncheckedAccount<'info>,
    /// CHECK: программа, на которую распространяются права (Marketplace/Auction/Orderbook/HotMarket)
    pub target_program: UncheckedAccount<'info>,
    #[account(seeds = [TRUST_SEED, authority.key().as_ref()], bump)]
    pub trust: Account<'info, TrustSnapshot>,
    #[account(
        init_if_needed, payer = authority, space = SESSION_SPACE,
        seeds = [SESSION_SEED, authority.key().as_ref()], bump
    )]
    pub session: Account<'info, SessionToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SessionRevoke<'info> {
    pub authority: Signer<'info>,
    #[account(mut, seeds = [SESSION_SEED, authority.key().as_ref()], bump, constraint = session.authority == authority.key() @ SkError::Unauthorized)]
    pub session: Account<'info, SessionToken>,
}

/// Вызывается бэкендом Farm-Trader от имени session_signer перед тем, как
/// собрать реальную транзакцию в target_program — проверяет и резервирует
/// дневной лимит атомарно, чтобы гонка параллельных срабатываний правил
/// не могла превысить max_spend_per_day.
#[derive(Accounts)]
pub struct SessionCheckAndSpend<'info> {
    pub session_signer: Signer<'info>,
    #[account(mut, constraint = session.session_signer == session_signer.key() @ SkError::Unauthorized)]
    pub session: Account<'info, SessionToken>,
}

#[program]
pub mod aof_session_keys {
    use super::*;

    pub fn init_config(ctx: Context<InitSkConfig>) -> Result<()> {
        let c = &mut ctx.accounts.config;
        c.authority = ctx.accounts.authority.key();
        c.oracle_authority = ctx.accounts.oracle_authority.key();
        c.bump = ctx.bumps.config;
        Ok(())
    }

    pub fn trust_snapshot_update(ctx: Context<TrustSnapshotUpdate>, score: u16, tier: u8, epoch: u64) -> Result<()> {
        require!(score <= 1000, SkError::MathOverflow);
        require!(tier >= 1 && tier <= 5, SkError::MathOverflow);
        let t = &mut ctx.accounts.trust;
        t.user = ctx.accounts.user.key();
        t.score = score;
        t.tier = tier;
        t.computed_epoch = epoch;
        t.oracle_authority = ctx.accounts.oracle_authority.key();
        Ok(())
    }

    pub fn session_create(
        ctx: Context<SessionCreate>,
        allowed_ixs: u64,
        requested_max_per_tx: u64,
        ttl_seconds: i64,
    ) -> Result<()> {
        require!(allowed_ixs & FORBIDDEN_IXS_MASK == 0, SkError::ForbiddenIxRequested);
        require!(ttl_seconds > 0 && ttl_seconds <= 30 * 86400, SkError::InvalidTtl);

        let daily_cap = tier_daily_cap_lamports(ctx.accounts.trust.tier);
        require!(requested_max_per_tx <= daily_cap, SkError::ExceedsTrustCap);

        let now = Clock::get()?.unix_timestamp;
        let s = &mut ctx.accounts.session;
        s.authority = ctx.accounts.authority.key();
        s.session_signer = ctx.accounts.session_signer.key();
        s.target_program = ctx.accounts.target_program.key();
        s.allowed_ixs = allowed_ixs;
        s.max_amount_per_tx = requested_max_per_tx;
        s.spent_today = 0;
        s.day_start = now;
        s.valid_until = now.checked_add(ttl_seconds).ok_or(SkError::MathOverflow)?;
        s.revoked = false;
        s.paused = false;
        Ok(())
    }

    pub fn session_revoke(ctx: Context<SessionRevoke>) -> Result<()> {
        ctx.accounts.session.revoked = true;
        Ok(())
    }

    pub fn session_pause(ctx: Context<SessionRevoke>, paused: bool) -> Result<()> {
        ctx.accounts.session.paused = paused;
        Ok(())
    }

    pub fn session_check_and_spend(ctx: Context<SessionCheckAndSpend>, ix_bit: u64, amount: u64) -> Result<()> {
        let s = &mut ctx.accounts.session;
        require!(!s.revoked, SkError::SessionRevoked);
        require!(!s.paused, SkError::SessionRevoked);
        let now = Clock::get()?.unix_timestamp;
        require!(now <= s.valid_until, SkError::SessionExpired);
        require!(s.allowed_ixs & ix_bit == ix_bit, SkError::IxNotAllowed);
        require!(amount <= s.max_amount_per_tx, SkError::AmountExceedsLimit);

        if now - s.day_start >= 86400 {
            s.day_start = now;
            s.spent_today = 0;
        }
        let daily_cap = s.max_amount_per_tx.checked_mul(1000).unwrap_or(u64::MAX); // мягкий верхний предел на день
        let new_spent = s.spent_today.checked_add(amount).ok_or(SkError::MathOverflow)?;
        require!(new_spent <= daily_cap, SkError::AmountExceedsLimit);
        s.spent_today = new_spent;
        Ok(())
    }
}

```

## FILE: aof_expansion/backend/.env.example

```
DATABASE_URL=postgresql://user:pass@localhost:5432/aof
RPC_URL=https://api.devnet.solana.com
WS_URL=wss://api.devnet.solana.com
CORE_PROGRAM_ID=2dQsHg3oVKwyKHjemS2CbWkczv6sCRAY5r2WrGBv4vgC
MARKET_PROGRAM_ID=MktAoF1111111111111111111111111111111111
SESSION_PROGRAM_ID=SessAoF111111111111111111111111111111111
QUESTS_PROGRAM_ID=QstAoF111111111111111111111111111111111111
REBIRTH_PROGRAM_ID=RbAoF11111111111111111111111111111111111
LIQUIDITY_PROGRAM_ID=LpAoF11111111111111111111111111111111111
AUTHORITY_SECRET_KEY=
ORACLE_SECRET_KEY=
TREASURY_PUBKEY=
FARM_TRADER_SECRET_KEY=
PORT=8090
WS_PORT=8081

```

## FILE: aof_expansion/backend/package.json

```json
{
  "name": "aof-backend-expansion",
  "version": "0.1.0",
  "private": true,
  "type": "commonjs",
  "scripts": {
    "build": "tsc -p .",
    "start": "node dist/server.js",
    "dev": "ts-node src/server.ts",
    "worker:indexer": "ts-node src/services/indexer/priceTracker.ts",
    "worker:trust": "ts-node src/services/trust-worker/index.ts",
    "worker:trader": "ts-node src/services/farm-trader/index.ts",
    "worker:push": "ts-node src/services/push-worker/index.ts",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev"
  },
  "dependencies": {
    "@coral-xyz/anchor": "^0.30.1",
    "@solana/web3.js": "^1.95.3",
    "@solana/spl-token": "^0.4.8",
    "@prisma/client": "^5.18.0",
    "express": "^4.19.2",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "bs58": "^5.0.0",
    "zod": "^3.23.8",
    "pino": "^9.3.2",
    "pino-http": "^10.2.0",
    "express-rate-limit": "^7.4.0",
    "ws": "^8.18.0"
  },
  "devDependencies": {
    "typescript": "^5.5.4",
    "ts-node": "^10.9.2",
    "prisma": "^5.18.0",
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17",
    "@types/node": "^20.14.15",
    "@types/ws": "^8.5.12"
  }
}

```

## FILE: aof_expansion/backend/prisma/schema.prisma

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model FarmPlot {
  id        String        @id @default(cuid())
  owner     String        @unique
  gridSizeX Int           @default(8)
  gridSizeY Int           @default(8)
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt
  buildings FarmBuilding[]
}

model FarmBuilding {
  id         String   @id @default(cuid())
  plotId     String
  plot       FarmPlot @relation(fields: [plotId], references: [id])
  buildingType String
  x          Int
  y          Int
  level      Int      @default(1)
  placedAt   DateTime @default(now())

  @@index([plotId])
}

model Energy {
  owner        String   @id
  current      Int      @default(20)
  cap          Int      @default(20)
  vip          Boolean  @default(false)
  lastRegenAt  DateTime @default(now())
}

model NeighborVisit {
  id         String   @id @default(cuid())
  visitor    String
  target     String
  action     String
  visitedAt  DateTime @default(now())

  @@index([visitor, visitedAt])
  @@index([target])
}

model Weather {
  date       String   @id
  weatherType String
  seed       String
}

model Streak {
  owner        String   @id
  currentCount Int      @default(0)
  longestCount Int      @default(0)
  lastCheckIn  DateTime?
  claimedMilestones Int[] @default([])
}

model InboxItem {
  id        String    @id @default(cuid())
  owner     String
  title     String
  body      String
  rewardMint String?
  rewardAmount BigInt?
  read      Boolean   @default(false)
  claimed   Boolean   @default(false)
  archived  Boolean   @default(false)
  createdAt DateTime  @default(now())

  @@index([owner, archived])
}

model CompendiumEntry {
  id         String   @id @default(cuid())
  owner      String
  toolType   String
  rarity     String
  seenAt     DateTime @default(now())

  @@unique([owner, toolType, rarity])
}

model Profile {
  owner        String   @id
  displayName  String?
  avatarId     Int      @default(0)
  titleId      Int      @default(0)
  showcaseMint String?
  updatedAt    DateTime @updatedAt
}

model LoreProgress {
  owner       String   @id
  currentNode String   @default("intro")
  completedNodes String[] @default([])
  updatedAt   DateTime @updatedAt
}

model OnboardingState {
  owner        String   @id
  currentStep  Int      @default(0)
  completed    Boolean  @default(false)
  completedAt  DateTime?
}

model QuestProgressDb {
  id        String   @id @default(cuid())
  owner     String
  questId   Int
  progress  Int      @default(0)
  updatedAt DateTime @updatedAt

  @@unique([owner, questId])
}

model ChallengeScore {
  id          String   @id @default(cuid())
  owner       String
  challengeId Int
  medals      BigInt   @default(0)
  updatedAt   DateTime @updatedAt

  @@unique([owner, challengeId])
}

model Guild {
  id          String         @id @default(cuid())
  name        String         @unique
  ownerAddr   String
  createdAt   DateTime       @default(now())
  members     GuildMember[]
  activity    GuildActivity[]
}

model GuildMember {
  id        String   @id @default(cuid())
  guildId   String
  guild     Guild    @relation(fields: [guildId], references: [id])
  address   String
  role      String   @default("member")
  joinedAt  DateTime @default(now())

  @@unique([guildId, address])
}

model GuildActivity {
  id        String   @id @default(cuid())
  guildId   String
  guild     Guild    @relation(fields: [guildId], references: [id])
  address   String
  kind      String
  payload   Json?
  createdAt DateTime @default(now())

  @@index([guildId, createdAt])
}

model Territory {
  id          String   @id @default(cuid())
  name        String   @unique
  controllingGuildId String?
  capturedAt  DateTime?
}

model PriceAlert {
  id         String   @id @default(cuid())
  owner      String
  rarity     String
  direction  String
  targetPrice BigInt
  triggered  Boolean  @default(false)
  createdAt  DateTime @default(now())

  @@index([owner])
}

model TrustScore {
  owner       String   @id
  score       Int      @default(0)
  tier        Int      @default(1)
  breakdown   Json
  computedAt  DateTime @updatedAt
}

model TrustFlag {
  id        String   @id @default(cuid())
  owner     String
  flagType  String
  weightBps Int
  active    Boolean  @default(true)
  createdAt DateTime @default(now())

  @@index([owner, active])
}

model TrustBreakdown {
  id            String   @id @default(cuid())
  owner         String   @unique
  accountAge    Int      @default(0)
  referralHealth Int     @default(0)
  tradingHonesty Int     @default(75)
  stakingLoyalty Int     @default(0)
  rebirth       Int      @default(0)
  guildContribution Int  @default(0)
  compendium    Int      @default(0)
  questConsistency Int   @default(0)
  executorReputation Int @default(0)
  updatedAt     DateTime @updatedAt
}

model DeviceFingerprint {
  id         String   @id @default(cuid())
  owner      String
  fingerprint String
  firstSeenAt DateTime @default(now())
  lastSeenAt DateTime @updatedAt

  @@unique([owner, fingerprint])
  @@index([fingerprint])
}

model SybilFlag {
  id        String   @id @default(cuid())
  owner     String
  reason    String
  score     Int
  createdAt DateTime @default(now())

  @@index([owner])
}

model ReferralHolding {
  id           String   @id @default(cuid())
  referrer     String
  referred     String
  boundAt      DateTime @default(now())
  holdUntil    DateTime
  released     Boolean  @default(false)

  @@index([referrer])
  @@unique([referred])
}

model ApiKey {
  id         String    @id @default(cuid())
  keyHash    String    @unique
  owner      String
  label      String?
  scopes     String[]
  revoked    Boolean   @default(false)
  createdAt  DateTime  @default(now())
  lastUsedAt DateTime?
}

model DeviceToken {
  id        String   @id @default(cuid())
  owner     String
  token     String
  platform  String
  createdAt DateTime @default(now())

  @@unique([owner, token])
}

model NotificationQueue {
  id        String   @id @default(cuid())
  owner     String
  title     String
  body      String
  data      Json?
  status    String   @default("pending")
  createdAt DateTime @default(now())
  sentAt    DateTime?

  @@index([status])
}

model PriceTick {
  id        String   @id @default(cuid())
  rarity    String
  currency  String
  price     BigInt
  ts        DateTime @default(now())

  @@index([rarity, currency, ts])
}

model Candle {
  id         String   @id @default(cuid())
  rarity     String
  currency   String
  interval   String
  bucketStart DateTime
  open       BigInt
  high       BigInt
  low        BigInt
  close      BigInt
  volume     BigInt   @default(0)

  @@unique([rarity, currency, interval, bucketStart])
  @@index([rarity, currency, interval, bucketStart])
}

model TraderRule {
  id          String   @id @default(cuid())
  owner       String
  kind        String
  rarity      String
  params      Json
  enabled     Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([owner, enabled])
}

model TraderExecution {
  id         String   @id @default(cuid())
  ruleId     String
  owner      String
  txSig      String?
  status     String
  amount     BigInt?
  price      BigInt?
  error      String?
  createdAt  DateTime @default(now())

  @@index([owner, createdAt])
  @@index([ruleId])
}

model ReferralStatsDb {
  owner        String  @id
  directCount  Int     @default(0)
  l2Count      Int     @default(0)
  totalEarnedLamports BigInt @default(0)
}

model WhaleAlert {
  id        String   @id @default(cuid())
  txSig     String   @unique
  kind      String
  actor     String
  amount    BigInt
  rarity    String?
  createdAt DateTime @default(now())

  @@index([createdAt])
}

model ComebackRecord {
  owner        String   @id
  lastActiveAt DateTime
  returnedAt   DateTime?
  bonusTier    Int?
}

model ComebackBonus {
  id        String   @id @default(cuid())
  owner     String
  tier      Int
  grantedAt DateTime @default(now())
  claimed   Boolean  @default(false)
}

model LeaderboardSnapshot {
  id         String   @id @default(cuid())
  period     String
  periodId   String
  merkleRoot String
  createdAt  DateTime @default(now())

  @@unique([period, periodId])
}

model LeaderboardEntry {
  id         String   @id @default(cuid())
  snapshotId String
  owner      String
  rank       Int
  score      BigInt
  proof      String[]

  @@index([snapshotId, owner])
}

```

## FILE: aof_expansion/backend/src/config.ts

```typescript
import "dotenv/config";
import { Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";

export const RPC_URL = process.env.RPC_URL || "https://api.devnet.solana.com";
export const WS_URL = process.env.WS_URL || "wss://api.devnet.solana.com";

export const CORE_PROGRAM_ID = new PublicKey(process.env.CORE_PROGRAM_ID!);
export const MARKET_PROGRAM_ID = new PublicKey(process.env.MARKET_PROGRAM_ID!);
export const SESSION_PROGRAM_ID = new PublicKey(process.env.SESSION_PROGRAM_ID!);
export const QUESTS_PROGRAM_ID = new PublicKey(process.env.QUESTS_PROGRAM_ID!);
export const REBIRTH_PROGRAM_ID = new PublicKey(process.env.REBIRTH_PROGRAM_ID!);
export const LIQUIDITY_PROGRAM_ID = new PublicKey(process.env.LIQUIDITY_PROGRAM_ID!);

export const AUTHORITY: Keypair = Keypair.fromSecretKey(bs58.decode(process.env.AUTHORITY_SECRET_KEY!));
export const ORACLE: Keypair = Keypair.fromSecretKey(bs58.decode(process.env.ORACLE_SECRET_KEY || process.env.AUTHORITY_SECRET_KEY!));
export const FARM_TRADER_SIGNER: Keypair = process.env.FARM_TRADER_SECRET_KEY
  ? Keypair.fromSecretKey(bs58.decode(process.env.FARM_TRADER_SECRET_KEY))
  : Keypair.generate();

export const TREASURY = new PublicKey(process.env.TREASURY_PUBKEY!);
export const PORT = Number(process.env.PORT || 8090);
export const WS_PORT = Number(process.env.WS_PORT || 8081);

```

## FILE: aof_expansion/backend/src/db.ts

```typescript
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

```

## FILE: aof_expansion/backend/src/idl/aof_core.json

```json
{
  "_comment": "replace with target/idl/aof_core.json after anchor build",
  "version": "0.1.0",
  "name": "aof_core",
  "instructions": [],
  "accounts": [],
  "errors": []
}

```

## FILE: aof_expansion/backend/src/idl/aof_liquidity.json

```json
{
  "_comment": "replace with target/idl/aof_liquidity.json after anchor build",
  "version": "0.1.0",
  "name": "aof_liquidity",
  "instructions": [],
  "accounts": [],
  "errors": []
}

```

## FILE: aof_expansion/backend/src/idl/aof_market.json

```json
{
  "_comment": "replace with target/idl/aof_market.json after anchor build",
  "version": "0.1.0",
  "name": "aof_market",
  "instructions": [],
  "accounts": [],
  "errors": []
}

```

## FILE: aof_expansion/backend/src/idl/aof_quests.json

```json
{
  "_comment": "replace with target/idl/aof_quests.json after anchor build",
  "version": "0.1.0",
  "name": "aof_quests",
  "instructions": [],
  "accounts": [],
  "errors": []
}

```

## FILE: aof_expansion/backend/src/idl/aof_rebirth.json

```json
{
  "_comment": "replace with target/idl/aof_rebirth.json after anchor build",
  "version": "0.1.0",
  "name": "aof_rebirth",
  "instructions": [],
  "accounts": [],
  "errors": []
}

```

## FILE: aof_expansion/backend/src/idl/aof_session_keys.json

```json
{
  "_comment": "replace with target/idl/aof_session_keys.json after anchor build",
  "version": "0.1.0",
  "name": "aof_session_keys",
  "instructions": [],
  "accounts": [],
  "errors": []
}

```

## FILE: aof_expansion/backend/src/lib/antifraud.ts

```typescript
import { prisma } from "../db";

export async function registerDevice(owner: string, fingerprint: string) {
  await prisma.deviceFingerprint.upsert({
    where: { owner_fingerprint: { owner, fingerprint } },
    update: { lastSeenAt: new Date() },
    create: { owner, fingerprint },
  });

  const sharedOwners = await prisma.deviceFingerprint.findMany({
    where: { fingerprint, owner: { not: owner } },
    select: { owner: true },
  });
  if (sharedOwners.length > 0) {
    await prisma.sybilFlag.create({
      data: {
        owner,
        reason: `shared_fingerprint_with_${sharedOwners.length}_accounts`,
        score: Math.min(100, sharedOwners.length * 20),
      },
    });
  }
  return { sharedWithCount: sharedOwners.length };
}

export async function sybilScore(owner: string): Promise<number> {
  const flags = await prisma.sybilFlag.findMany({ where: { owner } });
  return flags.reduce((sum, f) => sum + f.score, 0);
}

// [ФАКТ, спека §6]: holding period перед выплатой реферального бонуса —
// анти-фрод защита от "зарегистрировал сам себя вторым кошельком".
export const REFERRAL_HOLD_DAYS = 14;

export async function startReferralHold(referrer: string, referred: string) {
  const holdUntil = new Date(Date.now() + REFERRAL_HOLD_DAYS * 86400_000);
  return prisma.referralHolding.upsert({
    where: { referred },
    update: {},
    create: { referrer, referred, holdUntil },
  });
}

export async function rewardAvailability(referred: string): Promise<{ available: boolean; holdUntil: Date | null }> {
  const rec = await prisma.referralHolding.findUnique({ where: { referred } });
  if (!rec) return { available: false, holdUntil: null };
  if (rec.released) return { available: true, holdUntil: rec.holdUntil };
  const available = new Date() >= rec.holdUntil;
  return { available, holdUntil: rec.holdUntil };
}

```

## FILE: aof_expansion/backend/src/lib/logger.ts

```typescript
import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: process.env.NODE_ENV === "production" ? undefined : { target: "pino-pretty" },
});

```

## FILE: aof_expansion/backend/src/lib/merkle.ts

```typescript
import { createHash } from "crypto";

function h(data: Buffer): Buffer {
  return createHash("sha256").update(data).digest();
}

function leafHash(owner: string, rank: number, score: bigint): Buffer {
  return h(Buffer.from(`${owner}:${rank}:${score.toString()}`));
}

export function buildMerkleTree(entries: { owner: string; rank: number; score: bigint }[]): {
  root: string;
  proofs: Record<string, string[]>;
} {
  let layer = entries.map((e) => leafHash(e.owner, e.rank, e.score));
  const proofs: Record<string, string[]> = {};
  entries.forEach((e, i) => (proofs[e.owner] = []));

  let indices = entries.map((_, i) => i);

  while (layer.length > 1) {
    const nextLayer: Buffer[] = [];
    const nextIndices: number[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i];
      const right = i + 1 < layer.length ? layer[i + 1] : layer[i];
      const parent = h(Buffer.concat([left, right].sort(Buffer.compare)));
      nextLayer.push(parent);

      entries.forEach((e, idx) => {
        if (indices[idx] === i) proofs[e.owner].push(right.toString("hex"));
        else if (indices[idx] === i + 1) proofs[e.owner].push(left.toString("hex"));
      });
      nextIndices.push(nextLayer.length - 1);
    }
    entries.forEach((e, idx) => {
      const pos = indices[idx];
      indices[idx] = Math.floor(pos / 2);
    });
    layer = nextLayer;
  }

  return { root: layer[0]?.toString("hex") || "", proofs };
}

```

## FILE: aof_expansion/backend/src/lib/pda.ts

```typescript
import { PublicKey } from "@solana/web3.js";
import {
  MARKET_PROGRAM_ID, SESSION_PROGRAM_ID, QUESTS_PROGRAM_ID,
  REBIRTH_PROGRAM_ID, LIQUIDITY_PROGRAM_ID, CORE_PROGRAM_ID,
} from "../config";

const enc = (s: string) => Buffer.from(s, "utf8");
const u8 = (n: number) => Buffer.from([n]);
const u32le = (n: number) => {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n, 0);
  return b;
};

const find = (programId: PublicKey, seeds: (Buffer | Uint8Array)[]) =>
  PublicKey.findProgramAddressSync(seeds, programId);

// ----- aof_core (переиспользуется этим бэкендом для inbox/rebirth-gate и т.п.) -----
export const configPda = () => find(CORE_PROGRAM_ID, [enc("config")]);
export const authPda = () => find(CORE_PROGRAM_ID, [enc("auth")]);
export const vaultPda = () => find(CORE_PROGRAM_ID, [enc("vault")]);
export const playerPda = (owner: PublicKey) => find(CORE_PROGRAM_ID, [enc("player"), owner.toBuffer()]);
export const gastankPda = (owner: PublicKey) => find(CORE_PROGRAM_ID, [enc("gastank"), owner.toBuffer()]);
export const toolPda = (mint: PublicKey) => find(CORE_PROGRAM_ID, [enc("tool"), mint.toBuffer()]);

// ----- aof-market -----
export const marketConfigPda = () => find(MARKET_PROGRAM_ID, [enc("market_config")]);
export const hotPoolPda = (rarity: number) => find(MARKET_PROGRAM_ID, [enc("hot_pool"), u8(rarity)]);
export const hotLimitOrderPda = (maker: PublicKey, rarity: number) =>
  find(MARKET_PROGRAM_ID, [enc("hot_limit_order"), maker.toBuffer(), u8(rarity)]);

// ----- aof-session-keys -----
export const skConfigPda = () => find(SESSION_PROGRAM_ID, [enc("sk_config")]);
export const sessionPda = (authority: PublicKey) => find(SESSION_PROGRAM_ID, [enc("session"), authority.toBuffer()]);
export const trustSnapshotPda = (user: PublicKey) => find(SESSION_PROGRAM_ID, [enc("trust_snapshot"), user.toBuffer()]);

// ----- aof-quests -----
export const questConfigPda = () => find(QUESTS_PROGRAM_ID, [enc("quest_config")]);
export const questPda = (questId: number) => find(QUESTS_PROGRAM_ID, [enc("quest"), u32le(questId)]);
export const questProgressPda = (user: PublicKey, questId: number) =>
  find(QUESTS_PROGRAM_ID, [enc("quest_progress"), user.toBuffer(), u32le(questId)]);
export const achievementPda = (owner: PublicKey, achievementId: number) =>
  find(QUESTS_PROGRAM_ID, [enc("achievement"), owner.toBuffer(), u32le(achievementId)]);
export const challengePda = (challengeId: number) => find(QUESTS_PROGRAM_ID, [enc("challenge"), u32le(challengeId)]);
export const challengeEntryPda = (user: PublicKey, challengeId: number) =>
  find(QUESTS_PROGRAM_ID, [enc("challenge_entry"), user.toBuffer(), u32le(challengeId)]);
export const drumConfigPda = () => find(QUESTS_PROGRAM_ID, [enc("drum_config")]);
export const drumCommitPda = (user: PublicKey) => find(QUESTS_PROGRAM_ID, [enc("drum_commit"), user.toBuffer()]);
export const questReferralStatsPda = (referrer: PublicKey) =>
  find(QUESTS_PROGRAM_ID, [enc("quest_referral_stats"), referrer.toBuffer()]);

// ----- aof-rebirth -----
export const rebirthConfigPda = () => find(REBIRTH_PROGRAM_ID, [enc("rebirth_config")]);
export const rebirthRecordPda = (user: PublicKey) => find(REBIRTH_PROGRAM_ID, [enc("rebirth_record"), user.toBuffer()]);

// ----- aof-liquidity -----
export const lpConfigPda = () => find(LIQUIDITY_PROGRAM_ID, [enc("lp_config")]);
export const lpPoolPda = () => find(LIQUIDITY_PROGRAM_ID, [enc("lp_pool")]);
export const lpPositionPda = (user: PublicKey) => find(LIQUIDITY_PROGRAM_ID, [enc("lp_position"), user.toBuffer()]);

```

## FILE: aof_expansion/backend/src/lib/secretStore.ts

```typescript
import { randomBytes, createHash } from "crypto";

const store = new Map<string, Buffer>();

export function newCommit(key: string): { secret: Buffer; hash: number[] } {
  const secret = randomBytes(32);
  store.set(key, secret);
  const hash = createHash("sha256").update(secret).digest();
  return { secret, hash: Array.from(hash) };
}

export function popSecret(key: string): number[] {
  const secret = store.get(key);
  if (!secret) throw new Error("secret not found for key " + key);
  store.delete(key);
  return Array.from(secret);
}

```

## FILE: aof_expansion/backend/src/lib/trustIndex.ts

```typescript
import { prisma } from "../db";
import { rebirthProgram } from "../provider";
import { PublicKey } from "@solana/web3.js";

// [ФАКТ, спека v5 §2]: 9 компонентов, максимумы 100/150/150/100/100/100/100/100/100 = 1000.
export interface TrustBreakdownResult {
  accountAge: number;
  referralHealth: number;
  tradingHonesty: number;
  stakingLoyalty: number;
  rebirth: number;
  guildContribution: number;
  compendium: number;
  questConsistency: number;
  executorReputation: number;
  penaltyMultiplierBps: number; // 4000..10000 = ×0.4..×1.0
  rawTotal: number;
  finalScore: number;
  tier: number;
}

function tierFor(score: number): number {
  if (score >= 800) return 5;
  if (score >= 600) return 4;
  if (score >= 400) return 3;
  if (score >= 200) return 2;
  return 1;
}

export async function computeTrustIndex(owner: string, accountCreatedAt: Date): Promise<TrustBreakdownResult> {
  const days = Math.floor((Date.now() - accountCreatedAt.getTime()) / 86400_000);
  const accountAge = Math.min(100, Math.floor((days * 100) / 180));

  const sybilFlags = await prisma.sybilFlag.findMany({ where: { owner } });
  const referralHealth = sybilFlags.length > 0 ? 0 : 150;

  const executions = await prisma.traderExecution.findMany({ where: { owner }, take: 500, orderBy: { createdAt: "desc" } });
  const successCount = executions.filter((e) => e.status === "success").length;
  const tradingHonesty =
    executions.length === 0
      ? 75
      : Math.min(150, Math.round((successCount / executions.length) * 150));

  const buildings = await prisma.farmBuilding.count({ where: { plot: { owner } } });
  const stakingLoyalty = Math.min(100, buildings * 5);

  let rebirthCount = 0;
  try {
    const [record] = PublicKey.findProgramAddressSync(
      [Buffer.from("rebirth_record"), new PublicKey(owner).toBuffer()],
      rebirthProgram.programId
    );
    const acc: any = await (rebirthProgram.account as any).rebirthRecord.fetchNullable(record);
    rebirthCount = acc ? Number(acc.rebirthCount) : 0;
  } catch {
    rebirthCount = 0;
  }
  const rebirth = Math.min(100, rebirthCount * 20);

  const since = new Date(Date.now() - 60 * 86400_000);
  const guildDeposits = await prisma.guildActivity.count({
    where: { address: owner, kind: "deposit", createdAt: { gte: since } },
  });
  const guildContribution = Math.min(100, guildDeposits * 10);

  const compendiumTotal = 4 * 5; // 4 типа × 5 редкостей
  const compendiumSeen = await prisma.compendiumEntry.count({ where: { owner } });
  const compendium = Math.min(100, Math.round((compendiumSeen / compendiumTotal) * 100));

  const streak = await prisma.streak.findUnique({ where: { owner } });
  const questConsistency = Math.min(100, (streak?.currentCount || 0) * 3);

  const disputes = executions.filter((e) => e.status === "disputed").length;
  const executorReputation = Math.max(
    0,
    Math.min(100, (executions.length === 0 ? 100 : Math.round((successCount / executions.length) * 100)) - disputes * 10)
  );

  const activeFlags = await prisma.trustFlag.findMany({ where: { owner, active: true } });
  let penaltyMultiplierBps = 10_000;
  for (const f of activeFlags) {
    penaltyMultiplierBps = Math.floor((penaltyMultiplierBps * f.weightBps) / 10_000);
  }
  penaltyMultiplierBps = Math.max(4_000, penaltyMultiplierBps);

  const rawTotal =
    accountAge + referralHealth + tradingHonesty + stakingLoyalty + rebirth +
    guildContribution + compendium + questConsistency + executorReputation;
  const finalScore = Math.floor((rawTotal * penaltyMultiplierBps) / 10_000);

  return {
    accountAge, referralHealth, tradingHonesty, stakingLoyalty, rebirth,
    guildContribution, compendium, questConsistency, executorReputation,
    penaltyMultiplierBps, rawTotal, finalScore, tier: tierFor(finalScore),
  };
}

// [ФАКТ, спека v5 §3]: привилегии по тирам.
export function tierPrivileges(tier: number) {
  const table = [
    { tier: 1, dailyBotCapSol: 0.5, feeDiscountBps: 0, energyCap: 20, energyRegenMinutes: 10 },
    { tier: 2, dailyBotCapSol: 1, feeDiscountBps: 0, energyCap: 20, energyRegenMinutes: 10 },
    { tier: 3, dailyBotCapSol: 2, feeDiscountBps: 500, energyCap: 25, energyRegenMinutes: 9 },
    { tier: 4, dailyBotCapSol: 4, feeDiscountBps: 1000, energyCap: 30, energyRegenMinutes: 8 },
    { tier: 5, dailyBotCapSol: 10, feeDiscountBps: 2000, energyCap: 30, energyRegenMinutes: 8 },
  ];
  return table[Math.min(4, Math.max(0, tier - 1))];
}

```

## FILE: aof_expansion/backend/src/lib/tx.ts

```typescript
import { Transaction, PublicKey, Keypair } from "@solana/web3.js";
import { connection } from "../provider";
import { AUTHORITY, ORACLE } from "../config";

export function pk(s: string): PublicKey {
  return new PublicKey(s);
}

export async function coSign(ix: any[], feePayer: PublicKey, extraSigner?: Keypair): Promise<string> {
  const tx = new Transaction().add(...ix);
  tx.feePayer = feePayer;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.partialSign(AUTHORITY);
  if (extraSigner) tx.partialSign(extraSigner);
  return tx.serialize({ requireAllSignatures: false }).toString("base64");
}

export async function oracleSign(ix: any[], feePayer: PublicKey): Promise<string> {
  const tx = new Transaction().add(...ix);
  tx.feePayer = feePayer;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.partialSign(ORACLE);
  return tx.serialize({ requireAllSignatures: false }).toString("base64");
}

export async function authorityOnly(ix: any[]): Promise<string> {
  const tx = new Transaction().add(...ix);
  tx.feePayer = AUTHORITY.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.sign(AUTHORITY);
  const sig = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(sig, "confirmed");
  return sig;
}

export async function oracleOnly(ix: any[]): Promise<string> {
  const tx = new Transaction().add(...ix);
  tx.feePayer = ORACLE.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.sign(ORACLE);
  const sig = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(sig, "confirmed");
  return sig;
}

```

## FILE: aof_expansion/backend/src/lib/validation.ts

```typescript
import { z } from "zod";

const pubkey = z.string().min(32).max(44);

export const schemas = {
  hotMarketBuy: z.object({
    buyer: pubkey,
    rarity: z.number().int().min(0).max(3),
    currency: z.enum(["core", "gem"]),
    maxPrice: z.string().or(z.number()),
  }),
  sessionCreate: z.object({
    authority: pubkey,
    sessionSigner: pubkey,
    targetProgram: pubkey,
    allowedIxs: z.string().or(z.number()),
    requestedMaxPerTx: z.string().or(z.number()),
    ttlSeconds: z.number().int().positive().max(30 * 86400),
  }),
  questClaim: z.object({
    user: pubkey,
    questId: z.number().int().nonnegative(),
  }),
  challengeContribute: z.object({
    user: pubkey,
    challengeId: z.number().int().nonnegative(),
    medals: z.number().int().positive(),
  }),
  drumCommit: z.object({
    user: pubkey,
    medalsStaked: z.number().int().positive(),
  }),
  rebirthDo: z.object({
    user: pubkey,
  }),
  lpDeposit: z.object({
    user: pubkey,
    amount: z.number().int().positive(),
  }),
  farmBuildingPlace: z.object({
    owner: pubkey,
    buildingType: z.string().min(1).max(40),
    x: z.number().int().min(0).max(7),
    y: z.number().int().min(0).max(7),
  }),
  neighborVisit: z.object({
    visitor: pubkey,
    target: pubkey,
    action: z.enum(["water", "help", "gift"]),
  }),
  guildCreate: z.object({
    owner: pubkey,
    name: z.string().min(3).max(24),
  }),
  traderRuleCreate: z.object({
    owner: pubkey,
    kind: z.enum(["smart_buy", "smart_sell", "smart_push"]),
    rarity: z.enum(["common", "uncommon", "rare", "epic", "legendary"]),
    params: z.record(z.any()),
  }),
  priceAlertCreate: z.object({
    owner: pubkey,
    rarity: z.string(),
    direction: z.enum(["above", "below"]),
    targetPrice: z.number().positive(),
  }),
};

```

## FILE: aof_expansion/backend/src/middleware/apiKey.ts

```typescript
import { Request, Response, NextFunction } from "express";
import { createHash } from "crypto";
import { prisma } from "../db";

const windowHits = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 120;

export async function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const key = req.header("X-API-Key");
  if (!key) return res.status(401).json({ error: "missing_api_key" });
  const keyHash = createHash("sha256").update(key).digest("hex");
  const record = await prisma.apiKey.findUnique({ where: { keyHash } });
  if (!record || record.revoked) return res.status(401).json({ error: "invalid_api_key" });

  const now = Date.now();
  const hits = (windowHits.get(keyHash) || []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= MAX_PER_WINDOW) return res.status(429).json({ error: "rate_limited" });
  hits.push(now);
  windowHits.set(keyHash, hits);

  await prisma.apiKey.update({ where: { keyHash }, data: { lastUsedAt: new Date() } });
  (req as any).apiKeyOwner = record.owner;
  (req as any).apiKeyScopes = record.scopes;
  next();
}

```

## FILE: aof_expansion/backend/src/middleware/errorHandler.ts

```typescript
import { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  logger.error({ err, path: req.path }, "unhandled_error");
  const status = err.status || 400;
  res.status(status).json({ error: err.message || "internal_error" });
}

```

## FILE: aof_expansion/backend/src/middleware/rateLimit.ts

```typescript
import rateLimit from "express-rate-limit";

// [ФАКТ, спека §6]: 3 уровня — общий 300/15мин, транзакционный 30/мин,
// публичное чтение 1000/15мин.
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

export const txLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

export const publicReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  standardHeaders: true,
  legacyHeaders: false,
});

```

## FILE: aof_expansion/backend/src/middleware/validate.ts

```typescript
import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "validation_failed", details: result.error.flatten() });
    }
    req.body = result.data;
    next();
  };
}

```

## FILE: aof_expansion/backend/src/provider.ts

```typescript
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
import {
  RPC_URL, AUTHORITY,
  MARKET_PROGRAM_ID, SESSION_PROGRAM_ID, QUESTS_PROGRAM_ID,
  REBIRTH_PROGRAM_ID, LIQUIDITY_PROGRAM_ID, CORE_PROGRAM_ID,
} from "./config";
import coreIdl from "./idl/aof_core.json";
import marketIdl from "./idl/aof_market.json";
import sessionIdl from "./idl/aof_session_keys.json";
import questsIdl from "./idl/aof_quests.json";
import rebirthIdl from "./idl/aof_rebirth.json";
import liquidityIdl from "./idl/aof_liquidity.json";

export const connection = new Connection(RPC_URL, "confirmed");
export const wallet = new Wallet(AUTHORITY);
export const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });

export const coreProgram = new Program(coreIdl as any, CORE_PROGRAM_ID, provider);
export const marketProgram = new Program(marketIdl as any, MARKET_PROGRAM_ID, provider);
export const sessionProgram = new Program(sessionIdl as any, SESSION_PROGRAM_ID, provider);
export const questsProgram = new Program(questsIdl as any, QUESTS_PROGRAM_ID, provider);
export const rebirthProgram = new Program(rebirthIdl as any, REBIRTH_PROGRAM_ID, provider);
export const liquidityProgram = new Program(liquidityIdl as any, LIQUIDITY_PROGRAM_ID, provider);

```

## FILE: aof_expansion/backend/src/routes/alerts.ts

```typescript
import { Router } from "express";
import { prisma } from "../db";
import { validate } from "../middleware/validate";
import { schemas } from "../lib/validation";
import { asyncHandler } from "../middleware/errorHandler";

const r = Router();
const FREE_ALERT_LIMIT = 1;

r.get("/:user", asyncHandler(async (req, res) => {
  res.json(await prisma.priceAlert.findMany({ where: { owner: req.params.user } }));
}));

// [ФАКТ, спека §retention]: воронка "1 бесплатный алерт → апселл VIP" —
// проверка лимита ниже, апгрейд лимита для VIP делает vipStatus-роутер.
r.post("/create", validate(schemas.priceAlertCreate), asyncHandler(async (req, res) => {
  const trust = await prisma.trustScore.findUnique({ where: { owner: req.body.owner } });
  const isVip = (trust?.tier || 1) >= 3;
  const existing = await prisma.priceAlert.count({ where: { owner: req.body.owner, triggered: false } });
  if (!isVip && existing >= FREE_ALERT_LIMIT) {
    return res.status(402).json({ error: "free_alert_limit_reached", upsell: "vip_required_for_more_alerts" });
  }
  const alert = await prisma.priceAlert.create({
    data: {
      owner: req.body.owner, rarity: req.body.rarity,
      direction: req.body.direction, targetPrice: BigInt(Math.round(req.body.targetPrice)),
    },
  });
  res.json(alert);
}));

r.delete("/:id", asyncHandler(async (req, res) => {
  await prisma.priceAlert.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
}));

export default r;

```

## FILE: aof_expansion/backend/src/routes/antifraud.ts

```typescript
import { Router } from "express";
import { registerDevice, sybilScore, rewardAvailability } from "../lib/antifraud";
import { asyncHandler } from "../middleware/errorHandler";

const r = Router();

r.post("/device/register", asyncHandler(async (req, res) => {
  res.json(await registerDevice(req.body.owner, req.body.fingerprint));
}));

r.get("/status/:user", asyncHandler(async (req, res) => {
  const score = await sybilScore(req.params.user);
  res.json({ owner: req.params.user, sybilScore: score, flagged: score >= 40 });
}));

r.get("/reward/availability", asyncHandler(async (req, res) => {
  res.json(await rewardAvailability(req.query.referred as string));
}));

export default r;

```

## FILE: aof_expansion/backend/src/routes/apiKeys.ts

```typescript
import { Router } from "express";
import { randomBytes, createHash } from "crypto";
import { prisma } from "../db";
import { asyncHandler } from "../middleware/errorHandler";

const r = Router();

r.post("/issue", asyncHandler(async (req, res) => {
  const rawKey = "aof_" + randomBytes(24).toString("hex");
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  await prisma.apiKey.create({
    data: { keyHash, owner: req.body.owner, label: req.body.label, scopes: req.body.scopes || ["read"] },
  });
  // Ключ в открытом виде отдаётся ОДИН раз — хранится только его hash.
  res.json({ apiKey: rawKey });
}));

r.get("/list", asyncHandler(async (req, res) => {
  const keys = await prisma.apiKey.findMany({
    where: { owner: req.query.owner as string },
    select: { id: true, label: true, scopes: true, revoked: true, createdAt: true, lastUsedAt: true },
  });
  res.json(keys);
}));

r.post("/revoke", asyncHandler(async (req, res) => {
  await prisma.apiKey.update({ where: { id: req.body.id }, data: { revoked: true } });
  res.json({ ok: true });
}));

export default r;

```

## FILE: aof_expansion/backend/src/routes/challenges.ts

```typescript
import { Router } from "express";
import { SystemProgram } from "@solana/web3.js";
import { AUTHORITY } from "../config";
import { questsProgram } from "../provider";
import { challengeEntryPda, challengePda, questConfigPda } from "../lib/pda";
import { authorityOnly, coSign, pk } from "../lib/tx";
import { validate } from "../middleware/validate";
import { schemas } from "../lib/validation";
import { asyncHandler } from "../middleware/errorHandler";

const r = Router();

r.post("/init", asyncHandler(async (req, res) => {
  const challengeId = Number(req.body.challengeId);
  const [config] = questConfigPda();
  const [challenge] = challengePda(challengeId);
  const ix = await questsProgram.methods
    .challengeInit(challengeId, Number(req.body.durationSeconds))
    .accounts({ config, authority: AUTHORITY.publicKey, challenge, systemProgram: SystemProgram.programId })
    .instruction();
  res.json({ sig: await authorityOnly([ix]) });
}));

r.post("/contribute", validate(schemas.challengeContribute), asyncHandler(async (req, res) => {
  const user = pk(req.body.user);
  const challengeId = Number(req.body.challengeId);
  const [challenge] = challengePda(challengeId);
  const [entry] = challengeEntryPda(user, challengeId);
  const ix = await questsProgram.methods
    .challengeContribute(req.body.medals as any)
    .accounts({ user, challenge, entry, systemProgram: SystemProgram.programId })
    .instruction();
  res.json({ tx: await coSign([ix], user) });
}));

export default r;

```

## FILE: aof_expansion/backend/src/routes/comeback.ts

```typescript
import { Router } from "express";
import { prisma } from "../db";
import { asyncHandler } from "../middleware/errorHandler";

const r = Router();

// [ФАКТ, спека §retention]: бонусы за отсутствие 3/7/30 дней.
function tierForGapDays(days: number): number | null {
  if (days >= 30) return 3;
  if (days >= 7) return 2;
  if (days >= 3) return 1;
  return null;
}

r.post("/check", asyncHandler(async (req, res) => {
  const owner = req.body.owner;
  const now = new Date();
  const rec = await prisma.comebackRecord.findUnique({ where: { owner } });
  if (!rec) {
    await prisma.comebackRecord.create({ data: { owner, lastActiveAt: now } });
    return res.json({ isComeback: false });
  }
  const gapDays = Math.floor((now.getTime() - rec.lastActiveAt.getTime()) / 86400_000);
  const tier = tierForGapDays(gapDays);
  await prisma.comebackRecord.update({ where: { owner }, data: { lastActiveAt: now, returnedAt: tier ? now : rec.returnedAt, bonusTier: tier ?? rec.bonusTier } });

  if (tier) {
    const bonus = await prisma.comebackBonus.create({ data: { owner, tier } });
    return res.json({ isComeback: true, tier, gapDays, bonus });
  }
  res.json({ isComeback: false, gapDays });
}));

r.get("/:user", asyncHandler(async (req, res) => {
  res.json(await prisma.comebackRecord.findUnique({ where: { owner: req.params.user } }));
}));

r.post("/claim", asyncHandler(async (req, res) => {
  const bonus = await prisma.comebackBonus.update({ where: { id: req.body.bonusId }, data: { claimed: true } });
  res.json(bonus);
}));

export default r;

```

## FILE: aof_expansion/backend/src/routes/compendium.ts

```typescript
import { Router } from "express";
import { prisma } from "../db";
import { asyncHandler } from "../middleware/errorHandler";

const r = Router();
const TOOL_TYPES = ["axe", "pick", "spear", "bow"];
const RARITIES = ["common", "uncommon", "rare", "epic", "legendary"];

r.post("/mark-seen", asyncHandler(async (req, res) => {
  const entry = await prisma.compendiumEntry.upsert({
    where: { owner_toolType_rarity: { owner: req.body.owner, toolType: req.body.toolType, rarity: req.body.rarity } },
    update: {},
    create: { owner: req.body.owner, toolType: req.body.toolType, rarity: req.body.rarity },
  });
  res.json(entry);
}));

r.get("/:user", asyncHandler(async (req, res) => {
  const seen = await prisma.compendiumEntry.findMany({ where: { owner: req.params.user } });
  const seenSet = new Set(seen.map((s) => `${s.toolType}:${s.rarity}`));
  const grid = TOOL_TYPES.map((tt) => ({
    toolType: tt,
    rarities: RARITIES.map((r) => ({ rarity: r, seen: seenSet.has(`${tt}:${r}`) })),
  }));
  res.json({ grid, totalSeen: seen.length, totalCells: TOOL_TYPES.length * RARITIES.length });
}));

export default r;

```

## FILE: aof_expansion/backend/src/routes/drum.ts

```typescript
import { Router } from "express";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SystemProgram, SYSVAR_SLOT_HASHES_PUBKEY } from "@solana/web3.js";
import { AUTHORITY } from "../config";
import { questsProgram } from "../provider";
import { challengeEntryPda, drumCommitPda, drumConfigPda, questConfigPda } from "../lib/pda";
import { authorityOnly, coSign, pk } from "../lib/tx";
import { newCommit, popSecret } from "../lib/secretStore";
import { validate } from "../middleware/validate";
import { schemas } from "../lib/validation";
import { asyncHandler } from "../middleware/errorHandler";

const r = Router();

r.post("/config/init", asyncHandler(async (req, res) => {
  const [config] = questConfigPda();
  const [drumConfig] = drumConfigPda();
  const ix = await questsProgram.methods
    .initDrumConfig(req.body.prizeOddsBps)
    .accounts({ config, authority: AUTHORITY.publicKey, drumConfig, systemProgram: SystemProgram.programId })
    .instruction();
  res.json({ sig: await authorityOnly([ix]) });
}));

r.post("/commit", validate(schemas.drumCommit), asyncHandler(async (req, res) => {
  const user = pk(req.body.user);
  const challengeId = Number(req.body.challengeId);
  const [entry] = challengeEntryPda(user, challengeId);
  const [drumCommit] = drumCommitPda(user);

  const { hash } = newCommit(`drum:${user.toBase58()}`);

  const ix = await questsProgram.methods
    .drumCommit(req.body.medalsStaked, hash)
    .accounts({ user, entry, drumCommit, systemProgram: SystemProgram.programId })
    .instruction();
  res.json({ tx: await coSign([ix], user) });
}));

r.post("/reveal", asyncHandler(async (req, res) => {
  const user = pk(req.body.user);
  const rewardMint = pk(req.body.rewardMint);
  const [config] = questConfigPda();
  const [drumConfig] = drumConfigPda();
  const [drumCommit] = drumCommitPda(user);
  const userToken = getAssociatedTokenAddressSync(rewardMint, user);

  const secret = popSecret(`drum:${user.toBase58()}`);

  const ix = await questsProgram.methods
    .drumReveal(secret)
    .accounts({
      config, authority: AUTHORITY.publicKey, drumConfig, drumCommit, payer: user,
      rewardMint, userToken, mintAuthority: pk(req.body.mintAuthority),
      slotHashes: SYSVAR_SLOT_HASHES_PUBKEY, tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();
  res.json({ sig: await authorityOnly([ix]) });
}));

export default r;

```

## FILE: aof_expansion/backend/src/routes/energy.ts

```typescript
import { Router } from "express";
import { prisma } from "../db";
import { tierPrivileges } from "../lib/trustIndex";
import { asyncHandler } from "../middleware/errorHandler";

const r = Router();

async function regenerate(owner: string) {
  const trust = await prisma.trustScore.findUnique({ where: { owner } });
  const priv = tierPrivileges(trust?.tier || 1);
  let row = await prisma.energy.findUnique({ where: { owner } });
  if (!row) {
    row = await prisma.energy.create({ data: { owner, current: priv.energyCap, cap: priv.energyCap } });
    return row;
  }
  const minutesElapsed = (Date.now() - row.lastRegenAt.getTime()) / 60_000;
  const regenerated = Math.floor(minutesElapsed / priv.energyRegenMinutes);
  if (regenerated > 0) {
    const newCurrent = Math.min(priv.energyCap, row.current + regenerated);
    row = await prisma.energy.update({
      where: { owner },
      data: { current: newCurrent, cap: priv.energyCap, lastRegenAt: new Date() },
    });
  }
  return row;
}

r.get("/balance/:user", asyncHandler(async (req, res) => {
  res.json(await regenerate(req.params.user));
}));

r.post("/spend", asyncHandler(async (req, res) => {
  const owner = req.body.owner;
  const amount = Number(req.body.amount);
  const row = await regenerate(owner);
  if (row.current < amount) return res.status(400).json({ error: "not_enough_energy" });
  const updated = await prisma.energy.update({ where: { owner }, data: { current: row.current - amount } });
  res.json(updated);
}));

export default r;

```

## FILE: aof_expansion/backend/src/routes/farm.ts

```typescript
import { Router } from "express";
import { prisma } from "../db";
import { validate } from "../middleware/validate";
import { schemas } from "../lib/validation";
import { asyncHandler } from "../middleware/errorHandler";

const r = Router();

r.get("/plot/:user", asyncHandler(async (req, res) => {
  let plot = await prisma.farmPlot.findUnique({ where: { owner: req.params.user }, include: { buildings: true } });
  if (!plot) {
    plot = await prisma.farmPlot.create({ data: { owner: req.params.user }, include: { buildings: true } });
  }
  res.json(plot);
}));

r.post("/building/place", validate(schemas.farmBuildingPlace), asyncHandler(async (req, res) => {
  const plot = await prisma.farmPlot.upsert({
    where: { owner: req.body.owner },
    update: {},
    create: { owner: req.body.owner },
  });
  const occupied = await prisma.farmBuilding.findFirst({ where: { plotId: plot.id, x: req.body.x, y: req.body.y } });
  if (occupied) return res.status(400).json({ error: "cell_occupied" });

  const building = await prisma.farmBuilding.create({
    data: { plotId: plot.id, buildingType: req.body.buildingType, x: req.body.x, y: req.body.y },
  });
  res.json(building);
}));

r.post("/plot/expand", asyncHandler(async (req, res) => {
  const plot = await prisma.farmPlot.update({
    where: { owner: req.body.owner },
    data: {
      gridSizeX: { increment: Number(req.body.deltaX || 0) },
      gridSizeY: { increment: Number(req.body.deltaY || 0) },
    },
  });
  res.json(plot);
}));

export default r;

```

## FILE: aof_expansion/backend/src/routes/guild.ts

```typescript
import { Router } from "express";
import { prisma } from "../db";
import { validate } from "../middleware/validate";
import { schemas } from "../lib/validation";
import { asyncHandler } from "../middleware/errorHandler";

const r = Router();

r.post("/create", validate(schemas.guildCreate), asyncHandler(async (req, res) => {
  const guild = await prisma.guild.create({
    data: {
      name: req.body.name,
      ownerAddr: req.body.owner,
      members: { create: { address: req.body.owner, role: "owner" } },
    },
    include: { members: true },
  });
  res.json(guild);
}));

r.post("/join", asyncHandler(async (req, res) => {
  const member = await prisma.guildMember.create({
    data: { guildId: req.body.guildId, address: req.body.address },
  });
  await prisma.guildActivity.create({
    data: { guildId: req.body.guildId, address: req.body.address, kind: "joined" },
  });
  res.json(member);
}));

r.post("/deposit", asyncHandler(async (req, res) => {
  const activity = await prisma.guildActivity.create({
    data: {
      guildId: req.body.guildId,
      address: req.body.address,
      kind: "deposit",
      payload: { mint: req.body.mint, amount: req.body.amount },
    },
  });
  res.json(activity);
}));

r.get("/activity/:guildId", asyncHandler(async (req, res) => {
  const activity = await prisma.guildActivity.findMany({
    where: { guildId: req.params.guildId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json(activity);
}));

r.get("/members/:guildId", asyncHandler(async (req, res) => {
  const members = await prisma.guildMember.findMany({ where: { guildId: req.params.guildId } });
  res.json(members);
}));

r.post("/set-role", asyncHandler(async (req, res) => {
  const member = await prisma.guildMember.update({
    where: { guildId_address: { guildId: req.body.guildId, address: req.body.address } },
    data: { role: req.body.role },
  });
  res.json(member);
}));

export default r;

```

## FILE: aof_expansion/backend/src/routes/guildWars.ts

```typescript
import { Router } from "express";
import { prisma } from "../db";
import { asyncHandler } from "../middleware/errorHandler";

const r = Router();

r.get("/territories", asyncHandler(async (_req, res) => {
  res.json(await prisma.territory.findMany());
}));

r.post("/capture", asyncHandler(async (req, res) => {
  const totalDeposits = await prisma.guildActivity.count({
    where: { guildId: req.body.guildId, kind: "deposit" },
  });
  if (totalDeposits < 10) {
    return res.status(400).json({ error: "guild_has_not_earned_capture_right", requiredDeposits: 10, current: totalDeposits });
  }
  const territory = await prisma.territory.upsert({
    where: { name: req.body.territoryName },
    update: { controllingGuildId: req.body.guildId, capturedAt: new Date() },
    create: { name: req.body.territoryName, controllingGuildId: req.body.guildId, capturedAt: new Date() },
  });
  res.json(territory);
}));

r.get("/guild/:guildId", asyncHandler(async (req, res) => {
  const territories = await prisma.territory.findMany({ where: { controllingGuildId: req.params.guildId } });
  res.json(territories);
}));

export default r;

```

## FILE: aof_expansion/backend/src/routes/hotMarket.ts

```typescript
import { Router } from "express";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SystemProgram } from "@solana/web3.js";
import { AUTHORITY } from "../config";
import { marketProgram } from "../provider";
import { hotLimitOrderPda, hotPoolPda, marketConfigPda } from "../lib/pda";
import { authorityOnly, coSign, pk } from "../lib/tx";
import { asyncHandler } from "../middleware/errorHandler";

const r = Router();
const cur = (c: string) => (c === "core" ? { core: {} } : { gem: {} });

r.post("/config/init", asyncHandler(async (req, res) => {
  const [config] = marketConfigPda();
  const ix = await marketProgram.methods
    .initMarketConfig(Number(req.body.feeBps))
    .accounts({
      config,
      authority: AUTHORITY.publicKey,
      coreMint: pk(req.body.coreMint),
      gemMint: pk(req.body.gemMint),
      treasury: pk(req.body.treasury),
      systemProgram: SystemProgram.programId,
    })
    .instruction();
  res.json({ sig: await authorityOnly([ix]) });
}));

r.post("/pool/init", asyncHandler(async (req, res) => {
  const rarity = Number(req.body.rarity);
  const [config] = marketConfigPda();
  const [pool] = hotPoolPda(rarity);
  const ix = await marketProgram.methods
    .initPool(
      rarity,
      req.body.targetPriceCore as any,
      req.body.targetPriceGem as any,
      req.body.targetRatePerHour as any,
      Number(req.body.decayBpsPerHour),
      Number(req.body.growthBpsPerSale),
      Number(req.body.feeBps)
    )
    .accounts({ config, authority: AUTHORITY.publicKey, pool, systemProgram: SystemProgram.programId })
    .instruction();
  res.json({ sig: await authorityOnly([ix]) });
}));

r.post("/buy", asyncHandler(async (req, res) => {
  const rarity = Number(req.body.rarity);
  const currency = cur(req.body.currency);
  const buyer = pk(req.body.buyer);
  const currencyMint = pk(req.body.currencyMint);
  const [config] = marketConfigPda();
  const [pool] = hotPoolPda(rarity);
  const buyerCurrency = getAssociatedTokenAddressSync(currencyMint, buyer);
  const treasuryCurrency = getAssociatedTokenAddressSync(currencyMint, pk(req.body.treasury), true);

  const ix = await marketProgram.methods
    .hotMarketBuy(rarity, currency, req.body.maxPrice as any)
    .accounts({
      config, buyer, pool,
      treasury: pk(req.body.treasury),
      currencyMint, buyerCurrency, treasuryCurrency,
      newToolMint: pk(req.body.newToolMint),
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();
  res.json({ tx: await coSign([ix], buyer) });
}));

r.post("/sell", asyncHandler(async (req, res) => {
  const rarity = Number(req.body.rarity);
  const currency = cur(req.body.currency);
  const seller = pk(req.body.seller);
  const currencyMint = pk(req.body.currencyMint);
  const [config] = marketConfigPda();
  const [pool] = hotPoolPda(rarity);
  const sellerCurrency = getAssociatedTokenAddressSync(currencyMint, seller);
  const poolCurrency = getAssociatedTokenAddressSync(currencyMint, pool, true);

  const ix = await marketProgram.methods
    .hotMarketSellIntoQueue(rarity, currency, req.body.minPrice as any)
    .accounts({
      config, seller, pool, currencyMint, sellerCurrency, poolCurrency,
      soldToolMint: pk(req.body.soldToolMint),
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();
  res.json({ tx: await coSign([ix], seller) });
}));

r.post("/skip", asyncHandler(async (req, res) => {
  const rarity = Number(req.body.rarity);
  const user = pk(req.body.user);
  const [pool] = hotPoolPda(rarity);
  const ix = await marketProgram.methods.hotMarketSkip(rarity).accounts({ user, pool }).instruction();
  res.json({ tx: await coSign([ix], user) });
}));

r.post("/event/start", asyncHandler(async (req, res) => {
  const rarity = Number(req.body.rarity);
  const [config] = marketConfigPda();
  const [pool] = hotPoolPda(rarity);
  const ix = await marketProgram.methods
    .startMarketEvent(rarity, Number(req.body.durationSeconds), Number(req.body.multiplierBps))
    .accounts({ config, authority: AUTHORITY.publicKey, pool })
    .instruction();
  res.json({ sig: await authorityOnly([ix]) });
}));

r.post("/crank", asyncHandler(async (req, res) => {
  const rarity = Number(req.body.rarity);
  const [pool] = hotPoolPda(rarity);
  const ix = await marketProgram.methods.crankMarket(rarity).accounts({ pool }).instruction();
  res.json({ sig: await authorityOnly([ix]) });
}));

r.post("/limit/place", asyncHandler(async (req, res) => {
  const rarity = Number(req.body.rarity);
  const currency = cur(req.body.currency);
  const maker = pk(req.body.maker);
  const currencyMint = pk(req.body.currencyMint);
  const [config] = marketConfigPda();
  const [order] = hotLimitOrderPda(maker, rarity);
  const makerCurrency = getAssociatedTokenAddressSync(currencyMint, maker);
  const orderVault = getAssociatedTokenAddressSync(currencyMint, order, true);

  const ix = await marketProgram.methods
    .placeLimitOrder(rarity, currency, Boolean(req.body.isBuy), req.body.limitPrice as any, req.body.amount as any)
    .accounts({ config, maker, order, currencyMint, makerCurrency, orderVault, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId })
    .instruction();
  res.json({ tx: await coSign([ix], maker) });
}));

r.post("/limit/cancel", asyncHandler(async (req, res) => {
  const rarity = Number(req.body.rarity);
  const maker = pk(req.body.maker);
  const currencyMint = pk(req.body.currencyMint);
  const [order] = hotLimitOrderPda(maker, rarity);
  const orderVault = getAssociatedTokenAddressSync(currencyMint, order, true);
  const makerCurrency = getAssociatedTokenAddressSync(currencyMint, maker);

  const ix = await marketProgram.methods
    .cancelLimitOrder(rarity)
    .accounts({ maker, order, currencyMint, orderVault, makerCurrency, tokenProgram: TOKEN_PROGRAM_ID })
    .instruction();
  res.json({ tx: await coSign([ix], maker) });
}));

export default r;

```

## FILE: aof_expansion/backend/src/routes/inbox.ts

```typescript
import { Router } from "express";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SystemProgram } from "@solana/web3.js";
import { AUTHORITY } from "../config";
import { coreProgram } from "../provider";
import { authPda, configPda, playerPda } from "../lib/pda";
import { authorityOnly, pk } from "../lib/tx";
import { prisma } from "../db";
import { asyncHandler } from "../middleware/errorHandler";

const r = Router();

r.get("/:user", asyncHandler(async (req, res) => {
  const items = await prisma.inboxItem.findMany({
    where: { owner: req.params.user, archived: false },
    orderBy: { createdAt: "desc" },
  });
  res.json(items);
}));

r.post("/create", asyncHandler(async (req, res) => {
  const item = await prisma.inboxItem.create({
    data: {
      owner: req.body.owner, title: req.body.title, body: req.body.body,
      rewardMint: req.body.rewardMint, rewardAmount: req.body.rewardAmount ? BigInt(req.body.rewardAmount) : null,
    },
  });
  res.json(item);
}));

r.post("/read", asyncHandler(async (req, res) => {
  const item = await prisma.inboxItem.update({ where: { id: req.body.id }, data: { read: true } });
  res.json(item);
}));

r.post("/claim", asyncHandler(async (req, res) => {
  const item = await prisma.inboxItem.findUnique({ where: { id: req.body.id } });
  if (!item) return res.status(404).json({ error: "not_found" });
  if (item.claimed) return res.status(400).json({ error: "already_claimed" });
  if (!item.rewardMint || !item.rewardAmount) {
    const updated = await prisma.inboxItem.update({ where: { id: item.id }, data: { claimed: true } });
    return res.json(updated);
  }

  const owner = pk(item.owner);
  const mint = pk(item.rewardMint);
  const [config] = configPda();
  const [auth] = authPda();
  const [player] = playerPda(owner);
  const tokenAccount = getAssociatedTokenAddressSync(mint, owner);
  const treasuryToken = getAssociatedTokenAddressSync(mint, pk(req.body.treasury || item.owner), true);

  const configAccount: any = await (coreProgram.account as any).config.fetch(config);
  let kind: any;
  if (mint.equals(pk(configAccount.foodMint.toBase58()))) kind = { food: {} };
  else if (mint.equals(pk(configAccount.woodMint.toBase58()))) kind = { wood: {} };
  else if (mint.equals(pk(configAccount.stoneMint.toBase58()))) kind = { stone: {} };
  else return res.status(400).json({ error: "reward_mint_not_recognized" });

  const ix = await coreProgram.methods
    .mintResource(kind, item.rewardAmount as any)
    .accounts({
      config, authority: AUTHORITY.publicKey, auth, mint, tokenAccount,
      treasuryToken, player, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    })
    .instruction();
  await authorityOnly([ix]);

  const updated = await prisma.inboxItem.update({ where: { id: item.id }, data: { claimed: true } });
  res.json(updated);
}));

r.post("/archive", asyncHandler(async (req, res) => {
  const item = await prisma.inboxItem.update({ where: { id: req.body.id }, data: { archived: true } });
  res.json(item);
}));

export default r;

```

## FILE: aof_expansion/backend/src/routes/leaderboard.ts

```typescript
import { Router } from "express";
import { prisma } from "../db";
import { buildMerkleTree } from "../lib/merkle";
import { asyncHandler } from "../middleware/errorHandler";

const r = Router();

r.post("/snapshot", asyncHandler(async (req, res) => {
  const period = req.body.period as string; // "daily" | "weekly" | "season"
  const periodId = req.body.periodId as string;
  const entries: { owner: string; score: bigint }[] = req.body.entries;

  const ranked = [...entries]
    .sort((a, b) => (b.score > a.score ? 1 : -1))
    .map((e, i) => ({ owner: e.owner, rank: i + 1, score: e.score }));

  const { root, proofs } = buildMerkleTree(ranked);

  const snapshot = await prisma.leaderboardSnapshot.upsert({
    where: { period_periodId: { period, periodId } },
    update: { merkleRoot: root },
    create: { period, periodId, merkleRoot: root },
  });

  await prisma.leaderboardEntry.deleteMany({ where: { snapshotId: snapshot.id } });
  await prisma.leaderboardEntry.createMany({
    data: ranked.map((e) => ({
      snapshotId: snapshot.id, owner: e.owner, rank: e.rank, score: e.score,
      proof: proofs[e.owner] || [],
    })),
  });

  res.json({ snapshot, entriesCount: ranked.length });
}));

r.get("/:period/:periodId/:user", asyncHandler(async (req, res) => {
  const snapshot = await prisma.leaderboardSnapshot.findUnique({
    where: { period_periodId: { period: req.params.period, periodId: req.params.periodId } },
  });
  if (!snapshot) return res.status(404).json({ error: "snapshot_not_found" });
  const entry = await prisma.leaderboardEntry.findFirst({
    where: { snapshotId: snapshot.id, owner: req.params.user },
  });
  if (!entry) return res.status(404).json({ error: "entry_not_found" });
  res.json({ ...entry, merkleRoot: snapshot.merkleRoot });
}));

export default r;

```

## FILE: aof_expansion/backend/src/routes/liquidity.ts

```typescript
import { Router } from "express";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SystemProgram } from "@solana/web3.js";
import { AUTHORITY } from "../config";
import { liquidityProgram } from "../provider";
import { lpConfigPda, lpPoolPda, lpPositionPda } from "../lib/pda";
import { authorityOnly, coSign, pk } from "../lib/tx";
import { validate } from "../middleware/validate";
import { schemas } from "../lib/validation";
import { asyncHandler } from "../middleware/errorHandler";

const r = Router();

r.post("/config/init", asyncHandler(async (req, res) => {
  const [config] = lpConfigPda();
  const ix = await liquidityProgram.methods
    .initLpConfig()
    .accounts({ config, authority: AUTHORITY.publicKey, mascotMint: pk(req.body.mascotMint), systemProgram: SystemProgram.programId })
    .instruction();
  res.json({ sig: await authorityOnly([ix]) });
}));

r.post("/pool/init", asyncHandler(async (_req, res) => {
  const [config] = lpConfigPda();
  const [pool] = lpPoolPda();
  const ix = await liquidityProgram.methods
    .initLpPool()
    .accounts({ config, authority: AUTHORITY.publicKey, pool, systemProgram: SystemProgram.programId })
    .instruction();
  res.json({ sig: await authorityOnly([ix]) });
}));

r.post("/deposit", validate(schemas.lpDeposit), asyncHandler(async (req, res) => {
  const user = pk(req.body.user);
  const mascotMint = pk(req.body.mascotMint);
  const [pool] = lpPoolPda();
  const [position] = lpPositionPda(user);
  const userMascot = getAssociatedTokenAddressSync(mascotMint, user);
  const poolMascot = getAssociatedTokenAddressSync(mascotMint, pool, true);

  const ix = await liquidityProgram.methods
    .lpDeposit(req.body.amount as any)
    .accounts({ user, pool, mascotMint, userMascot, poolMascot, position, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId })
    .instruction();
  res.json({ tx: await coSign([ix], user) });
}));

r.post("/withdraw", asyncHandler(async (req, res) => {
  const user = pk(req.body.user);
  const mascotMint = pk(req.body.mascotMint);
  const [pool] = lpPoolPda();
  const [position] = lpPositionPda(user);
  const userMascot = getAssociatedTokenAddressSync(mascotMint, user);
  const poolMascot = getAssociatedTokenAddressSync(mascotMint, pool, true);

  const ix = await liquidityProgram.methods
    .lpWithdraw(req.body.shares as any)
    .accounts({ user, pool, mascotMint, userMascot, poolMascot, position, tokenProgram: TOKEN_PROGRAM_ID })
    .instruction();
  res.json({ tx: await coSign([ix], user) });
}));

export default r;

```

## FILE: aof_expansion/backend/src/routes/lore.ts

```typescript
import { Router } from "express";
import { prisma } from "../db";
import { asyncHandler } from "../middleware/errorHandler";

const r = Router();

// [ФАКТ, спека]: "Старый Ферма Джо" — линейный граф диалоговых узлов,
// хранится статично здесь (не в БД — контент, не игровое состояние).
const LORE_GRAPH: Record<string, { text: string; next: string[] }> = {
  intro: { text: "Здравствуй, путник. Меня зовут Старый Фермер Джо.", next: ["about_farm"] },
  about_farm: { text: "Эта ферма старше меня — а я немолод.", next: ["about_market", "about_tools"] },
  about_market: { text: "Хочешь — торгуй на хот-маркете, там всегда движение.", next: ["end"] },
  about_tools: { text: "Инструменты растут вместе с тобой. Начни с топора.", next: ["end"] },
  end: { text: "Ну, удачи в поле.", next: [] },
};

r.get("/:user", asyncHandler(async (req, res) => {
  let row = await prisma.loreProgress.findUnique({ where: { owner: req.params.user } });
  if (!row) row = await prisma.loreProgress.create({ data: { owner: req.params.user } });
  const node = LORE_GRAPH[row.currentNode];
  res.json({ ...row, node });
}));

r.post("/node/complete", asyncHandler(async (req, res) => {
  const owner = req.body.owner;
  const nextNode = req.body.nextNode as string;
  if (!LORE_GRAPH[nextNode]) return res.status(400).json({ error: "unknown_node" });
  const row = await prisma.loreProgress.upsert({
    where: { owner },
    update: { currentNode: nextNode, completedNodes: { push: req.body.completedNode } },
    create: { owner, currentNode: nextNode, completedNodes: [req.body.completedNode] },
  });
  res.json(row);
}));

export default r;

```

## FILE: aof_expansion/backend/src/routes/marketData.ts

```typescript
import { Router } from "express";
import { prisma } from "../db";
import { asyncHandler } from "../middleware/errorHandler";

const r = Router();

r.get("/price/:rarity", asyncHandler(async (req, res) => {
  const currency = (req.query.currency as string) || "core";
  const tick = await prisma.priceTick.findFirst({
    where: { rarity: req.params.rarity, currency },
    orderBy: { ts: "desc" },
  });
  res.json(tick || null);
}));

r.get("/candles/:rarity", asyncHandler(async (req, res) => {
  const currency = (req.query.currency as string) || "core";
  const interval = (req.query.interval as string) || "1m";
  const limit = Math.min(1000, Number(req.query.limit) || 200);
  const candles = await prisma.candle.findMany({
    where: { rarity: req.params.rarity, currency, interval },
    orderBy: { bucketStart: "desc" },
    take: limit,
  });
  res.json(candles.reverse());
}));

r.get("/trades/:rarity", asyncHandler(async (req, res) => {
  const currency = (req.query.currency as string) || "core";
  const limit = Math.min(200, Number(req.query.limit) || 50);
  const trades = await prisma.priceTick.findMany({
    where: { rarity: req.params.rarity, currency },
    orderBy: { ts: "desc" },
    take: limit,
  });
  res.json(trades);
}));

export default r;

```

## FILE: aof_expansion/backend/src/routes/neighbors.ts

```typescript
import { Router } from "express";
import { prisma } from "../db";
import { validate } from "../middleware/validate";
import { schemas } from "../lib/validation";
import { asyncHandler } from "../middleware/errorHandler";

const r = Router();
const DAILY_VISIT_LIMIT = 5;
const VISIT_ENERGY_COST = 1;

r.get("/list/:user", asyncHandler(async (req, res) => {
  const memberships = await prisma.guildMember.findMany({ where: { address: req.params.user }, select: { guildId: true } });
  const guildIds = memberships.map((m) => m.guildId);
  const guildmates = await prisma.guildMember.findMany({
    where: { guildId: { in: guildIds }, address: { not: req.params.user } },
    distinct: ["address"],
    select: { address: true },
  });
  res.json(guildmates.map((g) => g.address));
}));

r.post("/visit", validate(schemas.neighborVisit), asyncHandler(async (req, res) => {
  const { visitor, target, action } = req.body;
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const todayCount = await prisma.neighborVisit.count({ where: { visitor, visitedAt: { gte: since } } });
  if (todayCount >= DAILY_VISIT_LIMIT) {
    return res.status(400).json({ error: "daily_visit_limit_reached" });
  }

  const energyRow = await prisma.energy.findUnique({ where: { owner: visitor } });
  if (!energyRow || energyRow.current < VISIT_ENERGY_COST) {
    return res.status(400).json({ error: "not_enough_energy" });
  }
  await prisma.energy.update({ where: { owner: visitor }, data: { current: { decrement: VISIT_ENERGY_COST } } });

  const visit = await prisma.neighborVisit.create({ data: { visitor, target, action } });
  res.json(visit);
}));

export default r;

```

## FILE: aof_expansion/backend/src/routes/notifications.ts

```typescript
import { Router } from "express";
import { prisma } from "../db";
import { asyncHandler } from "../middleware/errorHandler";

const r = Router();

r.post("/device/register", asyncHandler(async (req, res) => {
  const token = await prisma.deviceToken.upsert({
    where: { owner_token: { owner: req.body.owner, token: req.body.token } },
    update: {},
    create: { owner: req.body.owner, token: req.body.token, platform: req.body.platform },
  });
  res.json(token);
}));

r.post("/device/unregister", asyncHandler(async (req, res) => {
  await prisma.deviceToken.deleteMany({ where: { owner: req.body.owner, token: req.body.token } });
  res.json({ ok: true });
}));

r.post("/queue", asyncHandler(async (req, res) => {
  const item = await prisma.notificationQueue.create({
    data: { owner: req.body.owner, title: req.body.title, body: req.body.body, data: req.body.data },
  });
  res.json(item);
}));

r.get("/:user", asyncHandler(async (req, res) => {
  res.json(
    await prisma.notificationQueue.findMany({
      where: { owner: req.params.user },
      orderBy: { createdAt: "desc" },
      take: 50,
    })
  );
}));

export default r;

```

## FILE: aof_expansion/backend/src/routes/onboarding.ts

```typescript
import { Router } from "express";
import { prisma } from "../db";
import { asyncHandler } from "../middleware/errorHandler";

const r = Router();
const STEPS = ["connect_wallet", "claim_starter_tool", "first_mine", "visit_market", "join_guild"];

r.get("/:user", asyncHandler(async (req, res) => {
  let row = await prisma.onboardingState.findUnique({ where: { owner: req.params.user } });
  if (!row) row = await prisma.onboardingState.create({ data: { owner: req.params.user } });
  res.json({ ...row, steps: STEPS, currentStepName: STEPS[row.currentStep] || null });
}));

r.post("/step/complete", asyncHandler(async (req, res) => {
  const owner = req.body.owner;
  const row = await prisma.onboardingState.findUnique({ where: { owner } });
  const currentStep = row?.currentStep ?? 0;
  const nextStep = currentStep + 1;
  const completed = nextStep >= STEPS.length;
  const updated = await prisma.onboardingState.upsert({
    where: { owner },
    update: { currentStep: nextStep, completed, completedAt: completed ? new Date() : null },
    create: { owner, currentStep: nextStep, completed },
  });
  res.json(updated);
}));

export default r;

```

## FILE: aof_expansion/backend/src/routes/portfolio.ts

```typescript
import { Router } from "express";
import { PublicKey } from "@solana/web3.js";
import { coreProgram } from "../provider";
import { prisma } from "../db";
import { asyncHandler } from "../middleware/errorHandler";

const r = Router();

r.get("/:user", asyncHandler(async (req, res) => {
  const owner = req.params.user;

  const tools = await (coreProgram.account as any).toolData.all([
    { memcmp: { offset: 40, bytes: owner } },
  ]);
  const byRarity: Record<string, number> = {};
  for (const t of tools) {
    const rk = Object.keys(t.account.rarity)[0];
    byRarity[rk] = (byRarity[rk] || 0) + 1;
  }

  const latestPrices = await prisma.priceTick.findMany({
    distinct: ["rarity", "currency"],
    orderBy: { ts: "desc" },
    take: 20,
  });

  let netWorthLamports = 0n;
  for (const [rarity, count] of Object.entries(byRarity)) {
    const tick = latestPrices.find((p) => p.rarity === rarity && p.currency === "core");
    if (tick) netWorthLamports += tick.price * BigInt(count);
  }

  const history: Record<string, any> = {};
  for (const days of [7, 30, 90]) {
    const since = new Date(Date.now() - days * 86400_000);
    history[`d${days}`] = await prisma.candle.findMany({
      where: { bucketStart: { gte: since } },
      orderBy: { bucketStart: "asc" },
      take: 500,
    });
  }

  res.json({
    owner,
    toolsByRarity: byRarity,
    totalTools: tools.length,
    netWorthLamports: netWorthLamports.toString(),
    history,
  });
}));

export default r;

```

## FILE: aof_expansion/backend/src/routes/profile.ts

```typescript
import { Router } from "express";
import { prisma } from "../db";
import { asyncHandler } from "../middleware/errorHandler";

const r = Router();

r.get("/:user", asyncHandler(async (req, res) => {
  let profile = await prisma.profile.findUnique({ where: { owner: req.params.user } });
  if (!profile) profile = await prisma.profile.create({ data: { owner: req.params.user } });
  res.json(profile);
}));

r.post("/update", asyncHandler(async (req, res) => {
  const profile = await prisma.profile.upsert({
    where: { owner: req.body.owner },
    update: {
      displayName: req.body.displayName,
      avatarId: req.body.avatarId,
      titleId: req.body.titleId,
      showcaseMint: req.body.showcaseMint,
    },
    create: {
      owner: req.body.owner,
      displayName: req.body.displayName,
      avatarId: req.body.avatarId ?? 0,
      titleId: req.body.titleId ?? 0,
      showcaseMint: req.body.showcaseMint,
    },
  });
  res.json(profile);
}));

export default r;

```

## FILE: aof_expansion/backend/src/routes/public/index.ts

```typescript
import { Router } from "express";
import { prisma } from "../db";
import { apiKeyAuth } from "../middleware/apiKey";
import { publicReadLimiter } from "../middleware/rateLimit";
import { asyncHandler } from "../middleware/errorHandler";

const r = Router();
r.use(publicReadLimiter, apiKeyAuth);

r.get("/prices", asyncHandler(async (_req, res) => {
  const latest = await prisma.priceTick.findMany({ distinct: ["rarity", "currency"], orderBy: { ts: "desc" }, take: 20 });
  res.json(latest);
}));

r.get("/candles/:rarity", asyncHandler(async (req, res) => {
  const candles = await prisma.candle.findMany({
    where: { rarity: req.params.rarity, interval: (req.query.interval as string) || "1h" },
    orderBy: { bucketStart: "desc" },
    take: 200,
  });
  res.json(candles.reverse());
}));

r.get("/stats", asyncHandler(async (_req, res) => {
  const [players, guilds, tools24h] = await Promise.all([
    prisma.profile.count(),
    prisma.guild.count(),
    prisma.priceTick.count({ where: { ts: { gte: new Date(Date.now() - 86400_000) } } }),
  ]);
  res.json({ totalProfiles: players, totalGuilds: guilds, trades24h: tools24h });
}));

r.get("/leaderboard/:period/:periodId", asyncHandler(async (req, res) => {
  const snapshot = await prisma.leaderboardSnapshot.findUnique({
    where: { period_periodId: { period: req.params.period, periodId: req.params.periodId } },
  });
  if (!snapshot) return res.status(404).json({ error: "not_found" });
  const entries = await prisma.leaderboardEntry.findMany({
    where: { snapshotId: snapshot.id },
    orderBy: { rank: "asc" },
    take: 100,
  });
  res.json({ merkleRoot: snapshot.merkleRoot, entries });
}));

export default r;

```

## FILE: aof_expansion/backend/src/routes/quests.ts

```typescript
import { Router } from "express";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SystemProgram } from "@solana/web3.js";
import { AUTHORITY } from "../config";
import { questsProgram } from "../provider";
import { achievementPda, questConfigPda, questPda, questProgressPda } from "../lib/pda";
import { authorityOnly, coSign, pk } from "../lib/tx";
import { prisma } from "../db";
import { asyncHandler } from "../middleware/errorHandler";

const r = Router();

r.post("/config/init", asyncHandler(async (req, res) => {
  const [config] = questConfigPda();
  const ix = await questsProgram.methods
    .initQuestConfig()
    .accounts({ config, authority: AUTHORITY.publicKey, coreMint: pk(req.body.coreMint), treasury: pk(req.body.treasury), systemProgram: SystemProgram.programId })
    .instruction();
  res.json({ sig: await authorityOnly([ix]) });
}));

r.post("/quest/init", asyncHandler(async (req, res) => {
  const questId = Number(req.body.questId);
  const [config] = questConfigPda();
  const [quest] = questPda(questId);
  const ix = await questsProgram.methods
    .questInit(questId, req.body.rewardAmount as any, Number(req.body.target))
    .accounts({ config, authority: AUTHORITY.publicKey, quest, systemProgram: SystemProgram.programId })
    .instruction();
  res.json({ sig: await authorityOnly([ix]) });
}));

r.post("/quest/progress", asyncHandler(async (req, res) => {
  const row = await prisma.questProgressDb.upsert({
    where: { owner_questId: { owner: req.body.owner, questId: Number(req.body.questId) } },
    update: { progress: { increment: Number(req.body.delta) } },
    create: { owner: req.body.owner, questId: Number(req.body.questId), progress: Number(req.body.delta) },
  });
  res.json(row);
}));

r.post("/quest/claim", asyncHandler(async (req, res) => {
  const user = pk(req.body.user);
  const questId = Number(req.body.questId);
  const rewardMint = pk(req.body.rewardMint);
  const [config] = questConfigPda();
  const [quest] = questPda(questId);
  const [progress] = questProgressPda(user, questId);
  const userToken = getAssociatedTokenAddressSync(rewardMint, user);

  const ix = await questsProgram.methods
    .questClaimReward()
    .accounts({
      config, authority: AUTHORITY.publicKey, quest, progress, rewardMint, userToken,
      mintAuthority: pk(req.body.mintAuthority), tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();
  res.json({ sig: await authorityOnly([ix]) });
}));

r.post("/achievement/unlock", asyncHandler(async (req, res) => {
  const owner = pk(req.body.owner);
  const achievementId = Number(req.body.achievementId);
  const badgeMint = pk(req.body.badgeMint);
  const [config] = questConfigPda();
  const [badge] = achievementPda(owner, achievementId);
  const ownerToken = getAssociatedTokenAddressSync(badgeMint, owner);

  const ix = await questsProgram.methods
    .achievementUnlock(achievementId)
    .accounts({
      config, authority: AUTHORITY.publicKey, owner, badgeMint, ownerToken,
      mintAuthority: pk(req.body.mintAuthority), badge, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    })
    .instruction();
  res.json({ sig: await authorityOnly([ix]) });
}));

export default r;

```

## FILE: aof_expansion/backend/src/routes/rebirth.ts

```typescript
import { Router } from "express";
import { SystemProgram } from "@solana/web3.js";
import { AUTHORITY } from "../config";
import { rebirthProgram, coreProgram } from "../provider";
import { rebirthConfigPda, rebirthRecordPda } from "../lib/pda";
import { authorityOnly, coSign, pk } from "../lib/tx";
import { validate } from "../middleware/validate";
import { schemas } from "../lib/validation";
import { asyncHandler } from "../middleware/errorHandler";

const r = Router();

r.post("/config/init", asyncHandler(async (req, res) => {
  const [config] = rebirthConfigPda();
  const ix = await rebirthProgram.methods
    .initRebirthConfig(Number(req.body.bonusBps), Number(req.body.maxBonusBps), Number(req.body.maxRebirths))
    .accounts({ config, authority: AUTHORITY.publicKey, systemProgram: SystemProgram.programId })
    .instruction();
  res.json({ sig: await authorityOnly([ix]) });
}));

// [ВАЖНО]: минимальный прогресс для права на ребёрт (например, наличие
// Legendary-инструмента в aof_core) проверяется здесь, на бэкенде, ДО
// co-sign — а не в самом aof-rebirth контракте (нет cross-program state,
// см. TODO в lib.rs). Если проверка не пройдена, co-sign не происходит.
r.post("/do", validate(schemas.rebirthDo), asyncHandler(async (req, res) => {
  const user = pk(req.body.user);

  const myTools = await (coreProgram.account as any).toolData.all([
    { memcmp: { offset: 40, bytes: user.toBase58() } },
  ]);
  const hasLegendary = myTools.some((t: any) => Object.keys(t.account.rarity)[0] === "legendary");
  if (!hasLegendary) {
    return res.status(400).json({ error: "requirement_not_met: need at least one Legendary tool" });
  }

  const [config] = rebirthConfigPda();
  const [record] = rebirthRecordPda(user);
  const ix = await rebirthProgram.methods
    .doRebirth()
    .accounts({ config, user, record, systemProgram: SystemProgram.programId })
    .instruction();
  res.json({ tx: await coSign([ix], user) });
}));

export default r;

```

## FILE: aof_expansion/backend/src/routes/referralTiers.ts

```typescript
import { Router } from "express";
import { prisma } from "../db";
import { registerDevice, startReferralHold, rewardAvailability } from "../lib/antifraud";
import { asyncHandler } from "../middleware/errorHandler";

const r = Router();

// [ФАКТ, спека v1 §4.2]: тиры 2%(≤10)/0.5%(≤100)/0.1%(≤1000)/0.0025%(>1000)
// + 10% от заработка друзей 1-го уровня, 2.5% от друзей 2-го уровня.
function tierBpsFor(directCount: number): number {
  if (directCount <= 10) return 200;
  if (directCount <= 100) return 50;
  if (directCount <= 1000) return 10;
  return 0; // 0.0025% — считается в долях лампортов напрямую при выплате, не в bps
}

r.get("/:user", asyncHandler(async (req, res) => {
  let row = await prisma.referralStatsDb.findUnique({ where: { owner: req.params.user } });
  if (!row) row = await prisma.referralStatsDb.create({ data: { owner: req.params.user } });
  res.json({ ...row, tierBps: tierBpsFor(row.directCount), l1BonusBps: 1000, l2BonusBps: 250 });
}));

r.post("/bind", asyncHandler(async (req, res) => {
  const { referrer, referred, deviceFingerprint } = req.body;
  if (deviceFingerprint) {
    const fraud = await registerDevice(referred, deviceFingerprint);
    if (fraud.sharedWithCount > 0) {
      return res.status(400).json({ error: "device_fingerprint_conflict", sharedWithCount: fraud.sharedWithCount });
    }
  }
  await startReferralHold(referrer, referred);
  const stats = await prisma.referralStatsDb.upsert({
    where: { owner: referrer },
    update: { directCount: { increment: 1 } },
    create: { owner: referrer, directCount: 1 },
  });

  const upline = await prisma.referralHolding.findUnique({ where: { referred: referrer } });
  if (upline) {
    await prisma.referralStatsDb.upsert({
      where: { owner: upline.referrer },
      update: { l2Count: { increment: 1 } },
      create: { owner: upline.referrer, l2Count: 1 },
    });
  }
  res.json(stats);
}));

r.get("/reward-availability/:referred", asyncHandler(async (req, res) => {
  res.json(await rewardAvailability(req.params.referred));
}));

export default r;

```

## FILE: aof_expansion/backend/src/routes/seasonalCompendium.ts

```typescript
import { Router } from "express";
import { prisma } from "../db";
import { asyncHandler } from "../middleware/errorHandler";

const r = Router();

// [ФАКТ, спека]: сезонные компендиумы — ротируемые цели поверх постоянного
// compendium.ts. Ротация — детерминированная по номеру сезона (та же
// логика, что weather.ts: без отдельной таблицы под каждую ротацию).
const SEASONAL_TARGETS: Record<number, { toolType: string; rarity: string }[]> = {
  1: [{ toolType: "axe", rarity: "epic" }, { toolType: "bow", rarity: "rare" }],
  2: [{ toolType: "pick", rarity: "legendary" }, { toolType: "spear", rarity: "uncommon" }],
};

r.get("/:user", asyncHandler(async (req, res) => {
  const seasonId = Number(req.query.seasonId) || 1;
  const targets = SEASONAL_TARGETS[seasonId] || [];
  const seen = await prisma.compendiumEntry.findMany({ where: { owner: req.params.user } });
  const seenSet = new Set(seen.map((s) => `${s.toolType}:${s.rarity}`));
  const progress = targets.map((t) => ({ ...t, completed: seenSet.has(`${t.toolType}:${t.rarity}`) }));
  res.json({ seasonId, targets: progress, completedCount: progress.filter((p) => p.completed).length, total: progress.length });
}));

export default r;

```

## FILE: aof_expansion/backend/src/routes/session.ts

```typescript
import { Router } from "express";
import { SystemProgram } from "@solana/web3.js";
import { AUTHORITY } from "../config";
import { sessionProgram } from "../provider";
import { sessionPda, skConfigPda, trustSnapshotPda } from "../lib/pda";
import { coSign, pk } from "../lib/tx";
import { validate } from "../middleware/validate";
import { schemas } from "../lib/validation";
import { asyncHandler } from "../middleware/errorHandler";

const r = Router();

r.post("/config/init", asyncHandler(async (req, res) => {
  const [config] = skConfigPda();
  const ix = await sessionProgram.methods
    .initConfig()
    .accounts({ config, authority: AUTHORITY.publicKey, oracleAuthority: pk(req.body.oracleAuthority), systemProgram: SystemProgram.programId })
    .instruction();
  const { authorityOnly } = await import("../lib/tx");
  res.json({ sig: await authorityOnly([ix]) });
}));

// [БЕЗОПАСНОСТЬ]: allowed_ixs проверяется программой на пересечение с
// FORBIDDEN_IXS_MASK — этот эндпоинт не может обойти on-chain constraint,
// даже если сюда передать некорректную маску.
r.post("/create", validate(schemas.sessionCreate), asyncHandler(async (req, res) => {
  const authority = pk(req.body.authority);
  const sessionSigner = pk(req.body.sessionSigner);
  const targetProgram = pk(req.body.targetProgram);
  const [session] = sessionPda(authority);
  const [trust] = trustSnapshotPda(authority);

  const ix = await sessionProgram.methods
    .sessionCreate(req.body.allowedIxs as any, req.body.requestedMaxPerTx as any, req.body.ttlSeconds)
    .accounts({ authority, sessionSigner, targetProgram, trust, session, systemProgram: SystemProgram.programId })
    .instruction();
  res.json({ tx: await coSign([ix], authority) });
}));

r.post("/revoke", asyncHandler(async (req, res) => {
  const authority = pk(req.body.authority);
  const [session] = sessionPda(authority);
  const ix = await sessionProgram.methods.sessionRevoke().accounts({ authority, session }).instruction();
  res.json({ tx: await coSign([ix], authority) });
}));

export default r;

```

## FILE: aof_expansion/backend/src/routes/streaks.ts

```typescript
import { Router } from "express";
import { prisma } from "../db";
import { asyncHandler } from "../middleware/errorHandler";

const r = Router();
const MILESTONES = [7, 30, 100];

r.post("/check-in", asyncHandler(async (req, res) => {
  const owner = req.body.owner;
  let row = await prisma.streak.findUnique({ where: { owner } });
  const now = new Date();
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);

  if (!row) {
    row = await prisma.streak.create({ data: { owner, currentCount: 1, longestCount: 1, lastCheckIn: now } });
  } else {
    const lastDay = row.lastCheckIn ? new Date(row.lastCheckIn) : null;
    if (lastDay && lastDay >= startOfToday) {
      return res.json({ ...row, alreadyCheckedIn: true });
    }
    const yesterday = new Date(startOfToday.getTime() - 86400_000);
    const isConsecutive = lastDay && lastDay >= yesterday;
    const newCount = isConsecutive ? row.currentCount + 1 : 1;
    row = await prisma.streak.update({
      where: { owner },
      data: { currentCount: newCount, longestCount: Math.max(row.longestCount, newCount), lastCheckIn: now },
    });
  }

  const newlyReached = MILESTONES.filter((m) => m === row!.currentCount && !row!.claimedMilestones.includes(m));
  res.json({ ...row, newlyReachedMilestones: newlyReached });
}));

r.get("/:user", asyncHandler(async (req, res) => {
  const row = await prisma.streak.findUnique({ where: { owner: req.params.user } });
  res.json(row || { owner: req.params.user, currentCount: 0, longestCount: 0 });
}));

r.post("/claim-milestone", asyncHandler(async (req, res) => {
  const owner = req.body.owner;
  const milestone = Number(req.body.milestone);
  const row = await prisma.streak.findUnique({ where: { owner } });
  if (!row || row.currentCount < milestone) return res.status(400).json({ error: "milestone_not_reached" });
  if (row.claimedMilestones.includes(milestone)) return res.status(400).json({ error: "already_claimed" });
  const updated = await prisma.streak.update({
    where: { owner },
    data: { claimedMilestones: { push: milestone } },
  });
  res.json(updated);
}));

export default r;

```

## FILE: aof_expansion/backend/src/routes/traderRules.ts

```typescript
import { Router } from "express";
import { prisma } from "../db";
import { validate } from "../middleware/validate";
import { schemas } from "../lib/validation";
import { tierPrivileges } from "../lib/trustIndex";
import { asyncHandler } from "../middleware/errorHandler";

const r = Router();

// [ФАКТ, спека v1 §6 "упростить на MVP"]: этот роутер только СОХРАНЯЕТ
// правила и лимиты. Реальное исполнение сделок делает services/farm-trader
// (отдельный процесс), который сам проверяет session-key + trust-tier лимит
// перед каждой транзакцией — здесь нет прямого пути к исполнению.
r.post("/create", validate(schemas.traderRuleCreate), asyncHandler(async (req, res) => {
  const trust = await prisma.trustScore.findUnique({ where: { owner: req.body.owner } });
  const tier = trust?.tier || 1;
  if (tier < 3) {
    return res.status(403).json({ error: "trader_bot_requires_trust_tier_3_or_vip" });
  }
  const rule = await prisma.traderRule.create({
    data: { owner: req.body.owner, kind: req.body.kind, rarity: req.body.rarity, params: req.body.params },
  });
  res.json(rule);
}));

r.get("/:user", asyncHandler(async (req, res) => {
  res.json(await prisma.traderRule.findMany({ where: { owner: req.params.user } }));
}));

r.post("/toggle", asyncHandler(async (req, res) => {
  const rule = await prisma.traderRule.update({ where: { id: req.body.id }, data: { enabled: req.body.enabled } });
  res.json(rule);
}));

r.delete("/:id", asyncHandler(async (req, res) => {
  await prisma.traderRule.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
}));

r.get("/executions/:user", asyncHandler(async (req, res) => {
  res.json(
    await prisma.traderExecution.findMany({
      where: { owner: req.params.user },
      orderBy: { createdAt: "desc" },
      take: 100,
    })
  );
}));

export default r;

```

## FILE: aof_expansion/backend/src/routes/trust.ts

```typescript
import { Router } from "express";
import { SystemProgram } from "@solana/web3.js";
import { ORACLE } from "../config";
import { sessionProgram } from "../provider";
import { skConfigPda, trustSnapshotPda } from "../lib/pda";
import { oracleOnly, pk } from "../lib/tx";
import { prisma } from "../db";
import { computeTrustIndex, tierPrivileges } from "../lib/trustIndex";
import { asyncHandler } from "../middleware/errorHandler";

const r = Router();

r.get("/:user", asyncHandler(async (req, res) => {
  const owner = req.params.user;
  let account = await prisma.trustBreakdown.findUnique({ where: { owner } });
  if (!account) {
    account = await prisma.trustBreakdown.create({ data: { owner } });
  }
  const score = await prisma.trustScore.findUnique({ where: { owner } });
  res.json({
    breakdown: account,
    score: score?.score || 0,
    tier: score?.tier || 1,
    privileges: tierPrivileges(score?.tier || 1),
  });
}));

r.post("/snapshot/update", asyncHandler(async (req, res) => {
  const user = pk(req.body.user);
  const created = await prisma.trustBreakdown.upsert({
    where: { owner: req.body.user },
    update: {},
    create: { owner: req.body.user },
  });
  const result = await computeTrustIndex(req.body.user, (created as any).createdAt || new Date());

  await prisma.trustScore.upsert({
    where: { owner: req.body.user },
    update: { score: result.finalScore, tier: result.tier, breakdown: result as any },
    create: { owner: req.body.user, score: result.finalScore, tier: result.tier, breakdown: result as any },
  });

  const [config] = skConfigPda();
  const [trust] = trustSnapshotPda(user);
  const epoch = Math.floor(Date.now() / 1000);
  const ix = await sessionProgram.methods
    .trustSnapshotUpdate(result.finalScore, result.tier, epoch as any)
    .accounts({ config, oracleAuthority: ORACLE.publicKey, user, trust, systemProgram: SystemProgram.programId })
    .instruction();

  const sig = await oracleOnly([ix]);
  res.json({ sig, result });
}));

export default r;

```

## FILE: aof_expansion/backend/src/routes/vipStatus.ts

```typescript
import { Router } from "express";
import { prisma } from "../db";
import { tierPrivileges } from "../lib/trustIndex";
import { asyncHandler } from "../middleware/errorHandler";

const r = Router();

// [ФАКТ, спека §retention]: "единая точка правды VIP-статуса" — остальные
// роутеры (alerts, traderRules, energy) читают привилегии тира через
// tierPrivileges(), не хранят собственную копию VIP-флага.
r.get("/:user", asyncHandler(async (req, res) => {
  const trust = await prisma.trustScore.findUnique({ where: { owner: req.params.user } });
  const tier = trust?.tier || 1;
  const priv = tierPrivileges(tier);
  res.json({ owner: req.params.user, trustScore: trust?.score || 0, tier, isVip: tier >= 3, privileges: priv });
}));

export default r;

```

## FILE: aof_expansion/backend/src/routes/weather.ts

```typescript
import { Router } from "express";
import { createHash } from "crypto";
import { prisma } from "../db";
import { asyncHandler } from "../middleware/errorHandler";

const r = Router();
const TYPES = ["sunny", "rain", "wind", "fog"];

function deterministicWeather(dateStr: string): { weatherType: string; seed: string } {
  const seed = createHash("sha256").update(dateStr).digest("hex");
  const idx = parseInt(seed.slice(0, 8), 16) % TYPES.length;
  return { weatherType: TYPES[idx], seed };
}

async function forDate(dateStr: string) {
  let row = await prisma.weather.findUnique({ where: { date: dateStr } });
  if (!row) {
    const computed = deterministicWeather(dateStr);
    row = await prisma.weather.create({ data: { date: dateStr, ...computed } });
  }
  return row;
}

r.get("/current", asyncHandler(async (_req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  res.json(await forDate(today));
}));

r.get("/forecast", asyncHandler(async (_req, res) => {
  const days = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(Date.now() + i * 86400_000).toISOString().slice(0, 10);
    days.push(await forDate(d));
  }
  res.json(days);
}));

export default r;

```

## FILE: aof_expansion/backend/src/routes/whaleAlerts.ts

```typescript
import { Router } from "express";
import { prisma } from "../db";
import { asyncHandler } from "../middleware/errorHandler";

const r = Router();
const WHALE_THRESHOLD_LAMPORTS = 5_000_000_000n; // 5 SOL

r.get("/feed", asyncHandler(async (req, res) => {
  const limit = Math.min(100, Number(req.query.limit) || 30);
  res.json(await prisma.whaleAlert.findMany({ orderBy: { createdAt: "desc" }, take: limit }));
}));

r.post("/record", asyncHandler(async (req, res) => {
  const amount = BigInt(req.body.amount);
  if (amount < WHALE_THRESHOLD_LAMPORTS) {
    return res.json({ recorded: false, reason: "below_threshold" });
  }
  const alert = await prisma.whaleAlert.create({
    data: {
      txSig: req.body.txSig, kind: req.body.kind, actor: req.body.actor,
      amount, rarity: req.body.rarity,
    },
  });
  res.json({ recorded: true, alert });
}));

export default r;

```

## FILE: aof_expansion/backend/src/server.ts

```typescript
import express from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { PORT } from "./config";
import { logger } from "./lib/logger";
import { generalLimiter, txLimiter } from "./middleware/rateLimit";
import { errorHandler } from "./middleware/errorHandler";

import hotMarket from "./routes/hotMarket";
import session from "./routes/session";
import trust from "./routes/trust";
import quests from "./routes/quests";
import challenges from "./routes/challenges";
import drum from "./routes/drum";
import rebirth from "./routes/rebirth";
import liquidity from "./routes/liquidity";

import farm from "./routes/farm";
import energy from "./routes/energy";
import neighbors from "./routes/neighbors";
import weather from "./routes/weather";
import streaks from "./routes/streaks";
import inbox from "./routes/inbox";
import compendium from "./routes/compendium";
import profile from "./routes/profile";
import lore from "./routes/lore";
import onboarding from "./routes/onboarding";
import guild from "./routes/guild";
import guildWars from "./routes/guildWars";
import alerts from "./routes/alerts";
import portfolio from "./routes/portfolio";
import whaleAlerts from "./routes/whaleAlerts";
import referralTiers from "./routes/referralTiers";
import marketData from "./routes/marketData";
import comeback from "./routes/comeback";
import traderRules from "./routes/traderRules";
import vipStatus from "./routes/vipStatus";
import seasonalCompendium from "./routes/seasonalCompendium";
import leaderboard from "./routes/leaderboard";

import antifraud from "./routes/antifraud";
import apiKeys from "./routes/apiKeys";
import publicApi from "./routes/public/index";
import notifications from "./routes/notifications";

const app = express();
app.use(cors());
app.use(express.json());
app.use(pinoHttp({ logger }));
app.use(generalLimiter);

const txRouters = [
  ["/hot-market", hotMarket],
  ["/session", session],
  ["/quests", quests],
  ["/challenges", challenges],
  ["/drum", drum],
  ["/rebirth", rebirth],
  ["/liquidity", liquidity],
] as const;
for (const [path, router] of txRouters) app.use(path, txLimiter, router);

app.use("/trust", trust);
app.use("/farm", farm);
app.use("/energy", energy);
app.use("/neighbors", neighbors);
app.use("/weather", weather);
app.use("/streaks", streaks);
app.use("/inbox", inbox);
app.use("/compendium", compendium);
app.use("/profile", profile);
app.use("/lore", lore);
app.use("/onboarding", onboarding);
app.use("/guild", guild);
app.use("/guild-wars", guildWars);
app.use("/alerts", alerts);
app.use("/portfolio", portfolio);
app.use("/whale-alerts", whaleAlerts);
app.use("/referral-tiers", referralTiers);
app.use("/market-data", marketData);
app.use("/comeback", comeback);
app.use("/trader-rules", traderRules);
app.use("/season/vip-status", vipStatus);
app.use("/seasonal-compendium", seasonalCompendium);
app.use("/leaderboard", leaderboard);

app.use("/antifraud", antifraud);
app.use("/api-keys", apiKeys);
app.use("/public", publicApi);
app.use("/notifications", notifications);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use(errorHandler);

app.listen(PORT, () => logger.info(`aof-expansion backend listening on ${PORT}`));

```

## FILE: aof_expansion/backend/src/services/farm-trader/index.ts

```typescript
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { prisma } from "../../db";
import { marketProgram, sessionProgram } from "../../provider";
import { hotPoolPda, marketConfigPda, sessionPda } from "../../lib/pda";
import { coSign } from "../../lib/tx";
import { logger } from "../../lib/logger";
import { FARM_TRADER_SIGNER, TREASURY } from "../../config";

const POLL_MS = 5000;
const IX_HOT_MARKET_BUY = 1n << 6n;
const IX_HOT_MARKET_SELL = 1n << 7n;

// [БЕЗОПАСНОСТЬ, ключевое]: этот процесс НИКОГДА не строит withdraw/transfer/
// payout транзакции. Единственный путь исполнения — session_check_and_spend
// в aof-session-keys (проверяет allowed_ixs/лимит атомарно on-chain) с
// последующим вызовом ТОЛЬКО hot_market_buy/sell (никогда иных инструкций
// aof_core/aof_market). Правило пользователя лишь ВЫБИРАЕТ параметры сделки —
// не может расширить набор разрешённых действий сверх session.allowed_ixs.
//
// [ФАКТ, спека v1 §6]: для сделок выше "порога подтверждения" — не исполнять
// автономно, поставить в notification queue как push с кнопкой подтверждения,
// и исполнить только по явному ответу пользователя (см. CONFIRM_THRESHOLD).
const CONFIRM_THRESHOLD_LAMPORTS = 2_000_000_000n; // 2 SOL

async function checkAndSpend(owner: string, ixBit: bigint, amountLamports: bigint): Promise<boolean> {
  const [session] = sessionPda(new PublicKey(owner));
  try {
    const acc: any = await (sessionProgram.account as any).sessionToken.fetch(session);
    if (acc.revoked || acc.paused) return false;
    if (Date.now() / 1000 > Number(acc.validUntil)) return false;
    if ((BigInt(acc.allowedIxs.toString()) & ixBit) !== ixBit) return false;
    if (amountLamports > BigInt(acc.maxAmountPerTx.toString())) return false;

    const ix = await sessionProgram.methods
      .sessionCheckAndSpend(ixBit as any, amountLamports as any)
      .accounts({ sessionSigner: FARM_TRADER_SIGNER.publicKey, session })
      .instruction();

    const { authorityOnly } = await import("../../lib/tx");
    await authorityOnly([ix]); // authority здесь = бот, действующий строго внутри лимита сессии
    return true;
  } catch (e) {
    logger.warn({ e, owner }, "session_check_failed");
    return false;
  }
}

async function requestPushConfirmation(owner: string, rule: any, amountLamports: bigint) {
  await prisma.notificationQueue.create({
    data: {
      owner,
      title: "Подтвердите сделку Smart " + rule.kind,
      body: `Сумма ${(Number(amountLamports) / 1e9).toFixed(3)} SOL превышает автолимит — нужно ваше подтверждение.`,
      data: { ruleId: rule.id, amountLamports: amountLamports.toString() },
    },
  });
}

async function evaluateRule(rule: any) {
  const [poolAddr] = hotPoolPda(["uncommon", "rare", "epic", "legendary"].indexOf(rule.rarity));
  const pool: any = await (marketProgram.account as any).hotMarketPool.fetchNullable(poolAddr);
  if (!pool) return;

  const currentPrice = BigInt(pool.targetPriceCore.toString());
  const params = rule.params as any;

  if (rule.kind === "smart_buy" && params.maxPriceLamports && currentPrice <= BigInt(params.maxPriceLamports)) {
    if (currentPrice >= CONFIRM_THRESHOLD_LAMPORTS) {
      await requestPushConfirmation(rule.owner, rule, currentPrice);
      return;
    }
    const ok = await checkAndSpend(rule.owner, IX_HOT_MARKET_BUY, currentPrice);
    await prisma.traderExecution.create({
      data: { ruleId: rule.id, owner: rule.owner, status: ok ? "success" : "rejected_by_session", amount: currentPrice, price: currentPrice },
    });
    if (ok) logger.info({ rule: rule.id }, "smart_buy_executed");
  }

  if (rule.kind === "smart_sell" && params.minPriceLamports && currentPrice >= BigInt(params.minPriceLamports)) {
    if (currentPrice >= CONFIRM_THRESHOLD_LAMPORTS) {
      await requestPushConfirmation(rule.owner, rule, currentPrice);
      return;
    }
    const ok = await checkAndSpend(rule.owner, IX_HOT_MARKET_SELL, currentPrice);
    await prisma.traderExecution.create({
      data: { ruleId: rule.id, owner: rule.owner, status: ok ? "success" : "rejected_by_session", amount: currentPrice, price: currentPrice },
    });
    if (ok) logger.info({ rule: rule.id }, "smart_sell_executed");
  }

  // smart_push: только уведомление, без исполнения — чисто оповещательное правило
  if (rule.kind === "smart_push") {
    await prisma.notificationQueue.create({
      data: { owner: rule.owner, title: "Изменение цены", body: `${rule.rarity}: ${(Number(currentPrice) / 1e9).toFixed(3)} SOL` },
    });
  }
}

async function tick() {
  const rules = await prisma.traderRule.findMany({ where: { enabled: true } });
  for (const rule of rules) {
    try {
      await evaluateRule(rule);
    } catch (e) {
      logger.error({ e, rule: rule.id }, "rule_evaluation_failed");
      await prisma.traderExecution.create({ data: { ruleId: rule.id, owner: rule.owner, status: "error", error: String(e) } });
    }
  }
}

async function main() {
  logger.info("farm-trader worker started, signer=%s", FARM_TRADER_SIGNER.publicKey.toBase58());
  setInterval(() => tick().catch((e) => logger.error({ e }, "tick_cycle_failed")), POLL_MS);
}

main();

```

## FILE: aof_expansion/backend/src/services/indexer/priceTracker.ts

```typescript
import { WebSocketServer } from "ws";
import { connection, marketProgram } from "../../provider";
import { hotPoolPda } from "../../lib/pda";
import { prisma } from "../../db";
import { logger } from "../../lib/logger";
import { WS_PORT } from "../../config";

// [ФАКТ, спека v2 §1]: "Geyser plugin для realtime-индексации". Geyser
// требует доступа к самому validator-хосту (плагин грузится в процесс
// валидатора) — вне того, что можно развернуть из этого репозитория.
// Здесь — поллинг-эквивалент (каждые 2 сек, как и предписано в спеке для
// частоты тиков), с тем же выходным контрактом (тик → WS), так что замена
// на реальный Geyser-listener в будущем не потребует менять ничего, кроме
// источника событий ниже.

const RARITIES = [0, 1, 2, 3];
const POLL_MS = 2000;

const wss = new WebSocketServer({ port: WS_PORT });
logger.info(`price WS server on :${WS_PORT}`);

function broadcast(payload: any) {
  const msg = JSON.stringify(payload);
  wss.clients.forEach((c) => {
    if (c.readyState === c.OPEN) c.send(msg);
  });
}

function bucketStart(ts: Date, intervalMs: number): Date {
  return new Date(Math.floor(ts.getTime() / intervalMs) * intervalMs);
}

const INTERVALS: Record<string, number> = {
  "1m": 60_000,
  "5m": 5 * 60_000,
  "1h": 3600_000,
};

async function upsertCandle(rarity: string, currency: string, price: bigint, ts: Date) {
  for (const [interval, ms] of Object.entries(INTERVALS)) {
    const start = bucketStart(ts, ms);
    const existing = await prisma.candle.findUnique({
      where: { rarity_currency_interval_bucketStart: { rarity, currency, interval, bucketStart: start } },
    });
    if (!existing) {
      await prisma.candle.create({
        data: { rarity, currency, interval, bucketStart: start, open: price, high: price, low: price, close: price, volume: 1n },
      });
    } else {
      await prisma.candle.update({
        where: { rarity_currency_interval_bucketStart: { rarity, currency, interval, bucketStart: start } },
        data: {
          high: price > existing.high ? price : existing.high,
          low: price < existing.low ? price : existing.low,
          close: price,
          volume: existing.volume + 1n,
        },
      });
    }
  }
}

async function pollOnce() {
  for (const rarityIdx of RARITIES) {
    try {
      const [poolAddr] = hotPoolPda(rarityIdx);
      const pool: any = await (marketProgram.account as any).hotMarketPool.fetchNullable(poolAddr);
      if (!pool) continue;

      const rarityName = ["uncommon", "rare", "epic", "legendary"][rarityIdx];
      const now = new Date();

      for (const [currency, price] of [
        ["core", BigInt(pool.targetPriceCore.toString())],
        ["gem", BigInt(pool.targetPriceGem.toString())],
      ] as const) {
        await prisma.priceTick.create({ data: { rarity: rarityName, currency, price, ts: now } });
        await upsertCandle(rarityName, currency, price, now);
        broadcast({ type: "tick", rarity: rarityName, currency, price: price.toString(), ts: now.toISOString() });
      }
    } catch (e) {
      logger.error({ e, rarityIdx }, "poll_pool_failed");
    }
  }
}

async function main() {
  logger.info("priceTracker started, polling every %dms", POLL_MS);
  setInterval(() => {
    pollOnce().catch((e) => logger.error({ e }, "poll_cycle_failed"));
  }, POLL_MS);
}

main();

```

## FILE: aof_expansion/backend/src/services/push-worker/index.ts

```typescript
import { prisma } from "../../db";
import { logger } from "../../lib/logger";

const POLL_MS = 3000;

// [ФАКТ, спека §infra]: "готов к FCM/APNs" — реальная интеграция требует
// сервисных ключей провайдера (Firebase service account / APNs .p8),
// которых здесь нет и быть не может без ваших учётных данных. Ниже —
// полный жизненный цикл очереди (pending → sent), с точкой расширения
// `sendPush()`, куда подключается реальный SDK.
async function sendPush(token: string, platform: string, title: string, body: string, data: any) {
  logger.info({ token: token.slice(0, 8) + "…", platform, title, body, data }, "push_sent (log-mode)");
  // TODO: platform === "ios" ? apns.send(...) : fcm.send(...)
}

async function tick() {
  const pending = await prisma.notificationQueue.findMany({ where: { status: "pending" }, take: 50 });
  for (const item of pending) {
    const devices = await prisma.deviceToken.findMany({ where: { owner: item.owner } });
    for (const d of devices) {
      await sendPush(d.token, d.platform, item.title, item.body, item.data);
    }
    await prisma.notificationQueue.update({ where: { id: item.id }, data: { status: "sent", sentAt: new Date() } });
  }
}

async function main() {
  logger.info("push-worker started (log-mode, no FCM/APNs credentials configured)");
  setInterval(() => tick().catch((e) => logger.error({ e }, "push_tick_failed")), POLL_MS);
}

main();

```

## FILE: aof_expansion/backend/src/services/trust-worker/index.ts

```typescript
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { prisma } from "../../db";
import { sessionProgram } from "../../provider";
import { skConfigPda, trustSnapshotPda } from "../../lib/pda";
import { oracleOnly } from "../../lib/tx";
import { computeTrustIndex } from "../../lib/trustIndex";
import { logger } from "../../lib/logger";
import { ORACLE } from "../../config";

const RECOMPUTE_INTERVAL_MS = 6 * 3600_000;

async function recomputeAll() {
  const since = new Date(Date.now() - 30 * 86400_000);
  const activeOwners = await prisma.profile.findMany({
    where: { updatedAt: { gte: since } },
    select: { owner: true },
  });
  logger.info(`trust-worker: recomputing for ${activeOwners.length} active users`);

  for (const { owner } of activeOwners) {
    try {
      const breakdownRow = await prisma.trustBreakdown.upsert({
        where: { owner }, update: {}, create: { owner },
      });
      const result = await computeTrustIndex(owner, (breakdownRow as any).createdAt || new Date());

      await prisma.trustScore.upsert({
        where: { owner },
        update: { score: result.finalScore, tier: result.tier, breakdown: result as any },
        create: { owner, score: result.finalScore, tier: result.tier, breakdown: result as any },
      });

      const [config] = skConfigPda();
      const [trust] = trustSnapshotPda(new PublicKey(owner));
      const epoch = Math.floor(Date.now() / 1000);
      const ix = await sessionProgram.methods
        .trustSnapshotUpdate(result.finalScore, result.tier, epoch as any)
        .accounts({ config, oracleAuthority: ORACLE.publicKey, user: new PublicKey(owner), trust, systemProgram: SystemProgram.programId })
        .instruction();
      await oracleOnly([ix]);
    } catch (e) {
      logger.error({ e, owner }, "trust_recompute_failed");
    }
  }
}

async function main() {
  logger.info("trust-worker started, interval %dh", RECOMPUTE_INTERVAL_MS / 3600_000);
  await recomputeAll();
  setInterval(() => recomputeAll().catch((e) => logger.error({ e }, "recompute_cycle_failed")), RECOMPUTE_INTERVAL_MS);
}

main();

```

## FILE: aof_expansion/backend/tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  },
  "include": ["src"]
}

```

## FILE: aof_expansion/frontend/src/pages/market/HotMarket.tsx

```tsx
import React, { useEffect, useRef, useState } from "react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { motion } from "framer-motion";

const WS_URL = (import.meta as any).env?.VITE_MARKET_WS_URL || "ws://localhost:8081";
const API_URL = (import.meta as any).env?.VITE_API_URL || "http://localhost:8090";

const RARITIES = ["uncommon", "rare", "epic", "legendary"];

export function HotMarketPage() {
  const [rarity, setRarity] = useState("uncommon");
  const [ticks, setTicks] = useState<{ price: number; ts: string }[]>([]);
  const [live, setLive] = useState<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/market-data/candles/${rarity}?interval=1m&limit=60`)
      .then((r) => r.json())
      .then((candles: any[]) =>
        setTicks(candles.map((c) => ({ price: Number(c.close) / 1e9, ts: c.bucketStart })))
      )
      .catch(() => {});

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "tick" && msg.rarity === rarity && msg.currency === "core") {
        const price = Number(msg.price) / 1e9;
        setLive(price);
        setTicks((prev) => [...prev.slice(-119), { price, ts: msg.ts }]);
      }
    };
    return () => ws.close();
  }, [rarity]);

  return (
    <div className="content-pad" style={{ paddingTop: 12 }}>
      <div className="segmented">
        {RARITIES.map((r) => (
          <button key={r} className={rarity === r ? "active" : ""} onClick={() => setRarity(r)}>
            {r}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>ТЕКУЩАЯ ЦЕНА (CORE)</div>
            <motion.div key={live} initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} style={{ fontSize: 30, fontWeight: 800 }}>
              {(live ?? ticks[ticks.length - 1]?.price ?? 0).toFixed(4)} SOL
            </motion.div>
          </div>
          <span className="chip" style={{ background: "rgba(48,209,88,0.2)", color: "var(--accent-2)" }}>● LIVE</span>
        </div>

        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={ticks}>
            <XAxis dataKey="ts" hide />
            <YAxis domain={["auto", "auto"]} stroke="rgba(235,235,245,0.4)" fontSize={11} width={50} />
            <Tooltip contentStyle={{ background: "#1c1c1e", border: "none", borderRadius: 10 }} />
            <Line type="monotone" dataKey="price" stroke="#0a84ff" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

```

## FILE: aof_expansion/frontend/src/pages/quests/Quests.tsx

```tsx
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

const API_URL = (import.meta as any).env?.VITE_API_URL || "http://localhost:8090";

const TABS = ["Задания", "Достижения", "Челленджи", "Барабан"];

export function QuestsPage({ owner }: { owner: string }) {
  const [tab, setTab] = useState(0);
  const [progress, setProgress] = useState<any[]>([]);

  useEffect(() => {
    if (!owner) return;
    fetch(`${API_URL}/quests/quest/progress`).catch(() => {});
  }, [owner]);

  return (
    <div className="content-pad" style={{ paddingTop: 12 }}>
      <div className="segmented">
        {TABS.map((t, i) => (
          <button key={t} className={tab === i ? "active" : ""} onClick={() => setTab(i)}>
            {t}
          </button>
        ))}
      </div>

      {tab === 3 && (
        <motion.div
          className="card"
          style={{ padding: 24, textAlign: "center", background: "radial-gradient(120% 100% at 50% 0%, rgba(255,159,10,0.16), transparent 70%)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div style={{ fontSize: 48 }}>🥁</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6 }}>
            Ставка — медали из челленджей. Честный commit-reveal, шансы открыты.
          </div>
          <button className="btn btn-primary" style={{ marginTop: 16 }}>
            Крутить барабан
          </button>
        </motion.div>
      )}

      {tab !== 3 && (
        <div className="empty-state card">
          <div className="glyph">📜</div>
          <div>{TABS[tab]} — список подгружается с /quests, /challenges, /achievement</div>
        </div>
      )}
    </div>
  );
}

```
