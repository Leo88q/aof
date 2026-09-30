use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{self, Token, TokenAccount, Mint, Transfer};

pub mod state;
pub mod errors;
pub mod events;
pub mod pricing;
pub mod tools;

pub use state::*;
pub use errors::*;
pub use events::*;

declare_id!("4BhD6spJHdvHQ9mgyaU6AUSLU37oJbTMCDcAXyWhMRVo");

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
    /// Canonical upgrade authority for the one-time market-config bootstrap.
    #[account(address = Pubkey::find_program_address(
        &[crate::ID.as_ref()],
        &anchor_lang::solana_program::bpf_loader_upgradeable::id()
    ).0)]
    pub program_data: Account<'info, anchor_lang::ProgramData>,
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

// =====================================================================
// [AUDIT F-02] Two-step authority rotation
// =====================================================================

#[derive(Accounts)]
pub struct SetPendingAuthority<'info> {
    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump, has_one = authority @ MarketError::Unauthorized)]
    pub config: Account<'info, MarketConfig>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct AcceptAuthority<'info> {
    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump = config.bump,
        constraint = config.pending_authority == new_authority.key() @ MarketError::NotPendingAuthority
    )]
    pub config: Account<'info, MarketConfig>,
    pub new_authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct CancelPendingAuthority<'info> {
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
    #[account(
        mut,
        constraint = treasury_currency.mint == currency_mint.key(),
        constraint = treasury_currency.owner == config.treasury @ MarketError::Unauthorized
    )]
    pub treasury_currency: Account<'info, TokenAccount>,
    pub new_tool_mint: Account<'info, Mint>,
    #[account(
        mut,
        constraint = pool_tool.mint == new_tool_mint.key(),
        constraint = pool_tool.owner == pool.key(),
        constraint = pool_tool.amount >= 1
    )]
    pub pool_tool: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = buyer_tool.mint == new_tool_mint.key(),
        constraint = buyer_tool.owner == buyer.key()
    )]
    pub buyer_tool: Account<'info, TokenAccount>,
    /// Резерв пула: сюда приходит цена за вычетом комиссии, отсюда пул платит
    /// продавцам (`hot_market_sell_into_queue`).
    #[account(
        mut,
        constraint = pool_currency.mint == currency_mint.key(),
        constraint = pool_currency.owner == pool.key()
    )]
    pub pool_currency: Account<'info, TokenAccount>,
    /// CHECK: канонический ToolData (PDA aof_core) продаваемого инструмента —
    /// проверяется в `tools::read_canonical_tool` и правится CPI ниже.
    #[account(mut, constraint = *tool_data.owner == aof_core::ID @ MarketError::InvalidInput)]
    pub tool_data: UncheckedAccount<'info>,
    /// Программа aof_core — единственная, кто может синхронизировать
    /// ToolData.owner с переводом NFT (typed CPI, чеклист #4).
    #[account(address = aof_core::ID)]
    pub core_program: Program<'info, aof_core::program::AofCore>,
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
    #[account(
        mut,
        constraint = pool_currency.mint == currency_mint.key(),
        constraint = pool_currency.owner == pool.key()
    )]
    pub pool_currency: Account<'info, TokenAccount>,
    pub sold_tool_mint: Account<'info, Mint>,
    #[account(
        mut,
        constraint = seller_tool.mint == sold_tool_mint.key(),
        constraint = seller_tool.owner == seller.key(),
        constraint = seller_tool.amount >= 1
    )]
    pub seller_tool: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = pool_tool.mint == sold_tool_mint.key(),
        constraint = pool_tool.owner == pool.key()
    )]
    pub pool_tool: Account<'info, TokenAccount>,
    /// Казна получает комиссию пула: её ATA проверяется по config.treasury.
    #[account(
        mut,
        constraint = treasury_currency.mint == currency_mint.key(),
        constraint = treasury_currency.owner == config.treasury @ MarketError::Unauthorized
    )]
    pub treasury_currency: Account<'info, TokenAccount>,
    /// CHECK: канонический ToolData (PDA aof_core) продаваемого инструмента —
    /// проверяется в `tools::read_canonical_tool`, владение меняет CPI.
    #[account(mut, constraint = *tool_data.owner == aof_core::ID @ MarketError::InvalidInput)]
    pub tool_data: UncheckedAccount<'info>,
    /// Программа aof_core (см. `HotMarketBuy`).
    #[account(address = aof_core::ID)]
    pub core_program: Program<'info, aof_core::program::AofCore>,
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
        let upgrade_authority = ctx
            .accounts
            .program_data
            .upgrade_authority_address
            .ok_or(MarketError::Unauthorized)?;
        require_keys_eq!(upgrade_authority, ctx.accounts.authority.key(), MarketError::Unauthorized);
        require!(fee_bps <= 1_000, MarketError::InvalidFee);
        let c = &mut ctx.accounts.config;
        c.authority = ctx.accounts.authority.key();
        c.treasury = ctx.accounts.treasury.key();
        c.core_mint = ctx.accounts.core_mint.key();
        c.gem_mint = ctx.accounts.gem_mint.key();
        c.fee_bps = fee_bps;
        c.paused = false;
        c.bump = ctx.bumps.config;
        // [AUDIT F-02] no rotation in flight at bootstrap.
        c.pending_authority = Pubkey::default();
        c.authority_updated_at = Clock::get()?.unix_timestamp;
        Ok(())
    }

    // ===== [AUDIT F-02] two-step authority rotation =====
    pub fn set_pending_authority(ctx: Context<SetPendingAuthority>, new_authority: Pubkey) -> Result<()> {
        require!(new_authority != Pubkey::default(), MarketError::InvalidInput);
        let c = &mut ctx.accounts.config;
        let previous = c.authority;
        c.pending_authority = new_authority;
        emit!(AuthorityRotationProposed {
            previous,
            next: new_authority,
            at: Clock::get()?.unix_timestamp,
        });
        Ok(())
    }

    pub fn accept_authority(ctx: Context<AcceptAuthority>) -> Result<()> {
        let c = &mut ctx.accounts.config;
        require!(c.pending_authority != Pubkey::default(), MarketError::NoPendingAuthority);
        let previous = c.authority;
        let next = ctx.accounts.new_authority.key();
        let now = Clock::get()?.unix_timestamp;
        c.authority = next;
        c.pending_authority = Pubkey::default();
        c.authority_updated_at = now;
        emit!(AuthorityChanged { previous, next, at: now });
        Ok(())
    }

    pub fn cancel_pending_authority(ctx: Context<CancelPendingAuthority>) -> Result<()> {
        let c = &mut ctx.accounts.config;
        require!(c.pending_authority != Pubkey::default(), MarketError::NoPendingAuthority);
        let cancelled = c.pending_authority;
        c.pending_authority = Pubkey::default();
        emit!(AuthorityRotationCancelled {
            authority: ctx.accounts.authority.key(),
            cancelled,
            slot: Clock::get()?.slot,
        });
        Ok(())
    }

    pub fn set_fees(ctx: Context<SetFees>, fee_bps: u16) -> Result<()> {
        require!(fee_bps <= 1_000, MarketError::InvalidFee);
        ctx.accounts.config.fee_bps = fee_bps;
        emit!(GlobalFeesUpdated { authority: ctx.accounts.authority.key(), fee_bps });
        Ok(())
    }

    pub fn set_paused(ctx: Context<SetPaused>, paused: bool) -> Result<()> {
        ctx.accounts.config.paused = paused;
        emit!(GlobalPausedUpdated { authority: ctx.accounts.authority.key(), paused });
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
        require!(target_price_core > 0 && target_price_gem > 0, MarketError::ZeroPrice);
        require!(fee_bps <= 1_000, MarketError::InvalidFee);
        require!(decay_bps_per_hour <= 10_000, MarketError::InvalidRate);
        require!(growth_bps_per_sale <= 10_000, MarketError::InvalidRate);
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

    /// Покупка инструмента из инвентаря пула.
    ///
    /// Инструмент уходит покупателю вместе с владением: NFT переводит
    /// `aof_core::transfer_tool`, которую пул вызывает через CPI со своими
    /// seeds. Поэтому купленный инструмент сразу можно майнить и ремонтировать.
    pub fn hot_market_buy(ctx: Context<HotMarketBuy>, rarity: u8, currency: Currency, max_price: u64) -> Result<()> {
        rarity_index_ok(rarity)?;
        require!(rarity == ctx.accounts.pool.rarity, MarketError::InvalidInput);
        require!(max_price > 0, MarketError::SlippageExceeded);

        // 1. В пуле лежит канонический инструмент этой редкости.
        let pool_key = ctx.accounts.pool.key();
        crate::tools::read_canonical_tool(
            &ctx.accounts.tool_data,
            ctx.accounts.new_tool_mint.key(),
            pool_key,
            rarity,
        )?;

        // 2. Цена считается on-chain: покупатель подписал только потолок.
        let now = Clock::get()?.unix_timestamp;
        let price = crate::tools::pool_price(&ctx.accounts.pool, currency, now)?;
        require!(price <= max_price, MarketError::SlippageExceeded);
        let fee_bps = ctx.accounts.pool.fee_bps;
        let (to_pool, fee) = crate::tools::fee_split(price, fee_bps)?;
        require!(ctx.accounts.buyer_currency.amount >= price, MarketError::InsufficientReserve);

        // 3. Оплата до синхронизации владения: без денег инструмент не уходит.
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.buyer_currency.to_account_info(),
                    to: ctx.accounts.pool_currency.to_account_info(),
                    authority: ctx.accounts.buyer.to_account_info(),
                },
            ),
            to_pool,
        )?;
        if fee > 0 {
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.buyer_currency.to_account_info(),
                        to: ctx.accounts.treasury_currency.to_account_info(),
                        authority: ctx.accounts.buyer.to_account_info(),
                    },
                ),
                fee,
            )?;
        }

        // 4. NFT + ToolData.owner одной инструкцией aof_core. Пул объявлен как
        // `bump = pool.bump`, поэтому канонический bump лежит в самом аккаунте
        // (Anchor не добавляет его в ctx.bumps для явно заданного bump).
        let bump = ctx.accounts.pool.bump;
        let rarity_seed = [rarity];
        let seeds: &[&[u8]] = &[POOL_SEED, &rarity_seed, &[bump]];
        crate::tools::transfer_tool_cpi(
            ctx.accounts.core_program.to_account_info(),
            ctx.accounts.pool.to_account_info(),
            ctx.accounts.new_tool_mint.to_account_info(),
            ctx.accounts.pool_tool.to_account_info(),
            ctx.accounts.buyer.to_account_info(),
            ctx.accounts.buyer_tool.to_account_info(),
            ctx.accounts.tool_data.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
            Some(&[seeds]),
        )?;

        // 5. Сделка двигает цену следующей: спрос растёт, простой обнуляется.
        let pool = &mut ctx.accounts.pool;
        pool.purchases_in_window = pool.purchases_in_window.saturating_add(1);
        pool.sold_since_start = pool.sold_since_start.saturating_add(1);
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

    /// Продажа инструмента в пул: игрок задаёт только минимум цены.
    ///
    /// Пул платит из своего резерва, инструмент уходит в инвентарь пула, а
    /// владение снова синхронизирует `aof_core::transfer_tool` (подписант —
    /// сам продавец). Продажа добавляет предложение и снижает цену следующей
    /// покупки.
    pub fn hot_market_sell_into_queue(ctx: Context<HotMarketSell>, rarity: u8, currency: Currency, min_price: u64) -> Result<()> {
        rarity_index_ok(rarity)?;
        require!(rarity == ctx.accounts.pool.rarity, MarketError::InvalidInput);
        require!(min_price > 0, MarketError::SlippageExceeded);

        // 1. Продаётся канонический инструмент, которым продавец владеет и
        //    распоряжается (не в стейке, не в майнинге, не в аренде).
        let seller_key = ctx.accounts.seller.key();
        crate::tools::read_canonical_tool(
            &ctx.accounts.tool_data,
            ctx.accounts.sold_tool_mint.key(),
            seller_key,
            rarity,
        )?;

        // 2. Цена и резерв пула.
        let now = Clock::get()?.unix_timestamp;
        let price = crate::tools::pool_price(&ctx.accounts.pool, currency, now)?;
        require!(price >= min_price, MarketError::SlippageExceeded);
        let fee_bps = ctx.accounts.pool.fee_bps;
        let (payout, fee) = crate::tools::fee_split(price, fee_bps)?;
        require!(ctx.accounts.pool_currency.amount >= price, MarketError::InsufficientReserve);

        // 3. Инструмент → пул вместе с владением (подпись продавца).
        crate::tools::transfer_tool_cpi(
            ctx.accounts.core_program.to_account_info(),
            ctx.accounts.seller.to_account_info(),
            ctx.accounts.sold_tool_mint.to_account_info(),
            ctx.accounts.seller_tool.to_account_info(),
            ctx.accounts.pool.to_account_info(),
            ctx.accounts.pool_tool.to_account_info(),
            ctx.accounts.tool_data.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
            None,
        )?;

        // 4. Выплата продавцу и комиссия казне из резерва пула. Тот же
        // канонический bump, что и в покупке (см. HotMarketBuy).
        let bump = ctx.accounts.pool.bump;
        let rarity_seed = [rarity];
        let seeds: &[&[u8]] = &[POOL_SEED, &rarity_seed, &[bump]];
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
            payout,
        )?;
        if fee > 0 {
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.pool_currency.to_account_info(),
                        to: ctx.accounts.treasury_currency.to_account_info(),
                        authority: ctx.accounts.pool.to_account_info(),
                    },
                    &[seeds],
                ),
                fee,
            )?;
        }

        // 5. Предложение выросло — цена следующей покупки ниже.
        let pool = &mut ctx.accounts.pool;
        pool.purchases_in_window = pool.purchases_in_window.saturating_sub(1);
        pool.last_trade_ts = now;
        emit!(HotMarketSold {
            seller: seller_key,
            rarity,
            currency,
            price,
        });
        Ok(())
    }

    pub fn start_market_event(ctx: Context<StartEvent>, rarity: u8, duration_seconds: i64, multiplier_bps: u16) -> Result<()> {
        rarity_index_ok(rarity)?;
        require!(duration_seconds > 0 && duration_seconds <= 24 * 3600, MarketError::InvalidWindowDuration);
        require!(multiplier_bps <= 50_000, MarketError::InvalidRate);
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
        // [AUDIT F-26] `now - pool.last_trade_ts` panicked on a backwards clock
        // (validator clock skew / a pool seeded from a future timestamp).
        let hours_idle = now.saturating_sub(pool.last_trade_ts) / 3600;
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
        // No matching/settlement instruction exists yet; accepting orders
        // would create misleading or permanently locked positions.
        // Argument names are preserved for IDL stability, so every argument is
        // intentionally unused because the instruction is disabled.
        let _ = (ctx, rarity, currency, is_buy, limit_price, amount);
        err!(MarketError::TradingDisabled)
    }

    pub fn cancel_limit_order(ctx: Context<CancelLimitOrder>, rarity: u8) -> Result<()> {
        rarity_index_ok(rarity)?;
        require!(ctx.accounts.order.active, MarketError::OrderNotActive);
        let maker_key = ctx.accounts.maker.key();
        let is_buy = ctx.accounts.order.is_buy;
        let limit_price = ctx.accounts.order.limit_price;
        let amount_escrowed = ctx.accounts.order.amount_escrowed;
        let bump = ctx.bumps.order;
        // SW008: effects-before-interactions — flip the order state *before* the
        // SPL CPI. Reload only the token accounts mutated by SPL below,
        // NEVER the order (reload would discard this in-memory state change).
        ctx.accounts.order.active = false;
        let mut refunded: u64 = 0;
        if is_buy {
            let seeds: &[&[u8]] = &[LIMIT_ORDER_SEED, maker_key.as_ref(), &[rarity], &[bump]];
            let refund = limit_price.checked_mul(amount_escrowed).ok_or(MarketError::MathOverflow)?;
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
            ctx.accounts.order_vault.reload()?;
            ctx.accounts.maker_currency.reload()?;
            refunded = refund;
        }
        emit!(LimitOrderCancelled { maker: maker_key, rarity, refunded });
        Ok(())
    }
}

