use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, MintTo, Token};
use crate::constants::*;
use crate::errors::*;
use crate::state::*;
use crate::ResourceKind;
use crate::SealLaboratory;

/// One conscious laboratory: burn the trained model, the five fluids and the
/// amber vessel, then mint one Soul Core. The player can seal again; each
/// seal spends another full set. Nothing here is an off-chain reward.
pub fn handler(ctx: Context<SealLaboratory>) -> Result<()> {
    let finale = &mut ctx.accounts.finale;
    if finale.owner == Pubkey::default() {
        finale.owner = ctx.accounts.user.key();
        finale.seals = 0;
        finale.bump = ctx.bumps.finale;
    }
    require!(finale.owner == ctx.accounts.user.key(), AofError::Unauthorized);

    let auth_bump = ctx.bumps.auth;
    let signer_seeds: &[&[&[u8]]] = &[&[AUTH_SEED, &[auth_bump]]];
    let mm = &*ctx.accounts.material_mints;
    let cfg = &*ctx.accounts.config;

    macro_rules! burn_in {
        ($mint:expr, $acc:expr, $expected:expr, $amt:expr) => {
            require!($mint.key() == $expected, AofError::MaterialNotRegistered);
            require!($acc.amount >= $amt, AofError::InsufficientBalance);
            token::burn(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Burn {
                        mint: $mint.to_account_info(),
                        from: $acc.to_account_info(),
                        authority: ctx.accounts.user.to_account_info(),
                    },
                ),
                $amt,
            )?;
        };
    }

    burn_in!(ctx.accounts.model_mint, ctx.accounts.user_model, mm.model, 1 * RESOURCE_UNIT);
    burn_in!(ctx.accounts.cryo_fluid_mint, ctx.accounts.user_cryo_fluid, mm.cryo_fluid, 1 * RESOURCE_UNIT);
    burn_in!(ctx.accounts.volt_fluid_mint, ctx.accounts.user_volt_fluid, mm.volt_fluid, 1 * RESOURCE_UNIT);
    burn_in!(ctx.accounts.bio_fluid_mint, ctx.accounts.user_bio_fluid, mm.bio_fluid, 1 * RESOURCE_UNIT);
    burn_in!(ctx.accounts.nano_fluid_mint, ctx.accounts.user_nano_fluid, mm.nano_fluid, 1 * RESOURCE_UNIT);
    burn_in!(ctx.accounts.quantum_fluid_mint, ctx.accounts.user_quantum_fluid, mm.quantum_fluid, 1 * RESOURCE_UNIT);
    burn_in!(ctx.accounts.amber_quartz_mint, ctx.accounts.user_amber_quartz, mm.amber_quartz, 1 * RESOURCE_UNIT);

    require!(
        ctx.accounts.soul_core_mint.key() == mint_for_kind(cfg, mm, &ResourceKind::SoulCore),
        AofError::MaterialNotRegistered
    );
    check_supply_cap(mm, &mut ctx.accounts.issuance_cap_soul, ResourceKind::SoulCore, 1 * RESOURCE_UNIT)?;
    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.soul_core_mint.to_account_info(),
                to: ctx.accounts.user_soul_core.to_account_info(),
                authority: ctx.accounts.auth.to_account_info(),
            },
            signer_seeds,
        ),
        1 * RESOURCE_UNIT,
    )?;

    finale.seals = finale.seals.checked_add(1).ok_or(AofError::MathOverflow)?;
    Ok(())
}
