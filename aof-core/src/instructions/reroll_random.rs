use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, CloseAccount};
use crate::constants::*;
use crate::{RerollRandomCommit, RerollRandomReveal, RerollRandomExpire, InitRerollConfig, SetRerollConfig};
use crate::errors::*;
use crate::events::*;
use crate::instructions::settlement;
use crate::vrf::{self, VrfRevealParams};

/// Random reroll: burn one tool, receive a tool of random rarity/type drawn
/// from the reroll odds table. Settled by Switchboard On-Demand exactly like
/// the packs (see vrf.rs); the deterministic fuse keeps the name `reroll`.
pub fn init_config_handler(ctx: Context<InitRerollConfig>, odds_bps: [u16; 5]) -> Result<()> {
    let sum: u32 = odds_bps.iter().map(|x| *x as u32).sum();
    require!(sum == 10_000, AofError::InvalidOddsWeights);
    // [AUDIT F-18] `pack_config.rs` rejects a non-zero Legendary weight, the
    // reroll config did not. A single typo in the odds table would have turned
    // reroll into an unlimited Legendary press that never touches the craft
    // curve. Legendary is craft/reroll-fuse only, never a direct roll.
    require!(odds_bps[4] == 0, AofError::InvalidOddsWeights);
    let c = &mut ctx.accounts.reroll_config;
    c.odds_bps = odds_bps;
    c.bump = ctx.bumps.reroll_config;
    emit!(RerollConfigChanged { odds_bps, slot: Clock::get()?.slot });
    Ok(())
}

pub fn set_config_handler(ctx: Context<SetRerollConfig>, odds_bps: [u16; 5]) -> Result<()> {
    let sum: u32 = odds_bps.iter().map(|x| *x as u32).sum();
    require!(sum == 10_000, AofError::InvalidOddsWeights);
    // [AUDIT F-18] see init_config_handler: Legendary must stay unreachable
    // from a single roll.
    require!(odds_bps[4] == 0, AofError::InvalidOddsWeights);
    ctx.accounts.reroll_config.odds_bps = odds_bps;
    emit!(RerollConfigChanged { odds_bps, slot: Clock::get()?.slot });
    Ok(())
}

