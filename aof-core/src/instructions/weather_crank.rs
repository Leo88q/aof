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

    // Детерминированный выбор погоды из дня (golden ratio hash), общий с
    // collect_well_water: state::weather_for_day.
    let weather_type = weather_for_day(day_id);

    weather.day_id = day_id;
    weather.weather = weather_type;
    weather.updated_at = now;

    Ok(())
}
