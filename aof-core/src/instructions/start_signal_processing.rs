use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, Burn};
use crate::constants::*;
use crate::state::*;
use crate::errors::*;
use crate::StartSignalProcessing;

/// Рецепты обработки сигналов (индекс = batch_size - 1)
const SIGNAL_SYNAPSE_COST: [u64; 3] = [6 * RESOURCE_UNIT, 18 * RESOURCE_UNIT, 40 * RESOURCE_UNIT];
const SIGNAL_SILICON_COST: [u64; 3] = [1 * RESOURCE_UNIT, 2 * RESOURCE_UNIT, 4 * RESOURCE_UNIT];
const SIGNAL_OUTPUT: [u64; 3] = [3 * RESOURCE_UNIT, 10 * RESOURCE_UNIT, 24 * RESOURCE_UNIT];
const SIGNAL_PROCESSING_TIME: [i64; 3] = [SIGNAL_PROCESSING_TIME_SMALL, SIGNAL_PROCESSING_TIME_MEDIUM, SIGNAL_PROCESSING_TIME_LARGE];

/// [БЛОК L] Запуск обработки сигналов.
/// Сжигает Synapse+Silicon сразу, -2 Energy, таймер на ready_at.
pub fn handler(ctx: Context<StartSignalProcessing>, batch_size: u8) -> Result<()> {
    require!(batch_size >= 1 && batch_size <= 3, AofError::InvalidBatchSize);
    let idx = (batch_size - 1) as usize;

    let synapse_cost = SIGNAL_SYNAPSE_COST[idx];
    let silicon_cost = SIGNAL_SILICON_COST[idx];
    let signal_out = SIGNAL_OUTPUT[idx];
    let duration = SIGNAL_PROCESSING_TIME[idx];

    // SignalState: init_if_needed
    let signal_state = &mut ctx.accounts.signal_state;
    if signal_state.owner == Pubkey::default() {
        signal_state.owner = ctx.accounts.user.key();
        signal_state.in_progress = false;
        signal_state.ready_at = 0;
        signal_state.output_signal = 0;
        signal_state.bump = ctx.bumps.signal_state;
    }
    require!(!signal_state.in_progress, AofError::SignalInProgress);

    // Энергия (ленивый реген)
    let energy = &mut ctx.accounts.energy_account;
    if energy.owner == Pubkey::default() {
        energy.owner = ctx.accounts.user.key();
        energy.current = ENERGY_CAP;
        energy.last_regen_at = Clock::get()?.unix_timestamp;
        energy.cap = ENERGY_CAP;
        energy.bump = ctx.bumps.energy_account;
    } else {
        energy.regenerate(Clock::get()?.unix_timestamp);
    }
    require!(energy.current >= ENERGY_COST_SIGNAL_PROCESSING, AofError::InsufficientEnergy);

    // Балансы
    require!(ctx.accounts.user_synapse.amount >= synapse_cost, AofError::InsufficientBalance);
    require!(ctx.accounts.user_silicon.amount >= silicon_cost, AofError::InsufficientBalance);

    // Burn Synapse
    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.synapse_mint.to_account_info(),
                from: ctx.accounts.user_synapse.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        synapse_cost,
    )?;

    // Burn Silicon
    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.silicon_mint.to_account_info(),
                from: ctx.accounts.user_silicon.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        silicon_cost,
    )?;

    // Energy
    energy.current = energy.current.checked_sub(ENERGY_COST_SIGNAL_PROCESSING).ok_or(AofError::InsufficientEnergy)?;

    // Store the pending signal-processing batch
    let now = Clock::get()?.unix_timestamp;
    signal_state.in_progress = true;
    signal_state.ready_at = now.checked_add(duration).ok_or(AofError::MathOverflow)?;
    signal_state.output_signal = signal_out;

    Ok(())
}