pub fn commit_handler(ctx: Context<RerollRandomCommit>, nonce: u64) -> Result<()> {
    // The reroll fee leaves the gas tank for this commit's escrow (it used to
    // stay in the tank as a sweepable fee): reveal -> treasury, refund -> user.
    let tank = &mut ctx.accounts.gastank;
    require!(tank.balance_micros >= FEE_PER_REROLL_MICROS, AofError::InsufficientBalance);
    tank.balance_micros = tank
        .balance_micros
        .checked_sub(FEE_PER_REROLL_MICROS)
        .ok_or(AofError::MathOverflow)?;
    let fee_lamports = FEE_PER_REROLL_MICROS
        .checked_mul(MICROS_TO_LAMPORTS)
        .ok_or(AofError::MathOverflow)?;
    // Everything that still belongs to the user stays in the tank.
    let tank_reserve = Rent::get()?
        .minimum_balance(GASTANK_SPACE)
        .checked_add(tank.balance_micros.checked_mul(MICROS_TO_LAMPORTS).ok_or(AofError::MathOverflow)?)
        .and_then(|x| x.checked_add(tank.dust_lamports))
        .ok_or(AofError::MathOverflow)?;
    // The fee itself moves after the last CPI below (runtime lamport rule).

    // The settlement NFT's rent is prepaid so that any cranker is made whole.
    let deposit = vrf::tool_settlement_rent(&Rent::get()?);
    anchor_lang::system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.user.to_account_info(),
                to: ctx.accounts.reroll_commit.to_account_info(),
            },
        ),
        deposit,
    )?;

    // The tool is burned at commit (irreversible); its attributes are kept so
    // that a refund can restore an equivalent tool.
    let burned_tool_type = ctx.accounts.burn_tool.tool_type.clone();
    let burned_rarity = ctx.accounts.burn_tool.rarity;
    let burned_durability = ctx.accounts.burn_tool.durability;
    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.burn_mint.to_account_info(),
                from: ctx.accounts.burn_token.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        1,
    )?;
    token::close_account(CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        CloseAccount {
            account: ctx.accounts.burn_token.to_account_info(),
            destination: ctx.accounts.user.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        },
    ))?;

    let clock = Clock::get()?;
    let commit_key = ctx.accounts.reroll_commit.key();
    let accounts = vrf::CommitAccounts {
        switchboard_program: ctx.accounts.switchboard_program.to_account_info(),
        randomness: ctx.accounts.randomness.to_account_info(),
        queue: ctx.accounts.queue.to_account_info(),
        oracle: ctx.accounts.oracle.to_account_info(),
        recent_slothashes: ctx.accounts.recent_slothashes.to_account_info(),
        vrf_authority: ctx.accounts.vrf_authority.to_account_info(),
    };
    let seed_slot = vrf::commit(&mut ctx.accounts.vrf_slot, commit_key, &accounts, ctx.bumps.vrf_authority, clock.slot)?;

    // [RUNTIME LAMPORT RULE] Direct lamport moves only after the last CPI: at
    // every CPI the runtime re-checks this instruction's lamport sum from the
    // accounts passed to that CPI. Moving the fee into the commit before the
    // deposit transfer (which passes the commit but not the gas tank) failed
    // every reroll commit with UnbalancedInstruction on the real runtime.
    crate::economics::transfer_owned_lamports(
        &ctx.accounts.gastank.to_account_info(),
        &ctx.accounts.reroll_commit.to_account_info(),
        fee_lamports,
        tank_reserve,
    )?;

    let rc = &mut ctx.accounts.reroll_commit;
    rc.user = ctx.accounts.user.key();
    rc.nonce = nonce;
    rc.burn_mint = ctx.accounts.burn_mint.key();
    rc.burned_tool_type = burned_tool_type;
    rc.burned_rarity = burned_rarity;
    rc.burned_durability = burned_durability;
    rc.odds_bps = ctx.accounts.reroll_config.odds_bps;
    rc.fee_lamports = fee_lamports;
    rc.deposit_lamports = deposit;
    rc.randomness = ctx.accounts.randomness.key();
    rc.seed_slot = seed_slot;
    rc.commit_slot = clock.slot;
    rc.bump = ctx.bumps.reroll_commit;

    emit!(VrfCommitted {
        mechanic: VRF_MECHANIC_REROLL,
        commit: commit_key,
        user: rc.user,
        randomness: rc.randomness,
        seed_slot,
        commit_slot: clock.slot,
        escrow_lamports: fee_lamports.saturating_add(deposit),
    });
    Ok(())
}

