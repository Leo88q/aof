use anchor_lang::prelude::*;
use crate::errors::MarketError;
use core::convert::TryFrom;

pub const MAX_GROWTH_ITER: u64 = 200;
pub const MAX_DECAY_HOURS: u64 = 72;
pub const PRICE_CAP_MULT: u128 = 100;

pub fn apply_growth(base: u64, growth_bps: u16, purchases_in_window: u64) -> Result<u64> {
    let mut price: u128 = base as u128;
    let factor = 10_000u128
        .checked_add(growth_bps as u128)
        .ok_or(MarketError::MathOverflow)?;
    let iters = purchases_in_window.min(MAX_GROWTH_ITER);
    let cap = (base as u128)
        .checked_mul(PRICE_CAP_MULT)
        .ok_or(MarketError::MathOverflow)?;
    for _ in 0..iters {
        price = price
            .checked_mul(factor)
            .ok_or(MarketError::MathOverflow)?
            / 10_000;
        if price >= cap {
            price = cap;
            break;
        }
    }
    u64::try_from(price).map_err(|_| error!(MarketError::MathOverflow))
}

pub fn apply_decay(current: u64, base: u64, decay_bps_per_hour: u16, hours_idle: i64) -> Result<u64> {
    if hours_idle <= 0 {
        return Ok(current);
    }
    let mut price: u128 = current as u128;
    let factor = 10_000u128.saturating_sub(decay_bps_per_hour as u128).max(1);
    let iters = (hours_idle as u64).min(MAX_DECAY_HOURS);
    for _ in 0..iters {
        price = price
            .checked_mul(factor)
            .ok_or(MarketError::MathOverflow)?
            / 10_000;
        if price <= base as u128 {
            return Ok(base);
        }
    }
    u64::try_from(price.max(1)).map_err(|_| error!(MarketError::MathOverflow))
}

pub fn current_price(
    base: u64,
    growth_bps: u16,
    decay_bps_per_hour: u16,
    purchases_in_window: u64,
    last_trade_ts: i64,
    now: i64,
) -> Result<u64> {
    let grown = apply_growth(base, growth_bps, purchases_in_window)?;
    let hours_idle = (now - last_trade_ts) / 3600;
    apply_decay(grown, base, decay_bps_per_hour, hours_idle)
}

pub fn apply_hot_multiplier(price: u64, hot_multiplier_bps: u16, is_hot: bool) -> Result<u64> {
    if !is_hot || hot_multiplier_bps == 0 {
        return Ok(price);
    }
    let v = (price as u128)
        .checked_mul(hot_multiplier_bps as u128)
        .ok_or(MarketError::MathOverflow)?
        .checked_div(10_000)
        .ok_or(MarketError::MathOverflow)?;
    u64::try_from(v).map_err(|_| error!(MarketError::MathOverflow))
}
