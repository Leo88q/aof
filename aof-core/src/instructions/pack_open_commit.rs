use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::PackOpenCommit;
use crate::errors::*;
use crate::events::{VrfCommitted, VRF_MECHANIC_PACK};
use crate::state::PackType;
use crate::vrf;

/// [F-06] Paid pack opening, settled by Switchboard On-Demand.
///
/// In ONE instruction: the price and the settlement deposit move into the
/// commit PDA, the odds are snapshotted, and a free pool randomness account is
/// committed (CPI signed by this program's PDA) and locked to this commit.
/// `max_price_lamports` protects the player from a price change between quote
/// and execution. The operator co-signs as the backend gate (fraud holds,
/// crank circuit breaker); it gets no influence over the outcome.
pub fn handler(
    ctx: Context<PackOpenCommit>,
    _pack_type: PackType,
    nonce: u64,
    max_price_lamports: u64,
) -> Result<()> {
    let price = ctx.accounts.pack_config.price_lamports;
    require!(price > 0, AofError::ZeroAmount);
    require!(price <= max_price_lamports, AofError::PriceAboveMaximum);
    let deposit = vrf::tool_settlement_rent(&Rent::get()?);
    let escrow = price.checked_add(deposit).ok_or(AofError::MathOverflow)?;

    // Escrow: user -> pack_commit PDA (on top of the rent Anchor just paid).
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.user.to_account_info(),
                to: ctx.accounts.pack_commit.to_account_info(),
            },
        ),
        escrow,
    )?;

    let clock = Clock::get()?;
    let commit_key = ctx.accounts.pack_commit.key();
    let accounts = vrf::CommitAccounts {
        switchboard_program: ctx.accounts.switchboard_program.to_account_info(),
        randomness: ctx.accounts.randomness.to_account_info(),
        queue: ctx.accounts.queue.to_account_info(),
        oracle: ctx.accounts.oracle.to_account_info(),
        recent_slothashes: ctx.accounts.recent_slothashes.to_account_info(),
        vrf_authority: ctx.accounts.vrf_authority.to_account_info(),
    };
    let seed_slot = vrf::commit(&mut ctx.accounts.vrf_slot, commit_key, &accounts, ctx.bumps.vrf_authority, clock.slot)?;

    let pc = &mut ctx.accounts.pack_commit;
    pc.user = ctx.accounts.user.key();
    pc.nonce = nonce;
    pc.pack_type = ctx.accounts.pack_config.pack_type;
    pc.odds_bps = ctx.accounts.pack_config.odds_bps;
    pc.paid_lamports = price;
    pc.deposit_lamports = deposit;
    pc.randomness = ctx.accounts.randomness.key();
    pc.seed_slot = seed_slot;
    pc.commit_slot = clock.slot;
    pc.bump = ctx.bumps.pack_commit;

    emit!(VrfCommitted {
        mechanic: VRF_MECHANIC_PACK,
        commit: commit_key,
        user: pc.user,
        randomness: pc.randomness,
        seed_slot,
        commit_slot: clock.slot,
        escrow_lamports: escrow,
    });
    Ok(())
}
