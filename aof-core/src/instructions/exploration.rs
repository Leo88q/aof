use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, MintTo, Transfer};
use crate::constants::*;
use crate::{StartExplorationCommit, ExploreReveal, ExploreExpire, UpgradeExplorationTier};
use crate::errors::*;
use crate::events::*;
use crate::state::check_supply_cap;
use crate::ResourceKind;
use crate::vrf::{self, VrfRevealParams};

fn day_start_of(ts: i64) -> i64 {
    ts - (ts % 86400)
}

/// [F-06] Start a trip: escrow the trip cost, snapshot the tier and commit a
/// pool randomness account (see vrf.rs). The operator co-signs as the backend
/// gate; the outcome is out of everyone's hands from here on.
pub fn start_commit_handler(ctx: Context<StartExplorationCommit>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let state = &mut ctx.accounts.exploration_state;
    if state.owner == Pubkey::default() {
        state.owner = ctx.accounts.user.key();
        state.tier = 1;
        state.last_trip_at = 0;
        state.trips_today = 0;
        state.day_start = day_start_of(now);
    }
    require!(
        state.tier >= 1 && state.tier <= MAX_EXPLORATION_TIER,
        AofError::InvalidExplorationTier
    );

    let idx = (state.tier - 1) as usize;
    let cooldown = (EXPLORATION_COOLDOWN_HOURS[idx] as i64) * 3600;
    require!(now >= state.last_trip_at + cooldown, AofError::ExplorationCooldown);

    if day_start_of(now) != state.day_start {
        state.day_start = day_start_of(now);
        state.trips_today = 0;
    }
    require!(
        state.trips_today < EXPLORATION_TRIPS_PER_DAY[idx],
        AofError::ExplorationDailyLimitReached
    );
    state.last_trip_at = now;
    state.trips_today = state
        .trips_today
        .checked_add(1)
        .ok_or(AofError::MathOverflow)?;
    let tier = state.tier;

    // TRIP_COST — {data:75, circuit:35, silicon:35, dataset:50}. Keep the
    // inputs in the program-controlled escrow until VRF settlement: expiry can
    // return the exact assets by transfer, so a lifetime mint cap cannot strand
    // a promised refund.
    for (from, escrow, cost) in [
        (&ctx.accounts.user_data, &ctx.accounts.escrow_data, TRIP_COST_DATA),
        (&ctx.accounts.user_circuit, &ctx.accounts.escrow_circuit, TRIP_COST_CIRCUIT),
        (&ctx.accounts.user_silicon, &ctx.accounts.escrow_silicon, TRIP_COST_SILICON),
        (&ctx.accounts.user_dataset, &ctx.accounts.escrow_dataset, TRIP_COST_DATASET),
    ] {
        require!(from.amount >= cost, AofError::InsufficientBalance);
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: from.to_account_info(),
                    to: escrow.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            cost,
        )?;
    }

    let clock = Clock::get()?;
    let commit_key = ctx.accounts.exploration_commit.key();
    let accounts = vrf::CommitAccounts {
        switchboard_program: ctx.accounts.switchboard_program.to_account_info(),
        randomness: ctx.accounts.randomness.to_account_info(),
        queue: ctx.accounts.queue.to_account_info(),
        oracle: ctx.accounts.oracle.to_account_info(),
        recent_slothashes: ctx.accounts.recent_slothashes.to_account_info(),
        vrf_authority: ctx.accounts.vrf_authority.to_account_info(),
    };
    let seed_slot = vrf::commit(&mut ctx.accounts.vrf_slot, commit_key, &accounts, ctx.bumps.vrf_authority, clock.slot)?;

    let ec = &mut ctx.accounts.exploration_commit;
    ec.user = ctx.accounts.user.key();
    ec.tool_mint = ctx.accounts.tool_mint.key();
    ec.tier = tier;
    ec.data_burned = TRIP_COST_DATA;
    ec.circuit_burned = TRIP_COST_CIRCUIT;
    ec.silicon_burned = TRIP_COST_SILICON;
    ec.dataset_burned = TRIP_COST_DATASET;
    ec.randomness = ctx.accounts.randomness.key();
    ec.seed_slot = seed_slot;
    ec.commit_slot = clock.slot;
    ec.bump = ctx.bumps.exploration_commit;

    emit!(VrfCommitted {
        mechanic: VRF_MECHANIC_EXPLORATION,
        commit: commit_key,
        user: ec.user,
        randomness: ec.randomness,
        seed_slot,
        commit_slot: clock.slot,
        escrow_lamports: 0,
    });
    Ok(())
}

