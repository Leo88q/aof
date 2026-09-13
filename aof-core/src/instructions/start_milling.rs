use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, Burn};
use crate::constants::*;
use crate::state::*;
use crate::errors::*;
use crate::StartMilling;

/// Рецепты помола (индекс = batch_size - 1)
const MILL_WHEAT_COST: [u64; 3] = [6, 18, 40];
const MILL_STONE_COST: [u64; 3] = [1, 2, 4];
const MILL_FLOUR_OUT: [u64; 3] = [3, 10, 24];
const MILL_TIME: [i64; 3] = [MILL_TIME_SMALL, MILL_TIME_MEDIUM, MILL_TIME_LARGE];

/// [БЛОК L] Запуск партии помола на мельнице.
/// Сжигает Wheat+STONE сразу, -2 Energy, таймер на ready_at.
pub fn handler(ctx: Context<StartMilling>, batch_size: u8) -> Result<()> {
    require!(batch_size >= 1 && batch_size <= 3, AofError::InvalidBatchSize);
    let idx = (batch_size - 1) as usize;

    let wheat_cost = MILL_WHEAT_COST[idx];
    let stone_cost = MILL_STONE_COST[idx];
    let flour_out = MILL_FLOUR_OUT[idx];
    let duration = MILL_TIME[idx];

    // MillState: init_if_needed
    let mill = &mut ctx.accounts.mill_state;
    if mill.owner == Pubkey::default() {
        mill.owner = ctx.accounts.user.key();
        mill.in_progress = false;
        mill.ready_at = 0;
        mill.output_flour = 0;
        mill.bump = ctx.bumps.mill_state;
    }
    require!(!mill.in_progress, AofError::MillInProgress);

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
    require!(energy.current >= ENERGY_COST_MILL, AofError::InsufficientEnergy);

    // Балансы
    require!(ctx.accounts.user_wheat.amount >= wheat_cost, AofError::InsufficientBalance);
    require!(ctx.accounts.user_stone.amount >= stone_cost, AofError::InsufficientBalance);

    // Burn Wheat
    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.wheat_mint.to_account_info(),
                from: ctx.accounts.user_wheat.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        wheat_cost,
    )?;

    // Burn STONE
    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.stone_mint.to_account_info(),
                from: ctx.accounts.user_stone.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        stone_cost,
    )?;

    // Energy
    energy.current = energy.current.checked_sub(ENERGY_COST_MILL).ok_or(AofError::InsufficientEnergy)?;

    // Установка состояния мельницы
    let now = Clock::get()?.unix_timestamp;
    mill.in_progress = true;
    mill.ready_at = now.checked_add(duration).ok_or(AofError::MathOverflow)?;
    mill.output_flour = flour_out;

    Ok(())
}