#[cfg(test)]
mod reload_tests {
    use super::*;
    use anchor_lang::solana_program::{program_option::COption, program_pack::Pack};

    #[test]
    fn spl_account_cache_is_stale_until_reload() {
        // Simulate the data mutation performed by SPL CPI. This is a host unit
        // test of Anchor's cache semantics, not validator transaction evidence.
        let key = Pubkey::new_unique();
        let owner = anchor_spl::token::ID;
        let mut lamports = 1_000_000;
        let mut bytes = vec![0; anchor_spl::token::spl_token::state::Account::LEN];
        let mut raw = anchor_spl::token::spl_token::state::Account {
            mint: Pubkey::new_unique(), owner: Pubkey::new_unique(), amount: 100,
            delegate: COption::None,
            state: anchor_spl::token::spl_token::state::AccountState::Initialized,
            is_native: COption::None, delegated_amount: 0, close_authority: COption::None,
        };
        anchor_spl::token::spl_token::state::Account::pack(raw, &mut bytes).unwrap();
        let info = AccountInfo::new(&key, false, true, &mut lamports, &mut bytes, &owner, false, 0);
        let mut cached = Account::<TokenAccount>::try_from(&info).unwrap();
        raw.amount = 40;
        anchor_spl::token::spl_token::state::Account::pack(raw, &mut info.try_borrow_mut_data().unwrap()).unwrap();
        assert_eq!(cached.amount, 100);
        cached.reload().unwrap();
        assert_eq!(cached.amount, 40);
    }
}
