use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer, Mint};
use anchor_spl::associated_token::AssociatedToken;
use crate::state::{HotMarketPool, HotMarketQueue, SessionToken};
use crate::errors::MarketError;
use crate::events::HotMarketSellIntoQueue;

#[derive(Accounts)]
#[instruction(rarity: u8)]
pub struct SellIntoQueue<'info> {
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

    /// [ФИКС] Реальный продавец (владелец инструмента). При прямой продаже
    /// подписывает сам; при продаже через Farm-Trader не подписывает —
    /// за него это делает сессионный ключ (см. signer + session_token).
    /// CHECK: личность подтверждается совпадением с signer или через session_token
    #[account(mut)]
    pub seller: UncheckedAccount<'info>,

    /// [ФИКС] Подписант транзакции: сам продавец либо активный сессионный ключ
    #[account(mut)]
    pub signer: Signer<'info>,

    /// [ФИКС] Токен сессии: обязателен когда signer != seller (торговля через бота).
    /// PDA детерминирована парой (владелец, сессионный ключ).
    #[account(
        seeds = [b"session", seller.key().as_ref(), signer.key().as_ref()],
        bump = session_token.bump
    )]
    pub session_token: Option<Account<'info, SessionToken>>,

    #[account(mut)]
    pub tool_mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = tool_mint,
        associated_token::authority = seller
    )]
    pub seller_tool_token: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = signer,
        associated_token::mint = tool_mint,
        associated_token::authority = pool
    )]
    pub pool_tool_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn handler(ctx: Context<SellIntoQueue>, rarity: u8, min_price: u64) -> Result<()> {
    // [ФИКС] Валидация подписанта: продавец напрямую либо действующий сессионный ключ.
    // Сессия — это делегирование права исполнять конкретные инструкции с лимитом
    // по сумме и времени; сами токены двигаются через SPL-делегирование, которое
    // пользователь выдаёт боту отдельно (token::approve на ATA инструмента).
    let signer_key = ctx.accounts.signer.key();
    let seller_key = ctx.accounts.seller.key();
    if signer_key != seller_key {
        let session = ctx
            .accounts
            .session_token
            .as_ref()
            .ok_or(MarketError::InvalidSessionSigner)?;
        require!(session.authority == seller_key, MarketError::InvalidSessionSigner);
        require!(session.session_signer == signer_key, MarketError::InvalidSessionSigner);
        require!(!session.revoked, MarketError::SessionRevoked);
        require!(
            Clock::get()?.unix_timestamp <= session.valid_until,
            MarketError::SessionExpired
        );
        require!(
            session.target_program == crate::ID,
            MarketError::InvalidSessionSigner
        );
        // Битовая маска разрешённых инструкций: бит 0 = sell_into_queue
        require!(
            (session.allowed_ixs & 0b1) != 0,
            MarketError::InvalidSessionSigner
        );
    }

    // Нижняя граница цены (фикс Группы 2)
    let now = Clock::get()?.unix_timestamp;
    let current_price = ctx.accounts.pool.price_mascot(now);
    require!(current_price >= min_price, MarketError::MinPriceNotMet);

    // Перевод инструмента: подписывает signer — сам продавец или сессионный
    // ключ, которому продавец заранее выдал SPL-делегирование на этот ATA.
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.seller_tool_token.to_account_info(),
                to: ctx.accounts.pool_tool_token.to_account_info(),
                authority: ctx.accounts.signer.to_account_info(),
            },
        ),
        1,
    )?;

    let mint = ctx.accounts.tool_mint.key();
    ctx.accounts.queue.push(mint)?;

    emit!(HotMarketSellIntoQueue {
        rarity,
        seller: seller_key,
        tool: mint,
        min_price,
    });

    Ok(())
}
