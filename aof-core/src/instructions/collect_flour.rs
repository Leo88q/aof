use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, MintTo};
use crate::constants::*;
use crate::state::*;
use crate::errors::*;
use crate::CollectFlour;

/// [БЛОК L] Сбор готовой муки с мельницы.
/// Требует now >= ready_at. Минтит Flour, сбрасывает mill_state.
pub fn handler(ctx: Context<CollectFlour>) -> Result<()> {
    let mill = &mut ctx.accounts.mill_state;
    require!(mill.owner == ctx.accounts.user.key(), AofError::Unauthorized);
    require!(mill.in_progress, AofError::MillNotReady);

    let now = Clock::get()?.unix_timestamp;
    require!(now >= mill.ready_at, AofError::MillNotReady);

    let output = mill.output_flour;
    require!(output > 0, AofError::ZeroAmount);

    // Auth PDA signer
    let auth_bump = ctx.bumps.auth;
    let signer_seeds: &[&[&[u8]]] = &[&[AUTH_SEED, &[auth_bump]]];

    // Mint Flour
    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.flour_mint.to_account_info(),
                to: ctx.accounts.user_flour.to_account_info(),
                authority: ctx.accounts.auth.to_account_info(),
            },
            signer_seeds,
        ),
        output,
    )?;

    // Сброс
    mill.in_progress = false;
    mill.ready_at = 0;
    mill.output_flour = 0;

    Ok(())
}
