use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, MintTo};
use crate::constants::*;
use crate::state::*;
use crate::errors::*;
use crate::CollectWellWater;
use crate::ResourceKind;

/// [БЛОК L] Сбор воды из колодца.
/// Вода копится пассивно: rate зависит от текущей погоды.
/// mint Water = elapsed_seconds * rate(weather) / 3600
pub fn handler(ctx: Context<CollectWellWater>) -> Result<()> {
    // [AUDIT F-11] The well was a free faucet for any wallet: create an
    // account, wait a day, collect 120-480 WATER, repeat across 1 000 sybils.
    // It is now gated on an existing Player with villagers — a Player PDA can
    // only be created by the authority's resource mint, or by starting a mining
    // session with a real tool NFT — and on the global WATER ceiling (F-03).
    require!(ctx.accounts.player.villagers > 0, AofError::NoIdleVillagers);

    let well = &mut ctx.accounts.well_state;
    
    // Init if needed
    let was_initialized = well.owner != Pubkey::default();
    if !was_initialized {
        well.owner = ctx.accounts.user.key();
        well.water_buffer = 0;
        well.last_collected_at = Clock::get()?.unix_timestamp;
        well.bump = ctx.bumps.well_state;
        // The first call creates the well and starts accrual. Requiring a
        // positive elapsed amount here would make init_if_needed impossible:
        // the transaction would always revert and the PDA would never exist.
        return Ok(());
    }

    require!(well.owner == ctx.accounts.user.key(), AofError::Unauthorized);

    let now = Clock::get()?.unix_timestamp;
    // elapsed всегда >= 0 благодаря saturating_sub, безопасно cast в u64
    let elapsed_u64: u64 = now.saturating_sub(well.last_collected_at).max(0) as u64;

    // Ставка воды/час в зависимости от погоды (u64)
    let rate_per_hour: u64 = match ctx.accounts.weather_state.weather {
        WEATHER_DROUGHT => WELL_RATE_DROUGHT,
        WEATHER_SUNNY => WELL_RATE_SUNNY,
        WEATHER_RAIN => WELL_RATE_RAIN,
        WEATHER_FESTIVAL => WELL_RATE_FESTIVAL,
        _ => WELL_RATE_SUNNY,
    };

    // Вода = elapsed (сек) * rate (в час) / 3600 — все u64
    let accrual_seconds = elapsed_u64.min(WELL_MAX_ACCRUAL_SECONDS);
    let water_amount: u64 = accrual_seconds
        .checked_mul(rate_per_hour)
        .ok_or(AofError::MathOverflow)?
        .checked_div(3600)
        .ok_or(AofError::MathOverflow)?;

    require!(water_amount > 0, AofError::WellEmpty);

    // [AUDIT F-03] Water emission bypassed IssuanceCap entirely; the audit's
    // sybil model produced 78.8 M WATER/year with no bound at all.
    check_supply_cap(
        &ctx.accounts.material_mints,
        ResourceKind::Water,
        ctx.accounts.water_mint.supply,
        water_amount,
    )?;

    // Mint Water
    let auth_bump = ctx.bumps.auth;
    let signer_seeds: &[&[&[u8]]] = &[&[AUTH_SEED, &[auth_bump]]];

    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.water_mint.to_account_info(),
                to: ctx.accounts.user_water.to_account_info(),
                authority: ctx.accounts.auth.to_account_info(),
            },
            signer_seeds,
        ),
        water_amount,
    )?;

    well.last_collected_at = now;

    Ok(())
}
