use anchor_lang::prelude::*;
use crate::constants::*;
use crate::state::*;
use crate::errors::*;
use crate::WeatherCrank;

/// [БЛОК L] Permissionless обновление погоды раз в сутки.
/// День = unix_timestamp / 86400. Погода детерминирована от дня.
pub fn handler(ctx: Context<WeatherCrank>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let day_id = (now / 86400) as u32;

    let weather = &mut ctx.accounts.weather_state;
    // init_if_needed creates the PDA with zeroed fields; persist the bump so
    // later CollectWellWater seed validation can authenticate this account.
    weather.bump = ctx.bumps.weather_state;

    // Уже обновлено на этот день?
    if weather.day_id == day_id {
        return Err(AofError::WeatherAlreadyUpdated.into());
    }

    // Детерминированный выбор погоды из дня (golden ratio hash)
    let seed = day_id as u64;
    let hash_val = seed
        .wrapping_mul(0x9E3779B97F4A7C15)
        .wrapping_shr(32);

    // Погода: 0=засуха, 1=солнце, 2=дождь, 3=фестиваль
    // Вероятности: 10% засуха, 50% солнце, 30% дождь, 10% фестиваль
    let weather_type = match hash_val % 100 {
        0..=9 => WEATHER_BLACKOUT,
        10..=59 => WEATHER_NOMINAL,
        60..=89 => WEATHER_SURGE,
        _ => WEATHER_FRENZY,
    };

    weather.day_id = day_id;
    weather.weather = weather_type;
    weather.updated_at = now;

    Ok(())
}
