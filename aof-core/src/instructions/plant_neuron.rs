use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, Burn};
use crate::constants::*;
use crate::state::*;
use crate::errors::*;
use crate::PlantNeuron;

/// Start a timed Neuron-to-Synapse synthesis run in a laboratory cell.
/// -1 Energy, -amount Neuron из кошелька игрока.
/// The cell enters its active state (state=1), ready_at = now + 6 hours.
pub fn handler(ctx: Context<PlantNeuron>, tile_index: u8, amount: u64) -> Result<()> {
    require!(amount > 0, AofError::ZeroAmount);
    require!(tile_index < 10, AofError::InvalidBatchSize); // максимум 10 лабораторных ячеек на игрока

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

    require!(energy.current >= ENERGY_COST_SYNTHESIS, AofError::InsufficientEnergy);

    // Проверка баланса Neuron
    require!(ctx.accounts.user_neuron.amount >= amount, AofError::InsufficientBalance);

    // The laboratory cell must be empty
    let tile = &mut ctx.accounts.lab_tile;
    if tile.owner == Pubkey::default() {
        tile.owner = ctx.accounts.user.key();
        tile.state = 0;
        tile.started_at = 0;
        tile.ready_at = 0;
        tile.neuron_amount = 0;
        tile.bump = ctx.bumps.lab_tile;
    }
    require!(tile.state == 0, AofError::LabTileBusy);

    // Сжигаем Neuron
    let cpi_accounts = Burn {
        mint: ctx.accounts.neuron_mint.to_account_info(),
        from: ctx.accounts.user_neuron.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
    token::burn(cpi_ctx, amount)?;

    // Start the synthesis timer in the laboratory cell
    let now = Clock::get()?.unix_timestamp;
    tile.state = 1;
    tile.started_at = now;
    tile.ready_at = now.checked_add(SYNAPSE_SYNTHESIS_DURATION).ok_or(AofError::MathOverflow)?;
    tile.neuron_amount = amount;

    // Снимаем энергию
    energy.current = energy.current.checked_sub(ENERGY_COST_SYNTHESIS).ok_or(AofError::InsufficientEnergy)?;

    Ok(())
}
