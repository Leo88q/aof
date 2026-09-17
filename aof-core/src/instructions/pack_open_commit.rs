use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::PackOpenCommit;
use crate::errors::*;
use crate::state::PackType;

/// Игрок платит за пак, но SOL **не уходит в казну сразу**: сумма лежит в
/// escrow на PDA `pack_commit` до исхода.
///
/// * `pack_open_reveal` — исход известен, инструмент сминчен → escrow
///   переводится в казну (это единственная реальная revenue-точка в SOL,
///   см. AUDIT_V3).
/// * `pack_open_expire` — секрет потерян / сервер не сделал reveal за окно
///   SlotHashes → escrow возвращается игроку, PDA закрывается.
///
/// Раньше оплата шла в казну до reveal, и потерянный секрет означал потерю
/// денег игрока без пути возврата — поэтому инструкция была fail-closed
/// (FeatureDisabled). С escrow ни один из двух исходов не оставляет средства
/// зависшими, и guard снят.
///
/// Сервер к моменту commit уже вычислил `secret` офчейн и прислал только
/// `sha256(secret)` — не может задним числом подобрать исход, потому что
/// финальная энтропия домешивает ещё и хэш слота коммита (см. randomness.rs).
pub fn handler(
    ctx: Context<PackOpenCommit>,
    _pack_type: PackType,
    commit_hash: [u8; 32],
) -> Result<()> {
    let price = ctx.accounts.pack_config.price_lamports;
    require!(price > 0, AofError::ZeroAmount);

    // Escrow: user -> pack_commit PDA (on top of the rent Anchor just paid).
    let cpi = system_program::Transfer {
        from: ctx.accounts.user.to_account_info(),
        to: ctx.accounts.pack_commit.to_account_info(),
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
    pc.paid_lamports = price;
    Ok(())
}
