use anchor_lang::prelude::*;
use crate::errors::AofError;
use crate::events::{VrfSlotAdded, VrfSlotRecovered, VrfSlotRetiredChanged};
use crate::{VrfPoolAdd, VrfPoolSetRetired, VrfSlotRecover};

/// Grow the program-owned pool by one lock slot. The slot is a PDA of this
/// program. Nothing outside the program can commit or reveal it.
pub fn add_handler(ctx: Context<VrfPoolAdd>, index: u32, _recent_slot: u64) -> Result<()> {
    let slot = &mut ctx.accounts.vrf_slot;
    slot.randomness = slot.key();
    slot.index = index;
    slot.lock = Pubkey::default();
    slot.locked_at_slot = 0;
    slot.retired = false;
    slot.commits = 0;
    slot.reveals = 0;
    slot.bump = ctx.bumps.vrf_slot;

    emit!(VrfSlotAdded {
        index,
        randomness: slot.randomness,
        vrf_slot: slot.key(),
    });
    Ok(())
}

/// Take a pool slot out of rotation (or back in). A slot holding a commit
/// cannot be retired: the commit still needs it to settle.
pub fn set_retired_handler(ctx: Context<VrfPoolSetRetired>, retired: bool) -> Result<()> {
    let slot = &mut ctx.accounts.vrf_slot;
    if retired {
        require_keys_eq!(slot.lock, Pubkey::default(), AofError::VrfSlotBusy);
    }
    slot.retired = retired;
    emit!(VrfSlotRetiredChanged { vrf_slot: slot.key(), retired });
    Ok(())
}

/// Clear a lock whose holder account no longer exists. Every settle path frees
/// its slot itself, so this only repairs a slot orphaned by a future bug.
pub fn recover_handler(ctx: Context<VrfSlotRecover>) -> Result<()> {
    let holder = &ctx.accounts.holder;
    require!(holder.lamports() == 0 && holder.data_is_empty(), AofError::VrfSlotBusy);
    let slot = &mut ctx.accounts.vrf_slot;
    let stale_lock = slot.lock;
    require_keys_neq!(stale_lock, Pubkey::default(), AofError::VrfSlotNotHeld);
    slot.lock = Pubkey::default();
    emit!(VrfSlotRecovered { vrf_slot: slot.key(), stale_lock });
    Ok(())
}
