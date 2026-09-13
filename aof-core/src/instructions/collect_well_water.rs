use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, MintTo};
use crate::constants::*;
use crate::state::*;
use crate::errors::*;
use crate::CollectWellWater;

/// [БЛОК L] Сбор воды из колодца.
/// Вода копится пассивно: rate зависит от текущей погоды.
/// mint Water = elapsed_seconds * rate(weather) / 3600
pub fn handler(ctx: Context<CollectWellWater>) -> Result<()> {
    let well = &mut ctx.accounts.well_state;
    
    // Init if needed
    if well.owner == Pubkey::default() {
        well.owner = ctx.accounts.user.key();
        well.water_buffer = 0;
        well.last_collected_at = Clock::get()?.unix_timestamp;
        well.bump = ctx.bumps.well_state;
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
    let water_amount: u64 = elapsed_u64
        .checked_mul(rate_per_hour)
        .ok_or(AofError::MathOverflow)?
        .checked_div(3600)
        .ok_or(AofError::MathOverflow)?;

    require!(water_amount > 0, AofError::WellEmpty);

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
