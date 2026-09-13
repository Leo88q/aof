use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use crate::state::{HotMarketPool, HotMarketQueue, MascotConfig, PaymentCurrency};
use crate::errors::MarketError;
use crate::events::HotMarketBuy;

#[derive(Accounts)]
#[instruction(rarity: u8, currency: PaymentCurrency)]
pub struct BuyFromPool<'info> {
    #[account(
        mut,
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
    pub buyer: Signer<'info>,

    // [ФИКС] Option: для оплаты в SOL маскот-кошелёк покупателя не обязателен
    #[account(
        mut,
        associated_token::mint = mascot_mint,
        associated_token::authority = buyer
    )]
    pub buyer_mascot: Option<Account<'info, TokenAccount>>,

    #[account(
        address = mascot_config.mascot_mint @ MarketError::InvalidMint
    )]
    pub mascot_mint: Account<'info, Mint>,

    #[account(mut)]
    /// CHECK: SPL token аккаунт казны
    pub treasury_mascot: UncheckedAccount<'info>,

    /// CHECK: SOL-казна; адрес фиксируется конфигом, получает оплату при currency = Sol
    #[account(mut, address = mascot_config.treasury_sol @ MarketError::Unauthorized)]
    pub treasury_sol: UncheckedAccount<'info>,

    #[account(mut)]
    pub tool_mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = tool_mint,
        associated_token::authority = pool
    )]
    pub pool_tool_token: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = tool_mint,
        associated_token::authority = buyer
    )]
    pub buyer_tool_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<BuyFromPool>,
    rarity: u8,
    currency: PaymentCurrency,
    price_snapshot: u64,
    slippage_bps: u16,
) -> Result<()> {
    let queue = &ctx.accounts.queue;

    // Покупаемый инструмент должен быть первым в очереди
    let expected_tool = queue.first().ok_or(MarketError::QueueEmpty)?;
    require!(
        ctx.accounts.tool_mint.key() == expected_tool,
        MarketError::WrongTool
    );

    let pool = &ctx.accounts.pool;
    let now = Clock::get()?.unix_timestamp;
    // [ФИКС] Цена берётся из VRGDA-ветки, соответствующей валюте оплаты
    let current_price = match currency {
        PaymentCurrency::Mascot => pool.price_mascot(now),
        PaymentCurrency::Sol => pool.price_sol(now),
    };

    // Защита от проскальзывания
    let max_price = price_snapshot
        .saturating_mul(10000u64.saturating_add(slippage_bps as u64))
        / 10000;
    require!(current_price <= max_price, MarketError::PriceChanged);

    let fee = current_price.saturating_mul(pool.fee_bps as u64) / 10000;
    let _net = current_price.saturating_sub(fee);

    // [ФИКС] Две реальные ветки оплаты вместо одинокого Mascot.
    match currency {
        PaymentCurrency::Mascot => {
            let buyer_mascot = ctx
                .accounts
                .buyer_mascot
                .as_ref()
                .ok_or(MarketError::InvalidCurrency)?;
            // Перевод маскот-токена от покупателя в казну
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: buyer_mascot.to_account_info(),
                        to: ctx.accounts.treasury_mascot.to_account_info(),
                        authority: ctx.accounts.buyer.to_account_info(),
                    },
                ),
                current_price,
            )?;
        }
        PaymentCurrency::Sol => {
            // Прямой перевод SOL от покупателя в SOL-казну.
            // Вариант оплаты из предзаправленного газ-бака aof-core (CPI
            // withdraw_gas) — будущее расширение; прямой SOL эквивалентен
            // по сумме и не требует кросс-программной зависимости.
            system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer {
                        from: ctx.accounts.buyer.to_account_info(),
                        to: ctx.accounts.treasury_sol.to_account_info(),
                    },
                ),
                current_price,
            )?;
        }
    }

    // Передача инструмента покупателю (подпись пула через PDA)
    let pool_seeds = &[
        b"hot_market_pool".as_ref(),
        &[rarity],
        &[ctx.accounts.pool.bump],
    ];
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.pool_tool_token.to_account_info(),
                to: ctx.accounts.buyer_tool_token.to_account_info(),
                authority: ctx.accounts.pool.to_account_info(),
            },
            &[pool_seeds],
        ),
        1,
    )?;

    // Обновление состояния
    let pool = &mut ctx.accounts.pool;
    let queue = &mut ctx.accounts.queue;

    let sold_tool = queue.first().ok_or(MarketError::QueueEmpty)?;
    queue.advance();

    // [ФИКС] Обновляем кэш цены той валюты, в которой прошла покупка
    let grown = current_price
        .saturating_mul(10000u64.saturating_add(pool.growth_per_purchase_bps as u64))
        / 10000;
    match currency {
        PaymentCurrency::Mascot => pool.current_price_mascot = grown,
        PaymentCurrency::Sol => pool.current_price_sol_lamports = grown,
    }
    pool.last_trade_ts = now;
    pool.sold_count = pool.sold_count.saturating_add(1);
    pool.purchases_in_window = pool.purchases_in_window.saturating_add(1);

    emit!(HotMarketBuy {
        rarity,
        buyer: ctx.accounts.buyer.key(),
        tool: sold_tool,
        currency,
        price: current_price,
        fee,
    });

    Ok(())
}
