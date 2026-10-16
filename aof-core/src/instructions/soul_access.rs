use anchor_lang::prelude::*;
use crate::errors::*;
use crate::events::SoulAccessUnlocked;
use crate::UnlockSoulAccess;

/// Open the SoulCore gameplay gate for a player who completed at least one
/// laboratory seal. The gate is this account: it cannot be forged by a
/// client, and unlocking moves no resources, so the issuance journal and
/// supply caps are untouched. Re-unlocking is an idempotent no-op.
pub fn handler(ctx: Context<UnlockSoulAccess>) -> Result<()> {
    let access = &mut ctx.accounts.soul_access;
    if access.owner != Pubkey::default() {
        // Already open. The stored proof stays as first written.
        require!(access.owner == ctx.accounts.user.key(), AofError::Unauthorized);
        return Ok(());
    }
    let finale = &ctx.accounts.finale;
    require!(finale.owner == ctx.accounts.user.key(), AofError::Unauthorized);
    require!(finale.seals >= 1, AofError::SoulAccessLocked);

    let now = Clock::get()?.unix_timestamp;
    access.owner = ctx.accounts.user.key();
    access.unlocked_at = now;
    access.seals_at_unlock = finale.seals;
    access.bump = ctx.bumps.soul_access;

    emit!(SoulAccessUnlocked {
        user: ctx.accounts.user.key(),
        seals_at_unlock: finale.seals,
        unlocked_at: now,
    });
    Ok(())
}
