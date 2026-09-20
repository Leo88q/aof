use anchor_lang::prelude::*;
use crate::constants::{ISSUANCE_EPOCH_MAX_SLOTS, ISSUANCE_EPOCH_MIN_SLOTS};
use crate::errors::AofError;
use crate::events::IssuanceCapChanged;
use crate::{InitIssuanceCap, ResourceKind, SetIssuanceCap};

fn validate(epoch_slots: u64, cap_per_epoch: u64) -> Result<()> {
    require!(epoch_slots >= ISSUANCE_EPOCH_MIN_SLOTS && epoch_slots <= ISSUANCE_EPOCH_MAX_SLOTS, AofError::InvalidIssuanceCapParams);
    // cap 0 is representable (it means "halted") but must be set explicitly
    // through set_issuance_cap, never as the initial value by accident.
    require!(cap_per_epoch > 0, AofError::InvalidIssuanceCapParams);
    Ok(())
}

pub fn init_handler(ctx: Context<InitIssuanceCap>, kind: ResourceKind, epoch_slots: u64, cap_per_epoch: u64) -> Result<()> {
    validate(epoch_slots, cap_per_epoch)?;
    let slot = Clock::get()?.slot;
    let cap = &mut ctx.accounts.issuance_cap;
    cap.kind = kind as u8;
    cap.epoch_slots = epoch_slots;
    cap.cap_per_epoch = cap_per_epoch;
    cap.epoch_start_slot = slot;
    cap.minted_in_epoch = 0;
    cap.lifetime_minted = 0;
    cap.bump = ctx.bumps.issuance_cap;
    emit!(IssuanceCapChanged { kind: kind as u8, epoch_slots, cap_per_epoch, minted_in_epoch: 0, slot });
    Ok(())
}

/// Adjust limits. `minted_in_epoch` is deliberately preserved: lowering the
/// cap below what was already minted simply blocks further mints until the
/// epoch rolls, and raising it never grants a fresh window. Setting
/// `cap_per_epoch = 0` halts issuance of this kind (emergency brake that does
/// not require pausing the whole program).
pub fn set_handler(ctx: Context<SetIssuanceCap>, kind: ResourceKind, epoch_slots: u64, cap_per_epoch: u64) -> Result<()> {
    require!(epoch_slots >= ISSUANCE_EPOCH_MIN_SLOTS && epoch_slots <= ISSUANCE_EPOCH_MAX_SLOTS, AofError::InvalidIssuanceCapParams);
    let slot = Clock::get()?.slot;
    let cap = &mut ctx.accounts.issuance_cap;
    require!(cap.kind == kind as u8, AofError::InvalidResourceKind);
    // Roll first so a stale epoch does not carry its counter into the new
    // parameters; inside the current epoch the counter stays.
    cap.roll_epoch(slot);
    cap.epoch_slots = epoch_slots;
    cap.cap_per_epoch = cap_per_epoch;
    emit!(IssuanceCapChanged { kind: kind as u8, epoch_slots, cap_per_epoch, minted_in_epoch: cap.minted_in_epoch, slot });
    Ok(())
}
