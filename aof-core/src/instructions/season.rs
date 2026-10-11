use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{self, Token, MintTo};
use crate::constants::*;
use crate::state::*;
use crate::{InitSeason, InitSeasonPass, PurchaseSeasonPass, GrantSeasonXp, ClaimSeasonReward, ClaimPremiumSeasonReward};
use crate::ResourceKind;
use crate::errors::*;
use crate::events::*;

pub fn init_season_handler(ctx: Context<InitSeason>, season_id: u32) -> Result<()> {
    let s = &mut ctx.accounts.season;
    s.season_id = season_id;
    s.start_time = Clock::get()?.unix_timestamp;
    s.bump = ctx.bumps.season;
    emit!(SeasonInitialized { season_id, start_time: s.start_time });
    Ok(())
}

/// [PAYER] Создание пропуска — действие игрока: его подпись и его rent.
/// Отдельная инструкция нужна, чтобы операторская выдача XP (`grant_season_xp`)
/// не создавала и не оплачивала аккаунт игрока за счёт проекта.
pub fn init_pass_handler(ctx: Context<InitSeasonPass>, season_id: u32) -> Result<()> {
    require!(ctx.accounts.season.season_id == season_id, AofError::SeasonMismatch);
    let now = Clock::get()?.unix_timestamp;
    let start = ctx.accounts.season.start_time;
    require!(now >= start, AofError::SeasonNotStarted);
    let end = start.checked_add(SEASON_LENGTH_SECONDS).ok_or(AofError::MathOverflow)?;
    require!(now < end, AofError::SeasonEnded);
    let p = &mut ctx.accounts.season_pass;
    p.owner = ctx.accounts.player.key();
    p.season_id = season_id;
    p.xp = 0;
    p.premium = false;
    p.claimed_bitmap = 0;
    emit!(SeasonPassInitialized { owner: p.owner, season_id });
    Ok(())
}

pub fn purchase_pass_handler(ctx: Context<PurchaseSeasonPass>) -> Result<()> {
    // The chain accepts one purchase inside the season window. The interface
    // sales gate stays closed until Devnet acceptance; that HTTP gate is not this
    // contract boundary. A pass used to be sold for any season id at any time
    // (including seasons that had ended) and a second purchase silently charged
    // 0.15 SOL again for a flag that was already set. Validate every account
    // before transferring the fixed, user-visible price.
    let now = Clock::get()?.unix_timestamp;
    let start = ctx.accounts.season.start_time;
    require!(now >= start, AofError::SeasonNotStarted);
    let end = start.checked_add(SEASON_LENGTH_SECONDS).ok_or(AofError::MathOverflow)?;
    require!(now < end, AofError::SeasonEnded);

    let user = ctx.accounts.user.key();
    let season_id = ctx.accounts.season.season_id;
    let pass = &mut ctx.accounts.season_pass;
    if pass.owner == Pubkey::default() {
        pass.owner = user;
        pass.season_id = season_id;
        pass.xp = 0;
        pass.premium = false;
        pass.claimed_bitmap = 0;
    }
    require_keys_eq!(pass.owner, user, AofError::Unauthorized);
    require!(pass.season_id == season_id, AofError::SeasonMismatch);
    require!(!pass.premium, AofError::SeasonPassAlreadyPremium);

    let premium_claims = &mut ctx.accounts.premium_claims;
    if premium_claims.owner == Pubkey::default() {
        premium_claims.owner = user;
        premium_claims.season_id = season_id;
        premium_claims.claimed_bitmap = 0;
        premium_claims.bump = ctx.bumps.premium_claims;
    }
    require_keys_eq!(premium_claims.owner, user, AofError::Unauthorized);
    require!(premium_claims.season_id == season_id, AofError::SeasonMismatch);

    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.user.to_account_info(),
                to: ctx.accounts.treasury.to_account_info(),
            },
        ),
        SEASON_PASS_PREMIUM_PRICE_LAMPORTS,
    )?;
    pass.premium = true;
    emit!(SeasonPassPurchased { owner: user, season_id });
    Ok(())
}