/// Success roll and reward amount of a trip at `tier` (1-based).
pub fn trip_outcome(value: &[u8; 32], commit: &Pubkey, tier: u8) -> Result<(bool, u64)> {
    require!(tier >= 1 && tier <= MAX_EXPLORATION_TIER, AofError::InvalidExplorationTier);
    let idx = (tier - 1) as usize;
    let roll = vrf::derive_roll(value, b"explore", commit.as_ref());
    let success = vrf::bps(vrf::lane(&roll, 0)) < EXPLORATION_SUCCESS_BPS[idx] as u64;
    if !success {
        return Ok((false, 0));
    }
    let span = (EXPLORATION_SHARDS_MAX[idx] - EXPLORATION_SHARDS_MIN[idx] + 1) as u64;
    let amount = EXPLORATION_SHARDS_MIN[idx] as u64 + vrf::below(vrf::lane(&roll, 1), span);
    // [ДИЗАЙН-РЕШЕНИЕ, см. constants.rs]: вместо отдельных "шардов"
    // (которых нет в модели крафта этой программы) — бонусные CIRCUIT/SILICON.
    Ok((true, amount.checked_mul(RESOURCE_UNIT).ok_or(AofError::MathOverflow)?))
}

/// [F-06] Permissionless settlement of a trip (see pack_open_reveal). Rewards
/// go to the player's canonical ATAs, re-created by the settler if the player
/// closed them: a closed account must not be a way to make a bad roll
/// unsettleable.
pub fn reveal_handler(ctx: Context<ExploreReveal>, params: VrfRevealParams) -> Result<()> {
    let clock = Clock::get()?;
    let commit_key = ctx.accounts.exploration_commit.key();
    let (randomness, seed_slot, commit_slot, tier) = (
        ctx.accounts.exploration_commit.randomness,
        ctx.accounts.exploration_commit.seed_slot,
        ctx.accounts.exploration_commit.commit_slot,
        ctx.accounts.exploration_commit.tier,
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

    // A revealed trip consumes its escrowed entry fees exactly once, regardless
    // of whether the random outcome succeeds. The closed commit PDA prevents a
    // second burn or a later refund.
    let ec = &ctx.accounts.exploration_commit;
    let token_program = ctx.accounts.token_program.to_account_info();
    let auth = ctx.accounts.auth.to_account_info();
    for (mint, escrow, amount) in [
        (&ctx.accounts.data_mint, &ctx.accounts.escrow_data, ec.data_burned),
        (&ctx.accounts.circuit_mint, &ctx.accounts.escrow_circuit, ec.circuit_burned),
        (&ctx.accounts.silicon_mint, &ctx.accounts.escrow_silicon, ec.silicon_burned),
        (&ctx.accounts.dataset_mint, &ctx.accounts.escrow_dataset, ec.dataset_burned),
    ] {
        burn_auth_escrow(
            &token_program,
            &mint.to_account_info(),
            &escrow.to_account_info(),
            &auth,
            ctx.bumps.auth,
            amount,
        )?;
    }

    let (success, reward) = trip_outcome(&value, &commit_key, tier)?;
    if success {
        // Emission paths check the global supply ceiling before minting.
        check_supply_cap(&ctx.accounts.material_mints, &mut ctx.accounts.issuance_cap_circuit, ResourceKind::Circuit, reward)?;
        check_supply_cap(&ctx.accounts.material_mints, &mut ctx.accounts.issuance_cap_silicon, ResourceKind::Silicon, reward)?;
        let token_program = ctx.accounts.token_program.to_account_info();
        let auth = ctx.accounts.auth.to_account_info();
        mint_resource(&token_program, &ctx.accounts.circuit_mint.to_account_info(), &ctx.accounts.user_circuit.to_account_info(), &auth, ctx.bumps.auth, reward)?;
        mint_resource(&token_program, &ctx.accounts.silicon_mint.to_account_info(), &ctx.accounts.user_silicon.to_account_info(), &auth, ctx.bumps.auth, reward)?;
    }

    emit!(VrfSettled {
        mechanic: VRF_MECHANIC_EXPLORATION,
        commit: commit_key,
        randomness,
        seed_slot,
        value,
        cranker: ctx.accounts.cranker.key(),
    });
    emit!(ExplorationCompleted {
        user: ctx.accounts.exploration_commit.user,
        tool_mint: ctx.accounts.exploration_commit.tool_mint,
        success,
        circuit_reward: reward,
        silicon_reward: reward,
    });
    Ok(())
}

/// [F-06] Refund a trip whose oracle never revealed: return the exact escrowed
/// inputs by transfer. Permissionless, only once the reveal window has closed;
/// the cumulative issuance cap cannot strand the refund.
pub fn expire_handler(ctx: Context<ExploreExpire>) -> Result<()> {
    let clock = Clock::get()?;
    let commit_key = ctx.accounts.exploration_commit.key();
    let commit_slot = ctx.accounts.exploration_commit.commit_slot;
    vrf::release_for_refund(&mut ctx.accounts.vrf_slot, &commit_key, commit_slot, clock.slot)?;

    let ec = &ctx.accounts.exploration_commit;
    let token_program = ctx.accounts.token_program.to_account_info();
    let auth = ctx.accounts.auth.to_account_info();
    refund_auth_escrow(&token_program, &ctx.accounts.escrow_data.to_account_info(), &ctx.accounts.user_data.to_account_info(), &auth, ctx.bumps.auth, ec.data_burned)?;
    refund_auth_escrow(&token_program, &ctx.accounts.escrow_circuit.to_account_info(), &ctx.accounts.user_circuit.to_account_info(), &auth, ctx.bumps.auth, ec.circuit_burned)?;
    refund_auth_escrow(&token_program, &ctx.accounts.escrow_silicon.to_account_info(), &ctx.accounts.user_silicon.to_account_info(), &auth, ctx.bumps.auth, ec.silicon_burned)?;
    refund_auth_escrow(&token_program, &ctx.accounts.escrow_dataset.to_account_info(), &ctx.accounts.user_dataset.to_account_info(), &auth, ctx.bumps.auth, ec.dataset_burned)?;

    emit!(VrfCommitRefunded {
        mechanic: VRF_MECHANIC_EXPLORATION,
        commit: commit_key,
        user: ctx.accounts.exploration_commit.user,
        refunded_lamports: 0,
    });
    Ok(())
}

pub fn upgrade_tier_handler(ctx: Context<UpgradeExplorationTier>) -> Result<()> {
    let state = &mut ctx.accounts.exploration_state;
    // [AUDIT F-12] A fresh ExplorationState has `tier == 0`, so the old
    // `(state.tier - 1)` underflowed a u8 and panicked (overflow-checks = true
    // in this workspace) for every new player. Tiers are 1..=MAX, and the cost
    // table is indexed by "current tier - 1" only once the tier is valid.
    require!(
        state.tier >= 1 && state.tier < MAX_EXPLORATION_TIER,
        AofError::InvalidExplorationTier
    );
    let cost = EXPLORATION_UPGRADE_COST_PER_TIER[(state.tier - 1) as usize];

    for (mint, from) in [
        (&ctx.accounts.circuit_mint, &ctx.accounts.user_circuit),
        (&ctx.accounts.silicon_mint, &ctx.accounts.user_silicon),
        (&ctx.accounts.data_mint, &ctx.accounts.user_data),
    ] {
        require!(from.amount >= cost, AofError::InsufficientBalance);
        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: mint.to_account_info(),
                    from: from.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            cost,
        )?;
    }

    state.tier = state.tier.checked_add(1).ok_or(AofError::MathOverflow)?;
    Ok(())
}

