use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, MintTo};
use crate::constants::*;
use crate::state::*;
use crate::errors::*;
use crate::CollectModel;
use crate::ResourceKind;

/// [БЛОК L] Завершение обучения и получение Model.
/// Требует now >= ready_at. Минтит Model, сбрасывает model_state.
pub fn handler(ctx: Context<CollectModel>) -> Result<()> {
    let model_state = &mut ctx.accounts.model_state;
    require!(model_state.owner == ctx.accounts.user.key(), AofError::Unauthorized);
    require!(model_state.in_progress, AofError::ModelNotReady);

    let now = Clock::get()?.unix_timestamp;
    require!(now >= model_state.ready_at, AofError::ModelNotReady);

    let output = model_state.output_model;
    require!(output > 0, AofError::ZeroAmount);

    // [AUDIT F-03] see collect_signal: Model emission bypassed IssuanceCap.
    check_supply_cap(
        &ctx.accounts.material_mints,
        &mut ctx.accounts.issuance_cap_model,
        ResourceKind::Model,
        output,
    )?;

    let auth_bump = ctx.bumps.auth;
    let signer_seeds: &[&[&[u8]]] = &[&[AUTH_SEED, &[auth_bump]]];

    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.model_mint.to_account_info(),
                to: ctx.accounts.user_model.to_account_info(),
                authority: ctx.accounts.auth.to_account_info(),
            },
            signer_seeds,
        ),
        output,
    )?;

    // Сброс
    model_state.in_progress = false;
    model_state.ready_at = 0;
    model_state.output_model = 0;
    model_state.fuel_kind = 0;

    Ok(())
}
