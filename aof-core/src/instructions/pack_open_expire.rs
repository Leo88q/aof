use anchor_lang::prelude::*;
use crate::errors::AofError;
use crate::PackOpenExpire;
use crate::events::{VrfCommitRefunded, VRF_MECHANIC_PACK};
use crate::vrf;

/// [F-06] Close a pack opening that has no readable roll.
///
/// Permissionless. `vrf::unsettled` refuses while a complete roll is still
/// readable, refunds the player only for a skipped hash, and sends an aged-out
/// hash to the treasury before the commit account is closed.
pub fn handler(ctx: Context<PackOpenExpire>) -> Result<()> {
    let clock = Clock::get()?;
    let commit_key = ctx.accounts.pack_commit.key();
    let commit_slot = ctx.accounts.pack_commit.commit_slot;
    let seed_slot = ctx.accounts.pack_commit.seed_slot;
    let path = vrf::unsettled(&ctx.accounts.recent_slothashes.to_account_info(), commit_slot, clock.slot)?;
    require!(seed_slot == commit_slot.saturating_add(vrf::SLOT_HASH_DELAY), AofError::RandomnessNotFresh);
    vrf::release_lock(&mut ctx.accounts.vrf_slot, &commit_key)?;
    if path == vrf::Unsettled::TreasuryForfeit {
        let paid = ctx.accounts.pack_commit.paid_lamports.saturating_add(ctx.accounts.pack_commit.deposit_lamports);
        vrf::transfer_lamports(
            &ctx.accounts.pack_commit.to_account_info(),
            &ctx.accounts.treasury.to_account_info(),
            paid,
        )?;
    }

    let pc = &ctx.accounts.pack_commit;
    emit!(VrfCommitRefunded {
        mechanic: VRF_MECHANIC_PACK,
        commit: commit_key,
        user: pc.user,
        refunded_lamports: pc.paid_lamports.saturating_add(pc.deposit_lamports),
    });
    Ok(())
}
