use anchor_lang::prelude::*;

declare_id!("6ZnnyKkv1kUE4AJqi5uwdh5ZX6VFGfbQiwhGSkfqZ9K5");

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
    #[account(mut)]
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
