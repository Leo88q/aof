use anchor_lang::prelude::*;
use crate::errors::*;
use crate::events::*;
use crate::{AcceptAuthority, CancelPendingAuthority, SetPendingAuthority};

/// [AUDIT F-02] Step 1 of the rotation: the current authority names the next
/// one. Nothing changes yet, so a wrong pubkey is recoverable.
pub fn set_pending_authority(ctx: Context<SetPendingAuthority>, new_authority: Pubkey) -> Result<()> {
    require!(
        new_authority != Pubkey::default(),
        AofError::InvalidMint // reused "must not be the default pubkey"
    );
    let config = &mut ctx.accounts.config;
    let previous = config.authority;
    config.pending_authority = new_authority;
    emit!(AuthorityRotationProposed {
        previous,
        next: new_authority,
        at: Clock::get()?.unix_timestamp,
    });
    Ok(())
}

/// [AUDIT F-02] Step 2: the *new* key accepts. Requiring its signature is what
/// makes the rotation safe — a proposal can never hand the program to a key
/// nobody controls.
pub fn accept_authority(ctx: Context<AcceptAuthority>) -> Result<()> {
    let config = &mut ctx.accounts.config;
    require!(
        config.pending_authority != Pubkey::default(),
        AofError::NoPendingAuthority
    );
    let previous = config.authority;
    let next = ctx.accounts.new_authority.key();
    let now = Clock::get()?.unix_timestamp;
    config.authority = next;
    config.pending_authority = Pubkey::default();
    config.authority_updated_at = now;
    emit!(AuthorityChanged {
        previous,
        next,
        at: now,
    });
    Ok(())
}

/// [AUDIT F-02] The current authority can withdraw a proposal that turned out
/// to be wrong (or that was submitted by a key about to be retired).
pub fn cancel_pending_authority(ctx: Context<CancelPendingAuthority>) -> Result<()> {
    let config = &mut ctx.accounts.config;
    require!(
        config.pending_authority != Pubkey::default(),
        AofError::NoPendingAuthority
    );
    let cancelled = config.pending_authority;
    config.pending_authority = Pubkey::default();
    emit!(AuthorityRotationCancelled {
        authority: ctx.accounts.authority.key(),
        cancelled,
        slot: Clock::get()?.slot,
    });
    Ok(())
}