/// Burn escrowed resources with the auth PDA after a VRF outcome is final.
fn burn_auth_escrow<'info>(
    token_program: &AccountInfo<'info>,
    mint: &AccountInfo<'info>,
    escrow: &AccountInfo<'info>,
    auth: &AccountInfo<'info>,
    auth_bump: u8,
    amount: u64,
) -> Result<()> {
    if amount == 0 { return Ok(()); }
    let signer_seeds: &[&[&[u8]]] = &[&[AUTH_SEED, &[auth_bump]]];
    token::burn(
        CpiContext::new_with_signer(
            token_program.clone(),
            Burn { mint: mint.clone(), from: escrow.clone(), authority: auth.clone() },
            signer_seeds,
        ),
        amount,
    )
}

/// Return escrowed resources without minting, so refunds remain valid even at
/// the cumulative lifetime cap.
fn refund_auth_escrow<'info>(
    token_program: &AccountInfo<'info>,
    escrow: &AccountInfo<'info>,
    destination: &AccountInfo<'info>,
    auth: &AccountInfo<'info>,
    auth_bump: u8,
    amount: u64,
) -> Result<()> {
    if amount == 0 { return Ok(()); }
    let signer_seeds: &[&[&[u8]]] = &[&[AUTH_SEED, &[auth_bump]]];
    token::transfer(
        CpiContext::new_with_signer(
            token_program.clone(),
            Transfer { from: escrow.clone(), to: destination.clone(), authority: auth.clone() },
            signer_seeds,
        ),
        amount,
    )
}

/// Mint `amount` of a resource with the auth PDA (callers check the lifetime
/// cap first).
fn mint_resource<'info>(
    token_program: &AccountInfo<'info>,
    mint: &AccountInfo<'info>,
    to: &AccountInfo<'info>,
    auth: &AccountInfo<'info>,
    auth_bump: u8,
    amount: u64,
) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }
    let signer_seeds: &[&[&[u8]]] = &[&[AUTH_SEED, &[auth_bump]]];
    token::mint_to(
        CpiContext::new_with_signer(
            token_program.clone(),
            MintTo { mint: mint.clone(), to: to.clone(), authority: auth.clone() },
            signer_seeds,
        ),
        amount,
    )
}
