use anchor_lang::prelude::*;
use crate::PackOpenExpire;
use crate::events::{VrfCommitRefunded, VRF_MECHANIC_PACK};
use crate::vrf;

/// [F-06] Refund of a pack opening the oracle never revealed.
///
/// Permissionless and only from `commit_slot + VRF_REFUND_AFTER_SLOTS` — the
/// slot at which `pack_open_reveal` stops accepting a reveal — so refund and
/// settlement are never available at the same time. Frees the pool slot;
/// `close = user` returns the price, the unused deposit and the rent.
pub fn handler(ctx: Context<PackOpenExpire>) -> Result<()> {
    let clock = Clock::get()?;
    let commit_key = ctx.accounts.pack_commit.key();
    let commit_slot = ctx.accounts.pack_commit.commit_slot;
    vrf::release_for_refund(&mut ctx.accounts.vrf_slot, &commit_key, commit_slot, clock.slot)?;

    let pc = &ctx.accounts.pack_commit;
    emit!(VrfCommitRefunded {
        mechanic: VRF_MECHANIC_PACK,
        commit: commit_key,
        user: pc.user,
        refunded_lamports: pc.paid_lamports.saturating_add(pc.deposit_lamports),
    });
    Ok(())
}
