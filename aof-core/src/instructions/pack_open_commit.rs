use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::PackOpenCommit;
use crate::errors::*;
use crate::state::PackType;

/// New paid commitments are quarantined until a verified VRF settlement exists.
/// Escrow refunds prevent loss from outages, but do not prevent the secret
/// holder from selectively revealing favorable results. Legacy reveal/expire
/// instructions remain available; do not remove users' recovery paths.
pub fn handler(
    ctx: Context<PackOpenCommit>,
    _pack_type: PackType,
    commit_hash: [u8; 32],
) -> Result<()> {
    require!(false, AofError::FeatureDisabled);
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
