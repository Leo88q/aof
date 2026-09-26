use anchor_lang::prelude::*;
use crate::errors::AofError;
use crate::events::{VrfSlotAdded, VrfSlotRecovered, VrfSlotRetiredChanged};
use crate::vrf;
use crate::{VrfPoolAdd, VrfPoolSetRetired, VrfSlotRecover};

/// [F-06] Grow the program-owned randomness pool by one Switchboard account.
///
/// The randomness account lives at PDA [VRF_RANDOMNESS_SEED, index_le] and
/// its Switchboard authority is PDA [VRF_AUTHORITY_SEED]; `randomness_init`
/// is CPI'd with both seed sets. The operator only pays the rent: it gets no
/// key that could commit or reveal the account later.
pub fn add_handler(ctx: Context<VrfPoolAdd>, index: u32, recent_slot: u64) -> Result<()> {
    let a = vrf::InitAccounts {
        switchboard_program: ctx.accounts.switchboard_program.to_account_info(),
        randomness: ctx.accounts.randomness.to_account_info(),
        reward_escrow: ctx.accounts.reward_escrow.to_account_info(),
        vrf_authority: ctx.accounts.vrf_authority.to_account_info(),
        queue: ctx.accounts.queue.to_account_info(),
        payer: ctx.accounts.operator.to_account_info(),
        system_program: ctx.accounts.system_program.to_account_info(),
        token_program: ctx.accounts.token_program.to_account_info(),
        associated_token_program: ctx.accounts.associated_token_program.to_account_info(),
        wrapped_sol_mint: ctx.accounts.wrapped_sol_mint.to_account_info(),
        program_state: ctx.accounts.program_state.to_account_info(),
        lut_signer: ctx.accounts.lut_signer.to_account_info(),
        lut: ctx.accounts.lut.to_account_info(),
        address_lookup_table_program: ctx.accounts.address_lookup_table_program.to_account_info(),
    };
    vrf::cpi_init(&a, index, ctx.bumps.randomness, ctx.bumps.vrf_authority, recent_slot)?;

    // The account Switchboard created must be exactly what every commit will
    // later insist on: our authority, the trusted queue.
    let created = vrf::load_randomness(&ctx.accounts.randomness.to_account_info())?;
    require_keys_eq!(created.authority, ctx.accounts.vrf_authority.key(), AofError::InvalidRandomnessAccount);
    require_keys_eq!(created.queue, vrf::SWITCHBOARD_QUEUE, AofError::InvalidRandomnessAccount);

    let slot = &mut ctx.accounts.vrf_slot;
    slot.randomness = ctx.accounts.randomness.key();
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

/// Take a misbehaving randomness account out of rotation (or back in). A slot
/// holding a commit cannot be retired: the commit still needs it to settle.
pub fn set_retired_handler(ctx: Context<VrfPoolSetRetired>, retired: bool) -> Result<()> {
    let slot = &mut ctx.accounts.vrf_slot;
    if retired {
        require_keys_eq!(slot.lock, Pubkey::default(), AofError::VrfSlotBusy);
    }
    slot.retired = retired;
    emit!(VrfSlotRetiredChanged { vrf_slot: slot.key(), retired });
    Ok(())
}

/// Clear a lock whose holder account no longer exists. Every settle/refund
/// path frees its slot itself, so this only repairs a slot orphaned by a
/// future bug. It cannot be used to re-seed a LIVE commit: the holder must be
/// gone (no lamports, no data), otherwise the operator could void a pending
/// jackpot by re-committing its randomness.
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