/// XP is earned off-chain from the player's aggregate activity, but every
/// claim is a player-funded transaction co-signed by the operator. The exact
/// entitlement fields are in the signed instruction message; the on-chain
/// cursor consumes each per-player/per-season nonce at most once.
pub fn grant_xp_handler(
    ctx: Context<GrantSeasonXp>,
    amount: u32,
    season_id: u32,
    nonce: u32,
    expiry_slot: u64,
    campaign_digest: [u8; 32],
    entitlement_id: [u8; 32],
    genesis_hash_digest: [u8; 32],
) -> Result<()> {
    require!(
        amount > 0 && amount <= MAX_SEASON_XP_ENTITLEMENT_AMOUNT,
        AofError::InvalidSeasonXpEntitlement
    );
    require!(ctx.accounts.season.season_id == season_id, AofError::SeasonMismatch);
    require_keys_neq!(ctx.accounts.authority.key(), ctx.accounts.user.key(), AofError::Unauthorized);
    require!(
        campaign_digest != [0; 32] && entitlement_id != [0; 32] && genesis_hash_digest != [0; 32],
        AofError::InvalidSeasonXpEntitlement
    );

    let current_slot = Clock::get()?.slot;
    require!(expiry_slot >= current_slot, AofError::SeasonXpEntitlementExpired);
    require!(
        expiry_slot - current_slot <= MAX_SEASON_XP_ENTITLEMENT_TTL_SLOTS,
        AofError::InvalidSeasonXpEntitlement
    );

    let owner = ctx.accounts.user.key();
    let cursor = &mut ctx.accounts.claim_cursor;
    if cursor.owner == Pubkey::default() {
        cursor.owner = owner;
        cursor.season_id = season_id;
        cursor.next_nonce = 0;
        cursor.bump = ctx.bumps.claim_cursor;
    }
    require_keys_eq!(cursor.owner, owner, AofError::Unauthorized);
    require!(cursor.season_id == season_id, AofError::SeasonMismatch);
    // Gaps are allowed only so an expired earlier entitlement cannot brick the
    // player's season forever. The backend serves the lowest unexpired nonce
    // first; the cursor still moves strictly forward and rejects every replay.
    require!(nonce >= cursor.next_nonce, AofError::SeasonXpNonceMismatch);

    let pass = &mut ctx.accounts.season_pass;
    if pass.owner == Pubkey::default() {
        pass.owner = owner;
        pass.season_id = season_id;
        pass.xp = 0;
        pass.premium = false;
        pass.claimed_bitmap = 0;
    }
    require_keys_eq!(pass.owner, owner, AofError::Unauthorized);
    require!(pass.season_id == season_id, AofError::SeasonMismatch);
    let total_xp = pass.xp.checked_add(amount).ok_or(AofError::MathOverflow)?;
    let next_nonce = nonce.checked_add(1).ok_or(AofError::MathOverflow)?;
    pass.xp = total_xp;
    cursor.next_nonce = next_nonce;

    emit!(SeasonXpGranted {
        owner,
        season_id,
        amount,
        total_xp,
        nonce,
        expiry_slot,
        campaign_digest,
        entitlement_id,
        genesis_hash_digest,
    });
    Ok(())
}

