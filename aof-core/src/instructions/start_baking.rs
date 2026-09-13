use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, Burn};
use crate::constants::*;
use crate::state::*;
use crate::errors::*;
use crate::StartBaking;

/// Рецепты выпечки (индекс = batch_size - 1)
const OVEN_FLOUR_COST: [u64; 3] = [4, 12, 28];
const OVEN_WATER_COST: [u64; 3] = [3, 8, 18];
const OVEN_WOOD_COST: [u64; 3] = [5, 12, 25];
const OVEN_COAL_COST: [u64; 3] = [2, 5, 10];
const OVEN_BREAD_WOOD: [u64; 3] = [2, 7, 18];
const OVEN_BREAD_COAL: [u64; 3] = [3, 9, 22];
const OVEN_TIME: [i64; 3] = [OVEN_TIME_SMALL, OVEN_TIME_MEDIUM, OVEN_TIME_LARGE];

/// [БЛОК L] Запуск партии выпечки в печи.
/// fuel_kind: 0 = дрова, 1 = уголь.
/// Сжигает Flour+Water+топливо сразу, -2 Energy, ставит таймер.
pub fn handler(ctx: Context<StartBaking>, batch_size: u8, fuel_kind: u8) -> Result<()> {
    require!(batch_size >= 1 && batch_size <= 3, AofError::InvalidBatchSize);
    require!(fuel_kind <= 1, AofError::InvalidFuelKind);
    let idx = (batch_size - 1) as usize;

    let flour_cost = OVEN_FLOUR_COST[idx];
    let water_cost = OVEN_WATER_COST[idx];
    let (fuel_cost, bread_out) = if fuel_kind == 0 {
        (OVEN_WOOD_COST[idx], OVEN_BREAD_WOOD[idx])
    } else {
        (OVEN_COAL_COST[idx], OVEN_BREAD_COAL[idx])
    };
    let duration = OVEN_TIME[idx];

    // OvenState init_if_needed
    let oven = &mut ctx.accounts.oven_state;
    if oven.owner == Pubkey::default() {
        oven.owner = ctx.accounts.user.key();
        oven.in_progress = false;
        oven.ready_at = 0;
        oven.output_bread = 0;
        oven.fuel_kind = 0;
        oven.bump = ctx.bumps.oven_state;
    }
    require!(!oven.in_progress, AofError::OvenInProgress);

    // Энергия (ленивый реген)
    let energy = &mut ctx.accounts.energy_account;
    if energy.owner == Pubkey::default() {
        energy.owner = ctx.accounts.user.key();
        energy.current = ENERGY_CAP;
        energy.last_regen_at = Clock::get()?.unix_timestamp;
        energy.cap = ENERGY_CAP;
        energy.bump = ctx.bumps.energy_account;
    } else {
        let now = Clock::get()?.unix_timestamp;
        let elapsed = now.saturating_sub(energy.last_regen_at);
        let regen = (elapsed / ENERGY_REGEN_SECONDS) as u8;
        if regen > 0 && energy.current < energy.cap {
            energy.current = energy.current.saturating_add(regen).min(energy.cap);
            energy.last_regen_at = now;
        }
    }
    require!(energy.current >= ENERGY_COST_OVEN, AofError::InsufficientEnergy);

    // Балансы
    require!(ctx.accounts.user_flour.amount >= flour_cost, AofError::InsufficientBalance);
    require!(ctx.accounts.user_water.amount >= water_cost, AofError::InsufficientBalance);

    // Burn Flour
    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.flour_mint.to_account_info(),
                from: ctx.accounts.user_flour.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        flour_cost,
    )?;

    // Burn Water
    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.water_mint.to_account_info(),
                from: ctx.accounts.user_water.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        water_cost,
    )?;

    // Burn топливо (WOOD или Coal)
    let (fuel_mint, fuel_acc) = if fuel_kind == 0 {
        (&ctx.accounts.wood_mint, &ctx.accounts.user_wood)
    } else {
        (&ctx.accounts.coal_mint, &ctx.accounts.user_coal)
    };

    require!(fuel_acc.amount >= fuel_cost, AofError::InsufficientBalance);
    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: fuel_mint.to_account_info(),
                from: fuel_acc.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        fuel_cost,
    )?;

    // Energy
    energy.current = energy.current.checked_sub(ENERGY_COST_OVEN).ok_or(AofError::InsufficientEnergy)?;

    // Установка состояния печи
    let now = Clock::get()?.unix_timestamp;
    oven.in_progress = true;
    oven.ready_at = now.checked_add(duration).ok_or(AofError::MathOverflow)?;
    oven.output_bread = bread_out;
    oven.fuel_kind = fuel_kind;

    Ok(())
}
