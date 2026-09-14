use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, Burn};
use crate::constants::*;
use crate::{StartExplorationCommit, ExploreReveal, UpgradeExplorationTier};
use crate::errors::*;
use crate::events::*;
use crate::randomness::*;

fn day_start_of(ts: i64) -> i64 {
    ts - (ts % 86400)
}

pub fn start_commit_handler(ctx: Context<StartExplorationCommit>, commit_hash: [u8; 32]) -> Result<()> {
    // Four resources are burned before reveal, while there is no on-chain
    // expiry/refund/cancel path. The API is disabled, but direct program
    // callers must be blocked as well.
    require!(false, AofError::FeatureDisabled);

    let now = Clock::get()?.unix_timestamp;
    let state = &mut ctx.accounts.exploration_state;
    if state.owner == Pubkey::default() {
        state.owner = ctx.accounts.user.key();
        state.tier = 1;
        state.last_trip_at = 0;
        state.trips_today = 0;
        state.day_start = day_start_of(now);
    }

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

    // TRIP_COST — {food:75, wood:35, stone:35, meat:50}
    for (mint, from, cost) in [
        (&ctx.accounts.food_mint, &ctx.accounts.user_food, TRIP_COST_FOOD),
        (&ctx.accounts.wood_mint, &ctx.accounts.user_wood, TRIP_COST_WOOD),
        (&ctx.accounts.stone_mint, &ctx.accounts.user_stone, TRIP_COST_STONE),
        (&ctx.accounts.meat_mint, &ctx.accounts.user_meat, TRIP_COST_MEAT),
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

    let slot = Clock::get()?.slot;
    let ec = &mut ctx.accounts.exploration_commit;
    ec.user = ctx.accounts.user.key();
    ec.tool_mint = ctx.accounts.tool_mint.key();
    ec.commit_hash = commit_hash;
    ec.commit_slot = slot;

    state.last_trip_at = now;
    state.trips_today = state
        .trips_today
        .checked_add(1)
        .ok_or(AofError::MathOverflow)?;
    Ok(())
}

pub fn reveal_handler(ctx: Context<ExploreReveal>, secret: [u8; 32]) -> Result<()> {
    require!(
        hash_secret(&secret) == ctx.accounts.exploration_commit.commit_hash,
        AofError::CommitMismatch
    );
    let slot_hash = get_slot_hash(&ctx.accounts.slot_hashes, ctx.accounts.exploration_commit.commit_slot)?;
    let entropy = derive_entropy(&secret, &slot_hash, b"explore");
    let roll = entropy_u64(&entropy) % 10_000;

    let idx = (ctx.accounts.exploration_state.tier - 1) as usize;
    let success = roll < EXPLORATION_SUCCESS_BPS[idx] as u64;

    let (mut wood_reward, mut stone_reward) = (0u64, 0u64);
    if success {
        let mut r2 = [0u8; 8];
        r2.copy_from_slice(&entropy[8..16]);
        let span = (EXPLORATION_SHARDS_MAX[idx] - EXPLORATION_SHARDS_MIN[idx] + 1) as u64;
        let amount = EXPLORATION_SHARDS_MIN[idx] as u64 + (u64::from_le_bytes(r2) % span);
        // [ДИЗАЙН-РЕШЕНИЕ, см. constants.rs]: вместо отдельных "шардов"
        // (которых нет в модели крафта этой программы) — бонусные WOOD/STONE.
        wood_reward = amount.checked_mul(RESOURCE_UNIT).ok_or(AofError::MathOverflow)?;
        stone_reward = amount.checked_mul(RESOURCE_UNIT).ok_or(AofError::MathOverflow)?;

        let auth_bump = ctx.bumps.auth;
        let signer_seeds: &[&[&[u8]]] = &[&[AUTH_SEED, &[auth_bump]]];
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                anchor_spl::token::MintTo {
                    mint: ctx.accounts.wood_mint.to_account_info(),
                    to: ctx.accounts.user_wood.to_account_info(),
                    authority: ctx.accounts.auth.to_account_info(),
                },
                signer_seeds,
            ),
            wood_reward,
        )?;
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                anchor_spl::token::MintTo {
                    mint: ctx.accounts.stone_mint.to_account_info(),
                    to: ctx.accounts.user_stone.to_account_info(),
                    authority: ctx.accounts.auth.to_account_info(),
                },
                signer_seeds,
            ),
            stone_reward,
        )?;
    }

    emit!(ExplorationCompleted {
        user: ctx.accounts.exploration_commit.user,
        tool_mint: ctx.accounts.exploration_commit.tool_mint,
        success,
        wood_reward,
        stone_reward,
    });
    Ok(())
}

pub fn upgrade_tier_handler(ctx: Context<UpgradeExplorationTier>) -> Result<()> {
    let state = &mut ctx.accounts.exploration_state;
    require!(state.tier < MAX_EXPLORATION_TIER, AofError::ExplorationMaxTier);
    let cost = EXPLORATION_UPGRADE_COST_PER_TIER[(state.tier - 1) as usize];

    for (mint, from) in [
        (&ctx.accounts.wood_mint, &ctx.accounts.user_wood),
        (&ctx.accounts.stone_mint, &ctx.accounts.user_stone),
        (&ctx.accounts.food_mint, &ctx.accounts.user_food),
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
