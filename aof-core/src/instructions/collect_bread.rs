use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, MintTo};
use crate::constants::*;
use crate::state::*;
use crate::errors::*;
use crate::CollectBread;
use crate::ResourceKind;

/// [БЛОК L] Сбор готового хлеба с печи.
/// Требует now >= ready_at. Минтит Bread, сбрасывает oven_state.
pub fn handler(ctx: Context<CollectBread>) -> Result<()> {
    let oven = &mut ctx.accounts.oven_state;
    require!(oven.owner == ctx.accounts.user.key(), AofError::Unauthorized);
    require!(oven.in_progress, AofError::OvenNotReady);

    let now = Clock::get()?.unix_timestamp;
    require!(now >= oven.ready_at, AofError::OvenNotReady);

    let output = oven.output_bread;
    require!(output > 0, AofError::ZeroAmount);

    // [AUDIT F-03] see collect_flour: bread emission bypassed IssuanceCap.
    check_supply_cap(
        &ctx.accounts.material_mints,
        ResourceKind::Bread,
        ctx.accounts.bread_mint.supply,
        output,
    )?;

    let auth_bump = ctx.bumps.auth;
    let signer_seeds: &[&[&[u8]]] = &[&[AUTH_SEED, &[auth_bump]]];

    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.bread_mint.to_account_info(),
                to: ctx.accounts.user_bread.to_account_info(),
                authority: ctx.accounts.auth.to_account_info(),
            },
            signer_seeds,
        ),
        output,
    )?;

    // Сброс
    oven.in_progress = false;
    oven.ready_at = 0;
    oven.output_bread = 0;
    oven.fuel_kind = 0;

    Ok(())
}