/// Permissionless settlement (see pack_open_reveal).
pub fn reveal_handler(ctx: Context<RerollRandomReveal>, params: VrfRevealParams) -> Result<()> {
    let clock = Clock::get()?;
    let commit_key = ctx.accounts.reroll_commit.key();
    let (randomness, seed_slot, commit_slot) = (
        ctx.accounts.reroll_commit.randomness,
        ctx.accounts.reroll_commit.seed_slot,
        ctx.accounts.reroll_commit.commit_slot,
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

    let (rarity, tool_type) = settlement::roll_tool(&value, b"reroll", &commit_key, &ctx.accounts.reroll_commit.odds_bps)?;
    settlement::mint_tool_nft(
        &ctx.accounts.token_program.to_account_info(),
        &ctx.accounts.new_mint.to_account_info(),
        &ctx.accounts.new_token.to_account_info(),
        &ctx.accounts.auth.to_account_info(),
        ctx.bumps.auth,
        &ctx.accounts.metadata.to_account_info(),
        &ctx.accounts.token_metadata_program.to_account_info(),
        &ctx.accounts.cranker.to_account_info(),
        &ctx.accounts.system_program.to_account_info(),
        &ctx.accounts.tool_metadata_registry,
        &tool_type,
        rarity,
    )?;
    let user = ctx.accounts.reroll_commit.user;
    settlement::write_tool(&mut ctx.accounts.new_tool_data, ctx.accounts.new_mint.key(), user, tool_type.clone(), rarity, MAX_DURABILITY);

    let commit_info = ctx.accounts.reroll_commit.to_account_info();
    let fee = ctx.accounts.reroll_commit.fee_lamports;
    settlement::release_escrow(&commit_info, &ctx.accounts.treasury.to_account_info(), fee)?;
    let deposit = ctx.accounts.reroll_commit.deposit_lamports;
    settlement::reimburse_settler(
        &commit_info,
        &ctx.accounts.cranker.to_account_info(),
        deposit,
        &ctx.accounts.new_mint.to_account_info(),
        &ctx.accounts.new_token.to_account_info(),
        &ctx.accounts.new_tool_data.to_account_info(),
        &ctx.accounts.metadata.to_account_info(),
    )?;
    ctx.accounts.reroll_commit.fee_lamports = 0;
    ctx.accounts.reroll_commit.deposit_lamports = 0;

    emit!(VrfSettled {
        mechanic: VRF_MECHANIC_REROLL,
        commit: commit_key,
        randomness,
        seed_slot,
        value,
        cranker: ctx.accounts.cranker.key(),
    });
    emit!(RerollResult {
        user,
        burned_mint: ctx.accounts.reroll_commit.burn_mint,
        new_mint: ctx.accounts.new_mint.key(),
        rarity,
        tool_type,
    });
    Ok(())
}

/// Refund of a reroll the oracle never revealed: the burned tool comes back as
/// an equivalent NFT (same type, rarity and durability) and the fee returns to
/// the user. Permissionless, only once the reveal window has closed.
pub fn expire_handler(ctx: Context<RerollRandomExpire>) -> Result<()> {
    let clock = Clock::get()?;
    let commit_key = ctx.accounts.reroll_commit.key();
    let commit_slot = ctx.accounts.reroll_commit.commit_slot;
    vrf::release_for_refund(&mut ctx.accounts.vrf_slot, &commit_key, commit_slot, clock.slot)?;

    let rc = &ctx.accounts.reroll_commit;
    let (user, tool_type, rarity, durability) = (rc.user, rc.burned_tool_type.clone(), rc.burned_rarity, rc.burned_durability);
    settlement::mint_tool_nft(
        &ctx.accounts.token_program.to_account_info(),
        &ctx.accounts.new_mint.to_account_info(),
        &ctx.accounts.new_token.to_account_info(),
        &ctx.accounts.auth.to_account_info(),
        ctx.bumps.auth,
        &ctx.accounts.metadata.to_account_info(),
        &ctx.accounts.token_metadata_program.to_account_info(),
        &ctx.accounts.cranker.to_account_info(),
        &ctx.accounts.system_program.to_account_info(),
        &ctx.accounts.tool_metadata_registry,
        &tool_type,
        rarity,
    )?;
    settlement::write_tool(&mut ctx.accounts.new_tool_data, ctx.accounts.new_mint.key(), user, tool_type, rarity, durability);

    // The fee stays on the commit and reaches the user through `close = user`;
    // only the fronted NFT rent goes back to the settler.
    let commit_info = ctx.accounts.reroll_commit.to_account_info();
    let deposit = ctx.accounts.reroll_commit.deposit_lamports;
    settlement::reimburse_settler(
        &commit_info,
        &ctx.accounts.cranker.to_account_info(),
        deposit,
        &ctx.accounts.new_mint.to_account_info(),
        &ctx.accounts.new_token.to_account_info(),
        &ctx.accounts.new_tool_data.to_account_info(),
        &ctx.accounts.metadata.to_account_info(),
    )?;
    let fee = ctx.accounts.reroll_commit.fee_lamports;

    emit!(VrfCommitRefunded {
        mechanic: VRF_MECHANIC_REROLL,
        commit: commit_key,
        user,
        refunded_lamports: fee,
    });
    Ok(())
}