pub fn claim_reward_handler(ctx: Context<ClaimSeasonReward>, level: u8, premium_track: bool) -> Result<()> {
    // Keep the historical instruction ABI, but do not let callers consume the
    // free ledger while claiming the premium track. Premium claims use their
    // own PDA and the dedicated instruction below.
    require!(!premium_track, AofError::SeasonPremiumRequired);
    require!(level > 0 && level <= SEASON_PASS_MAX_LEVEL, AofError::SeasonInsufficientXp);
    let now = Clock::get()?.unix_timestamp;
    require!(
        now < ctx.accounts.season.start_time + SEASON_LENGTH_SECONDS,
        AofError::SeasonEnded
    );

    let bit = 1u64 << (level - 1);
    require!(ctx.accounts.season_pass.claimed_bitmap & bit == 0, AofError::SeasonRewardAlreadyClaimed);
    require!(
        ctx.accounts.season_pass.xp >= (level as u32) * SEASON_XP_PER_LEVEL,
        AofError::SeasonInsufficientXp
    );
    // [AUDIT F-14 / G-12] The old formula was `(level as u64) * 100` in ATOMIC
    // units, i.e. 0.0000042 CIRCUIT at the maximum level — season rewards existed
    // on paper and were dust in practice. Everything else in the program is
    // denominated in RESOURCE_UNIT (1e9 atomic); the reward now is too.
    // Per-level amounts stay a product decision, but the scale is fixed here so
    // `level` cannot silently mean "atomic units" again.
    let reward_amount = (level as u64)
        .checked_mul(SEASON_REWARD_UNITS_PER_LEVEL)
        .and_then(|v| v.checked_mul(RESOURCE_UNIT))
        .ok_or(AofError::MathOverflow)?;
    require!(reward_amount > 0, AofError::ZeroAmount);

    // [AUDIT F-03] Season rewards are another mint path that never saw a cap.
    check_supply_cap(
        &ctx.accounts.material_mints,
        &mut ctx.accounts.issuance_cap_circuit,
        ResourceKind::Circuit,
        reward_amount,
    )?;
    let auth_bump = ctx.bumps.auth;
    let signer_seeds: &[&[&[u8]]] = &[&[AUTH_SEED, &[auth_bump]]];
    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.circuit_mint.to_account_info(),
                to: ctx.accounts.user_circuit.to_account_info(),
                authority: ctx.accounts.auth.to_account_info(),
            },
            signer_seeds,
        ),
        reward_amount,
    )?;

    ctx.accounts.season_pass.claimed_bitmap |= bit;

    emit!(SeasonRewardClaimed {
        owner: ctx.accounts.season_pass.owner,
        level,
    });
    Ok(())
}

pub fn claim_premium_reward_handler(
    ctx: Context<ClaimPremiumSeasonReward>,
    level: u8,
) -> Result<()> {
    require!(level > 0 && level <= SEASON_PASS_MAX_LEVEL, AofError::SeasonInsufficientXp);
    let end = ctx.accounts.season.start_time
        .checked_add(SEASON_LENGTH_SECONDS)
        .ok_or(AofError::MathOverflow)?;
    require!(Clock::get()?.unix_timestamp < end, AofError::SeasonEnded);
    require!(ctx.accounts.season_pass.premium, AofError::SeasonPremiumRequired);
    require!(
        ctx.accounts.season_pass.xp >= (level as u32) * SEASON_XP_PER_LEVEL,
        AofError::SeasonInsufficientXp
    );

    let bit = 1u64 << (level - 1);
    require!(
        ctx.accounts.premium_claims.claimed_bitmap & bit == 0,
        AofError::SeasonRewardAlreadyClaimed
    );
    // Paid track is silicon at 2.5x the free circuit unit rate, not the same
    // mint and formula. 42 levels still fit the claim bitmap.
    let reward_amount = (level as u64)
        .checked_mul(SEASON_REWARD_UNITS_PER_LEVEL)
        .and_then(|v| v.checked_mul(5))
        .and_then(|v| v.checked_div(2))
        .and_then(|v| v.checked_mul(RESOURCE_UNIT))
        .ok_or(AofError::MathOverflow)?;
    require!(reward_amount > 0, AofError::ZeroAmount);
    check_supply_cap(
        &ctx.accounts.material_mints,
        &mut ctx.accounts.issuance_cap_silicon,
        ResourceKind::Silicon,
        reward_amount,
    )?;

    let auth_bump = ctx.bumps.auth;
    let signer_seeds: &[&[&[u8]]] = &[&[AUTH_SEED, &[auth_bump]]];
    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.silicon_mint.to_account_info(),
                to: ctx.accounts.user_silicon.to_account_info(),
                authority: ctx.accounts.auth.to_account_info(),
            },
            signer_seeds,
        ),
        reward_amount,
    )?;

    ctx.accounts.premium_claims.claimed_bitmap |= bit;
    emit!(SeasonPremiumRewardClaimed {
        owner: ctx.accounts.season_pass.owner,
        season_id: ctx.accounts.season.season_id,
        level,
    });
    Ok(())
}
