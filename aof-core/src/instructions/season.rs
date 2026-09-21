use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{self, Token, MintTo};
use crate::constants::*;
use crate::{InitSeason, PurchaseSeasonPass, GrantSeasonXp, ClaimSeasonReward};
use crate::ResourceKind;
use crate::errors::*;
use crate::events::*;

pub fn init_season_handler(ctx: Context<InitSeason>, season_id: u32) -> Result<()> {
    let s = &mut ctx.accounts.season;
    s.season_id = season_id;
    s.start_time = Clock::get()?.unix_timestamp;
    s.bump = ctx.bumps.season;
    Ok(())
}

pub fn purchase_pass_handler(ctx: Context<PurchaseSeasonPass>) -> Result<()> {
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
    let p = &mut ctx.accounts.season_pass;
    if p.owner == Pubkey::default() {
        p.owner = ctx.accounts.user.key();
        p.season_id = ctx.accounts.season.season_id;
        p.xp = 0;
        p.claimed_bitmap = 0;
    }
    p.premium = true;
    emit!(SeasonPassPurchased {
        owner: ctx.accounts.user.key(),
        season_id: ctx.accounts.season.season_id,
    });
    Ok(())
}

/// Authority-only: XP считается офчейн из совокупной активности игрока
/// (майнинг, крафт, exploration и т.д. — как и `pay_out`, это уже
/// установленный в этой программе паттерн "сервер считает офчейн, чейн
/// только фиксирует результат"), не завязано на конкретные gameplay-
/// инструкции напрямую, чтобы не раздувать их Accounts-структуры.
pub fn grant_xp_handler(ctx: Context<GrantSeasonXp>, amount: u32) -> Result<()> {
    let p = &mut ctx.accounts.season_pass;
    if p.owner == Pubkey::default() {
        p.owner = ctx.accounts.user.key();
        p.season_id = ctx.accounts.season.season_id;
        p.premium = false;
        p.claimed_bitmap = 0;
    }
    p.xp = p.xp.saturating_add(amount);
    Ok(())
}

pub fn claim_reward_handler(ctx: Context<ClaimSeasonReward>, level: u8, premium_track: bool) -> Result<()> {
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
    if premium_track {
        require!(ctx.accounts.season_pass.premium, AofError::SeasonPremiumRequired);
    }

    // [AUDIT F-14 / G-12] The old formula was `(level as u64) * 100` in ATOMIC
    // units, i.e. 0.0000042 WOOD at the maximum level — season rewards existed
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
        ResourceKind::Wood,
        ctx.accounts.wood_mint.supply,
        reward_amount,
    )?;
    let auth_bump = ctx.bumps.auth;
    let signer_seeds: &[&[&[u8]]] = &[&[AUTH_SEED, &[auth_bump]]];
    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.wood_mint.to_account_info(),
                to: ctx.accounts.user_wood.to_account_info(),
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
