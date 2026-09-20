use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, Burn};
use crate::constants::*;
use crate::state::*;
use crate::errors::*;
use crate::PlantSeeds;

/// [БЛОК L] Посадка семян на полевой тайл.
/// -1 Energy, -amount Seeds из кошелька игрока.
/// Тайл переходит в состояние "растёт" (state=1), ready_at = now + 6 часов.
pub fn handler(ctx: Context<PlantSeeds>, tile_index: u8, amount: u64) -> Result<()> {
    require!(amount > 0, AofError::ZeroAmount);
    require!(tile_index < 10, AofError::InvalidBatchSize); // максимум 10 тайлов на игрока

    // Проверка энергии
    let energy = &mut ctx.accounts.energy_account;
    if energy.owner == Pubkey::default() {
        energy.owner = ctx.accounts.user.key();
        energy.current = ENERGY_CAP;
        energy.last_regen_at = Clock::get()?.unix_timestamp;
        energy.cap = ENERGY_CAP;
        energy.bump = ctx.bumps.energy_account;
    } else {
        // Ленивый регенератор: +1 за каждые 30 минут
        energy.regenerate(Clock::get()?.unix_timestamp);
    }

    require!(energy.current >= ENERGY_COST_PLANT, AofError::InsufficientEnergy);

    // Проверка баланса Seeds
    require!(ctx.accounts.user_seeds.amount >= amount, AofError::InsufficientBalance);

    // Проверка что тайл пуст
    let tile = &mut ctx.accounts.farm_tile;
    if tile.owner == Pubkey::default() {
        tile.owner = ctx.accounts.user.key();
        tile.state = 0;
        tile.planted_at = 0;
        tile.ready_at = 0;
        tile.seeds_amount = 0;
        tile.bump = ctx.bumps.farm_tile;
    }
    require!(tile.state == 0, AofError::FarmTileBusy);

    // Сжигаем Seeds
    let cpi_accounts = Burn {
        mint: ctx.accounts.seeds_mint.to_account_info(),
        from: ctx.accounts.user_seeds.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
    token::burn(cpi_ctx, amount)?;

    // Устанавливаем тайл в "растёт"
    let now = Clock::get()?.unix_timestamp;
    tile.state = 1;
    tile.planted_at = now;
    tile.ready_at = now.checked_add(WHEAT_GROW_DURATION).ok_or(AofError::MathOverflow)?;
    tile.seeds_amount = amount;

    // Снимаем энергию
    energy.current = energy.current.checked_sub(ENERGY_COST_PLANT).ok_or(AofError::InsufficientEnergy)?;

    Ok(())
}
