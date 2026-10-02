use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, MintTo};
use crate::constants::*;
use crate::state::*;
use crate::errors::*;
use crate::CollectSignal;
use crate::ResourceKind;

/// Collect the processed Signal once its timer has elapsed.
/// Требует now >= ready_at. Минтит Signal, сбрасывает signal_state.
pub fn handler(ctx: Context<CollectSignal>) -> Result<()> {
    let signal_state = &mut ctx.accounts.signal_state;
    require!(signal_state.owner == ctx.accounts.user.key(), AofError::Unauthorized);
    require!(signal_state.in_progress, AofError::SignalNotReady);

    let now = Clock::get()?.unix_timestamp;
    require!(now >= signal_state.ready_at, AofError::SignalNotReady);

    let output = signal_state.output_signal;
    require!(output > 0, AofError::ZeroAmount);

    // [AUDIT F-03] Signal is minted by `start_signal_processing`/`collect_signal` and by
    // `craft_recipe`; neither path ever touched IssuanceCap. The global supply
    // ceiling is checked before the CPI so a rejected mint changes nothing.
    check_supply_cap(
        &ctx.accounts.material_mints,
        ResourceKind::Signal,
        ctx.accounts.signal_mint.supply,
        output,
    )?;

    // Auth PDA signer
    let auth_bump = ctx.bumps.auth;
    let signer_seeds: &[&[&[u8]]] = &[&[AUTH_SEED, &[auth_bump]]];

    // Mint Signal
    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.signal_mint.to_account_info(),
                to: ctx.accounts.user_signal.to_account_info(),
                authority: ctx.accounts.auth.to_account_info(),
            },
            signer_seeds,
        ),
        output,
    )?;

    // Сброс
    signal_state.in_progress = false;
    signal_state.ready_at = 0;
    signal_state.output_signal = 0;

    Ok(())
}
