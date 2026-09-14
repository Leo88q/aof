use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::PackOpenCommit;
use crate::errors::*;
use crate::state::PackType;

/// Игрок платит SOL сразу в казну (это единственная реальная revenue-точка
/// в SOL из всего TOR v4 — см. AUDIT_V3, «следующий кандидат по важности»).
/// Сервер к этому моменту уже вычислил `secret` офчейн и прислал только
/// `sha256(secret)` — не может задним числом подобрать исход, потому что
/// финальная энтропия домешивает ещё и хэш слота коммита (см. randomness.rs).
pub fn handler(
    ctx: Context<PackOpenCommit>,
    _pack_type: PackType,
    commit_hash: [u8; 32],
) -> Result<()> {
    // SOL is transferred before reveal, but there is no on-chain expiry,
    // cancel, or refund path. The API is disabled; block direct callers too.
    require!(false, AofError::FeatureDisabled);

    let price = ctx.accounts.pack_config.price_lamports;
    let cpi = system_program::Transfer {
        from: ctx.accounts.user.to_account_info(),
        to: ctx.accounts.treasury.to_account_info(),
    };
    system_program::transfer(
        CpiContext::new(ctx.accounts.system_program.to_account_info(), cpi),
        price,
    )?;

    let slot = Clock::get()?.slot;
    let pc = &mut ctx.accounts.pack_commit;
    pc.user = ctx.accounts.user.key();
    pc.mint = ctx.accounts.mint.key();
    pc.pack_type = ctx.accounts.pack_config.pack_type;
    pc.commit_hash = commit_hash;
    pc.commit_slot = slot;
    pc.revealed = false;
    Ok(())
}
