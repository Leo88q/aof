use anchor_lang::prelude::*;
use crate::constants::*;
use crate::PackOpenReveal;
use crate::events::*;
use crate::instructions::settlement;
use crate::vrf::{self, VrfRevealParams};

/// [F-06] Permissionless settlement of a pack opening.
///
/// Anyone holding the oracle's signed value may call this — the backend crank,
/// the player, a third party. The program CPIs Switchboard's reveal (signed by
/// its own PDA, the only authority of the pool account), reads the verified
/// value back and settles in the same instruction: a new tool NFT at the PDA
/// [PACK_MINT_SEED, pack_commit], the price to the treasury, the fronted rent
/// back to the settler, the rest to the player. There is no second chance and
/// nothing to withhold.
pub fn handler(ctx: Context<PackOpenReveal>, params: VrfRevealParams) -> Result<()> {
    let clock = Clock::get()?;
    let commit_key = ctx.accounts.pack_commit.key();
    let (randomness, seed_slot, commit_slot) = (
        ctx.accounts.pack_commit.randomness,
        ctx.accounts.pack_commit.seed_slot,
        ctx.accounts.pack_commit.commit_slot,
    );
    let accounts = vrf::RevealAccounts {
        switchboard_program: ctx.accounts.switchboard_program.to_account_info(),
        randomness: ctx.accounts.randomness.to_account_info(),
        oracle: ctx.accounts.oracle.to_account_info(),
        queue: ctx.accounts.queue.to_account_info(),
        stats: ctx.accounts.stats.to_account_info(),
        vrf_authority: ctx.accounts.vrf_authority.to_account_info(),
        payer: ctx.accounts.cranker.to_account_info(),
        recent_slothashes: ctx.accounts.recent_slothashes.to_account_info(),
        system_program: ctx.accounts.system_program.to_account_info(),
        reward_escrow: ctx.accounts.reward_escrow.to_account_info(),
        token_program: ctx.accounts.token_program.to_account_info(),
        wrapped_sol_mint: ctx.accounts.wrapped_sol_mint.to_account_info(),
        program_state: ctx.accounts.program_state.to_account_info(),
    };
    let value = vrf::reveal(
        &mut ctx.accounts.vrf_slot,
        &commit_key,
        &randomness,
        seed_slot,
        commit_slot,
        &accounts,
        &params,
        ctx.bumps.vrf_authority,
        clock.slot,
    )?;

    let (rarity, tool_type) = settlement::roll_tool(&value, b"pack", &commit_key, &ctx.accounts.pack_commit.odds_bps)?;
    settlement::mint_tool_nft(
        &ctx.accounts.token_program.to_account_info(),
        &ctx.accounts.mint.to_account_info(),
        &ctx.accounts.user_token.to_account_info(),
        &ctx.accounts.auth.to_account_info(),
        ctx.bumps.auth,
    )?;
    let user = ctx.accounts.pack_commit.user;
    settlement::write_tool(&mut ctx.accounts.tool_data, ctx.accounts.mint.key(), user, tool_type.clone(), rarity, MAX_DURABILITY);

    // Outcome is final: the price goes to the treasury, the fronted rent back
    // to whoever settled. `close = user` returns the commit rent and any
    // unused deposit to the player.
    let commit_info = ctx.accounts.pack_commit.to_account_info();
    let paid = ctx.accounts.pack_commit.paid_lamports;
    settlement::release_escrow(&commit_info, &ctx.accounts.treasury.to_account_info(), paid)?;
    let deposit = ctx.accounts.pack_commit.deposit_lamports;
    settlement::reimburse_settler(&commit_info, &ctx.accounts.cranker.to_account_info(), deposit)?;
    ctx.accounts.pack_commit.paid_lamports = 0;
    ctx.accounts.pack_commit.deposit_lamports = 0;

    emit!(VrfSettled {
        mechanic: VRF_MECHANIC_PACK,
        commit: commit_key,
        randomness,
        seed_slot,
        value,
        cranker: ctx.accounts.cranker.key(),
    });
    emit!(PackOpened {
        user,
        mint: ctx.accounts.mint.key(),
        pack_type: ctx.accounts.pack_commit.pack_type,
        rarity,
        tool_type,
        pack_commit: commit_key,
    });
    Ok(())
}
