use anchor_lang::prelude::*;
use crate::state::{SessionToken, TrustSnapshot};
use crate::errors::MarketError;
use crate::events::SessionCreated;

#[derive(Accounts)]
#[instruction(session_signer: Pubkey)]
pub struct SessionCreate<'info> {
    #[account(
        init,
        payer = authority,
        space = SessionToken::SIZE,
        seeds = [b"session", authority.key().as_ref(), session_signer.as_ref()],
        bump
    )]
    pub session_token: Account<'info, SessionToken>,

    // [ФИКС] Ончейн-снапшот траст-индекса для валидации лимита сессии.
    // Option: если снапшота ещё нет (новый пользователь, воркер не успел),
    // применяется самый строгий тир 1 — защита не ослабляется.
    #[account(
        seeds = [b"trust_snapshot", authority.key().as_ref()],
        bump
    )]
    pub trust_snapshot: Option<Account<'info, TrustSnapshot>>,

    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: адрес программы к которой даётся доступ
    pub target_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<SessionCreate>,
    session_signer: Pubkey,
    allowed_ixs: u64,
    max_amount_per_tx: u64,
    ttl_seconds: i64,
) -> Result<()> {
    require!(
        ttl_seconds > 0 && ttl_seconds <= SessionToken::MAX_TTL_SECONDS,
        MarketError::SessionTtlTooLong
    );

    // [ФИКС] Валидация max_amount_per_tx против лимита тира доверия.
    // Если снапшота нет — тир 1 (самый строгий лимит).
    let trust_tier: u8 = ctx
        .accounts
        .trust_snapshot
        .as_ref()
        .map(|s| s.tier)
        .unwrap_or(1);

    let tier_limit_lamports: u64 = match trust_tier {
        1 => 1_000_000_000,       // 1 SOL
        2 => 5_000_000_000,       // 5 SOL
        3 => 10_000_000_000,      // 10 SOL
        4 => 50_000_000_000,      // 50 SOL
        _ => 100_000_000_000,     // тир 5: 100 SOL
    };

    require!(
        max_amount_per_tx <= tier_limit_lamports,
        MarketError::SessionAmountExceedsTrustTier
    );

    let session = &mut ctx.accounts.session_token;
    session.authority = ctx.accounts.authority.key();
    session.session_signer = session_signer;
    session.target_program = ctx.accounts.target_program.key();
    session.allowed_ixs = allowed_ixs;
    session.max_amount_per_tx = max_amount_per_tx;
    session.valid_until = Clock::get()?.unix_timestamp + ttl_seconds;
    session.revoked = false;
    session.bump = ctx.bumps.session_token;

    emit!(SessionCreated {
        authority: ctx.accounts.authority.key(),
        session_signer,
        valid_until: session.valid_until,
    });

    Ok(())
}
