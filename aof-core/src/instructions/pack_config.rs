use anchor_lang::prelude::*;
use crate::{InitPackConfig, SetPackConfig};
use crate::errors::*;

fn validate_odds(odds: &[u16; 5]) -> Result<()> {
    let sum: u32 = odds.iter().map(|x| *x as u32).sum();
    require!(sum == 10_000, AofError::InvalidOddsWeights);
    // [ФИКС] Legendary (индекс 4) исключён из шансов паков:
    // легендарные инструменты не выпадают из паков, их 4 редкости
    // нормируются на 10000 bps. Закрывает пункт чек-листа.
    require!(odds[4] == 0, AofError::InvalidOddsWeights);
    Ok(())
}

pub fn init_handler(ctx: Context<InitPackConfig>, pack_type: u8, price_lamports: u64, odds_bps: [u16; 5]) -> Result<()> {
    validate_odds(&odds_bps)?;
    let c = &mut ctx.accounts.pack_config;
    c.pack_type = pack_type;
    c.price_lamports = price_lamports;
    c.odds_bps = odds_bps;
    c.bump = ctx.bumps.pack_config;
    Ok(())
}

pub fn set_handler(ctx: Context<SetPackConfig>, price_lamports: u64, odds_bps: [u16; 5]) -> Result<()> {
    validate_odds(&odds_bps)?;
    let c = &mut ctx.accounts.pack_config;
    c.price_lamports = price_lamports;
    c.odds_bps = odds_bps;
    Ok(())
}
